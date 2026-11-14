"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, newId, nowISO, todayISO } from "@/lib/db";
import { requireEmployer, requireRole, requireWorker, getLang } from "@/lib/session";
import { readCardPhoto } from "@/lib/ai/credential";
import { sendSms } from "@/lib/messaging";
import { createPlacementInvoice } from "@/lib/billing";
import { runExpiryReminders } from "@/lib/reminders";
import { allow } from "@/lib/ratelimit";
import { evaluateMatch } from "@/lib/matching";
import { appUrl } from "@/lib/onboarding/runtime";
import { CREDENTIAL_BY_ID, TRADE_BY_ID, credLabel, defaultExpiry } from "@/lib/taxonomy";
import type { Credential, Job, Match, MatchStage, Placement, Shift, TrainingProgram, Worker } from "@/lib/types";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const date = (f: FormData, k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(str(f, k)) ? str(f, k) : null);
const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);

// ---------------- Worker ----------------

export interface AddCardState {
  ok: boolean;
  message: string;
}

export async function addCredential(_prev: AddCardState, form: FormData): Promise<AddCardState> {
  const s = await requireWorker();
  const lang = await getLang();
  const store = await db();
  if (!(await allow(`card:${s.workerId}`, 20, 3600))) return { ok: false, message: lang === "es" ? "Demasiadas tarjetas en una hora. Intenta más tarde." : "Too many cards in an hour. Try again later." };
  const photo = form.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;
  if (hasPhoto && photo.size > 8 * 1024 * 1024) return { ok: false, message: lang === "es" ? "La foto es muy grande (máx. 8 MB)." : "Photo is too large (8 MB max)." };

  const manualType = str(form, "type") || null;
  if (!hasPhoto && !manualType) return { ok: false, message: lang === "es" ? "Elige el tipo de tarjeta o sube una foto." : "Pick a card type or add a photo." };

  const id = newId();
  let reading = null;
  let photoPath: string | null = null;
  if (hasPhoto) {
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const type = photo.type || "image/jpeg";
    reading = await readCardPhoto(bytes, type);
    photoPath = await store.saveFile(`${s.workerId}/${id}.${type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg"}`, bytes, type);
  }
  const type = manualType ?? reading?.type ?? "unknown";
  const issuedOn = date(form, "issuedOn") ?? reading?.issuedOn ?? null;
  const expiresOn = date(form, "expiresOn") ?? reading?.expiresOn ?? defaultExpiry(type, issuedOn);
  const mismatch = Boolean(manualType && reading?.type && manualType !== reading.type);

  const cred: Credential = {
    id, workerId: s.workerId, type, number: str(form, "number") || reading?.number || null, holderName: reading?.holderName ?? null,
    issuedOn, expiresOn, photoPath, verification: hasPhoto ? "document" : "self", verifiedBy: null, verifiedMethod: null,
    extractionConfidence: reading?.confidence ?? null,
    needsReview: hasPhoto && (type === "unknown" || mismatch || (reading?.confidence ?? 0) < 0.85 || Boolean(reading?.expiryInferred)),
    createdAt: nowISO(),
  };
  await store.table("credentials").upsert(cred);
  revalidatePath("/me/cards");
  revalidatePath("/me");

  const es = lang === "es";
  const what = type === "unknown" ? (es ? "Foto guardada; un reclutador revisará qué tarjeta es." : "Photo saved; a recruiter will check which card it is.") : `${credLabel(type, lang)}${expiresOn ? (es ? `, vence ${expiresOn}` : `, expires ${expiresOn}`) : ""}.`;
  const aiNote = hasPhoto && reading?.source === "none" ? (es ? " (Lectura automática apagada en el demo: escribe la fecha si la sabes.)" : " (Automatic reading is off in the demo: type the date if you know it.)") : "";
  return { ok: true, message: (es ? "Guardada: " : "Saved: ") + what + aiNote };
}

export async function deleteCredential(form: FormData) {
  const s = await requireWorker();
  const store = await db();
  const c = await store.table("credentials").get(str(form, "id"));
  if (c && c.workerId === s.workerId) await store.table("credentials").remove(c.id);
  revalidatePath("/me/cards");
}

export async function updateProfile(form: FormData) {
  const s = await requireWorker();
  const store = await db();
  const w = await store.table("workers").get(s.workerId);
  if (!w) return;
  const trade = str(form, "trade");
  const updated: Worker = {
    ...w,
    name: str(form, "name") || w.name,
    trade: TRADE_BY_ID[trade] ? trade : w.trade,
    yearsExperience: str(form, "years") === "" ? null : Math.max(0, Number(str(form, "years"))),
    nccerLevel: Math.max(0, Math.min(4, Number(str(form, "nccer") || 0))),
    zip: /^\d{5}$/.test(str(form, "zip")) ? str(form, "zip") : w.zip,
    // A typed ZIP replaces any device location; keeping both would make them disagree.
    ...(/^\d{5}$/.test(str(form, "zip")) && str(form, "zip") !== w.zip ? { lat: null, lng: null } : {}),
    radiusMiles: Number(str(form, "radius") || w.radiusMiles),
    shifts: form.getAll("shifts").map(String) as Shift[],
    skills: form.getAll("skills").map(String),
    lang: str(form, "lang") === "es" ? "es" : "en",
    onboardingComplete: true,
  };
  await store.table("workers").upsert(updated);
  revalidatePath("/me");
  redirect("/me");
}

export async function expressInterest(form: FormData) {
  const s = await requireWorker();
  const store = await db();
  const jobId = str(form, "jobId");
  const [job, worker, creds] = await Promise.all([
    store.table("jobs").get(jobId),
    store.table("workers").get(s.workerId),
    store.table("credentials").list({ workerId: s.workerId } as Partial<Credential>),
  ]);
  if (!job || !worker) return;
  const existing = (await store.table("matches").list({ jobId } as Partial<Match>)).find((m) => m.workerId === s.workerId);
  if (!existing) {
    const r = evaluateMatch(worker, creds, job, todayISO());
    await store.table("matches").upsert({ id: newId(), jobId, workerId: s.workerId, stage: "shortlisted", score: r.score, notes: "Worker raised their hand in the app.", createdAt: nowISO(), updatedAt: nowISO() });
  }
  revalidatePath(`/me/jobs/${jobId}`);
}

// ---------------- Employer ----------------

/** Plan pricing (estimates to test): $3,000 entry/helper, $4,000 mid, $5,000 journey-level. */
function defaultFee(j: Pick<Job, "trade" | "minYears" | "minNccerLevel" | "requiredCredentials">): number {
  if (j.trade === "helper" || j.minYears < 2) return 3000;
  if (j.minNccerLevel >= 3 || j.minYears >= 5 || j.requiredCredentials.some((c) => c.includes("journeyman") || c.includes("master"))) return 5000;
  return 4000;
}

export async function createJob(form: FormData) {
  const s = await requireRole("employer");
  const employerId = s.role === "staff" ? str(form, "employerId") : s.employerId!;
  const store = await db();
  const trade = str(form, "trade");
  if (!TRADE_BY_ID[trade] || !(await store.table("employers").get(employerId))) throw new Error("Invalid job");
  const job: Job = {
    id: newId(), employerId, title: str(form, "title") || TRADE_BY_ID[trade].label.en, trade,
    requiredCredentials: form.getAll("requiredCredentials").map(String).filter((c) => CREDENTIAL_BY_ID[c]),
    preferredCredentials: form.getAll("preferredCredentials").map(String).filter((c) => CREDENTIAL_BY_ID[c]),
    requiredSkills: form.getAll("requiredSkills").map(String),
    minNccerLevel: Number(str(form, "minNccerLevel") || 0), minYears: Number(str(form, "minYears") || 0),
    payMin: Number(str(form, "payMin") || 0), payMax: Number(str(form, "payMax") || 0),
    shift: (str(form, "shift") || "day") as Shift, zip: str(form, "zip"), startDate: date(form, "startDate") ?? addDays(todayISO(), 14),
    headcount: Math.max(1, Number(str(form, "headcount") || 1)), placementFee: 0,
    status: "open", description: str(form, "description"), createdAt: nowISO(),
  };
  job.placementFee = Number(str(form, "placementFee")) || defaultFee(job);
  await store.table("jobs").upsert(job);
  revalidatePath("/employer");
  revalidatePath("/recruiter");
  redirect(s.role === "staff" ? `/recruiter/jobs/${job.id}` : `/employer/jobs/${job.id}?new=1`);
}

export async function employerRespond(form: FormData) {
  const s = await requireEmployer();
  const store = await db();
  const m = await store.table("matches").get(str(form, "matchId"));
  if (!m) return;
  const job = await store.table("jobs").get(m.jobId);
  if (!job || job.employerId !== s.employerId || m.stage !== "sent") return;
  const stage = str(form, "stage") === "interview" ? "interview" : "rejected";
  await store.table("matches").upsert({ ...m, stage, notes: [m.notes, `Employer: ${stage === "interview" ? "requested interview" : "passed"}${str(form, "note") ? " — " + str(form, "note") : ""}`].filter(Boolean).join("\n"), updatedAt: nowISO() });
  revalidatePath(`/employer/jobs/${job.id}`);
}

// ---------------- Recruiter (staff) ----------------

async function staff() {
  const s = await requireRole("staff");
  return { s, store: await db() };
}

export async function shortlist(form: FormData) {
  const { store } = await staff();
  const jobId = str(form, "jobId");
  const workerId = str(form, "workerId");
  const existing = (await store.table("matches").list({ jobId } as Partial<Match>)).find((m) => m.workerId === workerId);
  if (!existing) {
    await store.table("matches").upsert({ id: newId(), jobId, workerId, stage: "shortlisted", score: Number(str(form, "score") || 0), notes: "", createdAt: nowISO(), updatedAt: nowISO() });
  }
  revalidatePath(`/recruiter/jobs/${jobId}`);
}

export async function setMatchStage(form: FormData) {
  const { store } = await staff();
  const m = await store.table("matches").get(str(form, "matchId"));
  if (!m) return;
  const stage = str(form, "stage") as MatchStage;
  if (!["shortlisted", "sent", "interview", "rejected"].includes(stage)) return;
  await store.table("matches").upsert({ ...m, stage, notes: str(form, "notes") || m.notes, updatedAt: nowISO() });
  if (stage === "sent") {
    const [job, worker] = await Promise.all([store.table("jobs").get(m.jobId), store.table("workers").get(m.workerId)]);
    if (job && worker?.consentSms) {
      const es = worker.lang === "es";
      await sendSms(worker.phone, es
        ? `CrewPass: Te recomendamos para "${job.title}" ($${job.payMin}-${job.payMax}/hr, empieza ${job.startDate}). Te avisamos si piden entrevista.`
        : `CrewPass: We put you forward for "${job.title}" ($${job.payMin}-${job.payMax}/hr, starts ${job.startDate}). We'll text you if they want an interview.`);
    }
  }
  revalidatePath(`/recruiter/jobs/${m.jobId}`);
}

export async function textWorkerAboutJob(form: FormData) {
  const { store } = await staff();
  const [job, worker] = await Promise.all([store.table("jobs").get(str(form, "jobId")), store.table("workers").get(str(form, "workerId"))]);
  if (!job || !worker || !worker.consentSms) return;
  await sendSms(worker.phone, jobText(job, worker));
  revalidatePath(`/recruiter/jobs/${job.id}`);
}

function jobText(job: Job, w: Worker) {
  const es = w.lang === "es";
  return es
    ? `CrewPass: Trabajo que te queda: ${job.title}, $${job.payMin}-${job.payMax}/hr, empieza ${job.startDate}. ¿Te interesa? Responde SÍ o mira detalles: ${appUrl()}/me/jobs/${job.id}`
    : `CrewPass: A job that fits you: ${job.title}, $${job.payMin}-${job.payMax}/hr, starts ${job.startDate}. Interested? See details: ${appUrl()}/me/jobs/${job.id}`;
}

export async function textTopMatches(form: FormData) {
  const { store } = await staff();
  const jobId = str(form, "jobId");
  const limit = Number(str(form, "limit") || 10);
  const { jobCandidates } = await import("@/lib/queries");
  const data = await jobCandidates(jobId);
  if (!data) return;
  const already = new Set(data.matches.map((m) => m.workerId));
  const targets = data.ranked.filter((r) => r.result.eligible && !already.has(r.worker.id) && r.worker.consentSms).slice(0, limit);
  for (const { worker, result } of targets) {
    await sendSms(worker.phone, jobText(data.job, worker));
    await store.table("matches").upsert({ id: newId(), jobId, workerId: worker.id, stage: "shortlisted", score: result.score, notes: "Texted about this job.", createdAt: nowISO(), updatedAt: nowISO() });
  }
  revalidatePath(`/recruiter/jobs/${jobId}`);
}

export async function markHired(form: FormData) {
  const { store } = await staff();
  const m = await store.table("matches").get(str(form, "matchId"));
  if (!m) return;
  const job = await store.table("jobs").get(m.jobId);
  if (!job) return;
  const startDate = date(form, "startDate") ?? job.startDate;
  await store.table("matches").upsert({ ...m, stage: "hired", updatedAt: nowISO() });
  const p: Placement = {
    id: newId(), matchId: m.id, jobId: job.id, workerId: m.workerId, employerId: job.employerId, startDate,
    day30Date: addDays(startDate, 30), guaranteeEndsOn: addDays(startDate, 90), fee: job.placementFee, status: "active",
    invoiceId: null, invoiceUrl: null, createdAt: nowISO(),
  };
  await store.table("placements").upsert(p);
  const hired = (await store.table("matches").list({ jobId: job.id } as Partial<Match>)).filter((x) => x.stage === "hired").length;
  if (hired >= job.headcount) await store.table("jobs").upsert({ ...job, status: "filled" });
  revalidatePath(`/recruiter/jobs/${job.id}`);
  revalidatePath("/recruiter/placements");
}

export async function updatePlacement(form: FormData) {
  const { store } = await staff();
  const p = await store.table("placements").get(str(form, "placementId"));
  if (!p) return;
  const action = str(form, "action");
  if (action === "confirm") {
    await store.table("placements").upsert({ ...p, status: "day30_confirmed" });
  } else if (action === "invoice") {
    const [employer, job, worker] = await Promise.all([store.table("employers").get(p.employerId), store.table("jobs").get(p.jobId), store.table("workers").get(p.workerId)]);
    if (!employer || !job || !worker) return;
    const inv = await createPlacementInvoice(p, employer, job, worker);
    await store.table("placements").upsert({ ...p, status: "invoiced", invoiceId: inv.id, invoiceUrl: inv.url });
  } else if (action === "paid") {
    await store.table("placements").upsert({ ...p, status: "paid" });
  } else if (action === "left") {
    // Inside the 90-day guarantee: we owe a free replacement. Reopen the job for one more hire.
    await store.table("placements").upsert({ ...p, status: "left_early" });
    const job = await store.table("jobs").get(p.jobId);
    if (job && p.guaranteeEndsOn >= todayISO()) await store.table("jobs").upsert({ ...job, status: "open" });
  }
  revalidatePath("/recruiter/placements");
  revalidatePath("/recruiter");
}

export async function reviewCredential(form: FormData) {
  const { s, store } = await staff();
  const c = await store.table("credentials").get(str(form, "id"));
  if (!c) return;
  const decision = str(form, "decision");
  if (decision === "reject") {
    await store.table("credentials").remove(c.id);
  } else {
    const type = str(form, "type") || c.type;
    const updated: Credential = {
      ...c, type, number: str(form, "number") || null, issuedOn: date(form, "issuedOn"), expiresOn: date(form, "expiresOn"),
      needsReview: false,
      ...(decision === "verify"
        ? { verification: "verified" as const, verifiedBy: s.userId ?? "Demo recruiter", verifiedMethod: str(form, "method") || CREDENTIAL_BY_ID[type]?.verifyHow || "Checked" }
        : {}),
    };
    await store.table("credentials").upsert(updated);
  }
  revalidatePath("/recruiter/review");
  revalidatePath("/recruiter");
}

export async function createEmployer(form: FormData) {
  const { store } = await staff();
  const name = str(form, "name");
  if (!name) return;
  await store.table("employers").upsert({ id: newId(), name, contactName: str(form, "contactName"), email: str(form, "email").toLowerCase(), phone: str(form, "phone"), zip: str(form, "zip"), createdAt: nowISO() });
  revalidatePath("/recruiter/employers");
}

export async function runRemindersNow() {
  await staff();
  await runExpiryReminders();
  revalidatePath("/recruiter/outbox");
}

// ---------------- Training directory (staff) ----------------

export async function saveProgram(form: FormData) {
  const { store } = await staff();
  const id = str(form, "id") || newId();
  const numOrNull = (k: string) => (str(form, k) === "" ? null : Number(str(form, k)));
  const existing = await store.table("training_programs").get(id);
  await store.table("training_programs").upsert({
    id,
    provider: str(form, "provider"),
    name: str(form, "name"),
    trade: TRADE_BY_ID[str(form, "trade")] ? str(form, "trade") : null,
    coversCredentials: form.getAll("coversCredentials").map(String).filter((c) => CREDENTIAL_BY_ID[c]),
    coversSkills: form.getAll("coversSkills").map(String),
    nccerLevel: numOrNull("nccerLevel"),
    city: str(form, "city"),
    zip: str(form, "zip"),
    nextStart: date(form, "nextStart"),
    weeks: numOrNull("weeks"),
    clockHours: numOrNull("clockHours"),
    costUsd: numOrNull("costUsd"),
    funding: form.getAll("funding").map(String) as TrainingProgram["funding"],
    languages: (form.getAll("languages").map(String) as TrainingProgram["languages"]).filter(Boolean),
    url: str(form, "url") || null,
    sample: existing?.sample ?? false,
    requirementNote: str(form, "requirementNote") || null,
    // Saving is the review: whoever edits the program has just checked it.
    reviewedOn: todayISO(),
  });
  revalidatePath("/recruiter/training");
  revalidatePath("/training");
  redirect("/recruiter/training");
}

export async function deleteProgram(form: FormData) {
  const { store } = await staff();
  await store.table("training_programs").remove(str(form, "id"));
  revalidatePath("/recruiter/training");
  revalidatePath("/training");
}

/** Shortlist the optimizer's plan (one job, or all of it). The plan is recomputed here, never taken from the form. */
export async function shortlistPlan(form: FormData) {
  await staff();
  const { buildPlan } = await import("@/lib/plan");
  const { store, result, matches } = await buildPlan();
  const only = str(form, "jobId");
  const have = new Set(matches.map((m) => `${m.jobId}:${m.workerId}`));
  for (const a of result.assignments) {
    if (only && a.jobId !== only) continue;
    if (have.has(`${a.jobId}:${a.workerId}`)) continue;
    await store.table("matches").upsert({ id: newId(), jobId: a.jobId, workerId: a.workerId, stage: "shortlisted", score: a.score, notes: "From optimizer plan", createdAt: nowISO(), updatedAt: nowISO() });
  }
  revalidatePath("/recruiter/optimize");
  revalidatePath("/recruiter");
}
