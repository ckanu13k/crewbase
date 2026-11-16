"use server";

import { revalidatePath } from "next/cache";
import { isStaffRole } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { db, newId, nowISO, todayISO } from "@/lib/db";
import { requireCap, requireEmployer, requireRole, requireWorker, getLang } from "@/lib/session";
import { can, type Capability } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { feeFor, getSettings } from "@/lib/settings";
import { emailEmployer } from "@/lib/email";
import { readCardPhoto } from "@/lib/ai/credential";
import { sendSms } from "@/lib/messaging";
import { createPlacementInvoice } from "@/lib/billing";
import { runExpiryReminders } from "@/lib/reminders";
import { allow } from "@/lib/ratelimit";
import { evaluateMatch } from "@/lib/matching";
import { appUrl } from "@/lib/onboarding/runtime";
import { CREDENTIAL_BY_ID, TRADE_BY_ID, credLabel, defaultExpiry, defaultSector } from "@/lib/taxonomy";
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
    email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(str(form, "email")) ? str(form, "email").toLowerCase() : str(form, "email") === "" ? null : w.email ?? null,
    alerts: (["sms", "email", "none"] as const).find((a) => a === str(form, "alerts")) ?? w.alerts ?? "sms",
    onboardingComplete: true,
  };
  if (updated.email && updated.email !== w.email && (await store.table("workers").list()).some((x) => x.id !== w.id && x.email?.toLowerCase() === updated.email)) {
    redirect("/me/profile?err=email");
  }
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

export async function createJob(form: FormData) {
  const s = await requireRole("employer");
  const employerId = isStaffRole(s.role) ? str(form, "employerId") : s.employerId!;
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
    requiresBackground: str(form, "requiresBackground") === "on", requiresDrug: str(form, "requiresDrug") === "on",
    ...jobKind(form, trade),
    status: "open", description: str(form, "description"), createdAt: nowISO(),
  };
  if (job.payMax < job.payMin) job.payMax = job.payMin;
  job.placementFee = job.hireType === "temp" ? 0 : Number(str(form, "placementFee")) || feeFor(job, await getSettings());
  await store.table("jobs").upsert(job);
  await audit(s, "job.created", "job", job.id, `Posted "${job.title}" (${job.headcount} opening(s), starts ${job.startDate})`);
  revalidatePath("/employer");
  revalidatePath("/recruiter");
  redirect(isStaffRole(s.role) ? `/recruiter/jobs/${job.id}` : `/employer/jobs/${job.id}?new=1`);
}

/** Sector, direct vs temp, and the temp-only fields. */
function jobKind(form: FormData, trade: string): Pick<Job, "sector" | "hireType" | "perDiem" | "endDate" | "workOrder"> {
  const sector = (["industrial", "construction", "warehouse", "residential"] as const).find((x) => x === str(form, "sector")) ?? defaultSector(trade);
  const temp = str(form, "hireType") === "temp";
  return {
    sector,
    hireType: temp ? "temp" : "direct",
    perDiem: temp && Number(str(form, "perDiem")) > 0 ? Math.min(500, Number(str(form, "perDiem"))) : null,
    endDate: temp ? date(form, "endDate") : null,
    workOrder: str(form, "workOrder").slice(0, 60) || null,
  };
}

/** Employer (own jobs) or staff: change a job. The placement fee stays as agreed. */
export async function updateJob(form: FormData) {
  const s = await requireRole("employer");
  const store = await db();
  const job = await store.table("jobs").get(str(form, "id"));
  if (!job || (!isStaffRole(s.role) && job.employerId !== s.employerId)) return;
  const trade = TRADE_BY_ID[str(form, "trade")] ? str(form, "trade") : job.trade;
  const updated: Job = {
    ...job, trade, title: str(form, "title") || job.title,
    requiredCredentials: form.getAll("requiredCredentials").map(String).filter((c) => CREDENTIAL_BY_ID[c]),
    preferredCredentials: form.getAll("preferredCredentials").map(String).filter((c) => CREDENTIAL_BY_ID[c]),
    requiredSkills: form.getAll("requiredSkills").map(String),
    minNccerLevel: Number(str(form, "minNccerLevel") || 0), minYears: Number(str(form, "minYears") || 0),
    payMin: Number(str(form, "payMin") || job.payMin), payMax: Number(str(form, "payMax") || job.payMax),
    shift: (str(form, "shift") || job.shift) as Shift, zip: /^\d{5}$/.test(str(form, "zip")) ? str(form, "zip") : job.zip,
    startDate: date(form, "startDate") ?? job.startDate, headcount: Math.max(1, Number(str(form, "headcount") || job.headcount)),
    requiresBackground: str(form, "requiresBackground") === "on", requiresDrug: str(form, "requiresDrug") === "on",
    ...jobKind(form, trade),
    description: str(form, "description"),
  };
  if (updated.payMax < updated.payMin) updated.payMax = updated.payMin;
  // Switching to temp drops the placement fee; switching back to direct prices it again.
  if (updated.hireType === "temp") updated.placementFee = 0;
  else if (job.hireType === "temp") updated.placementFee = feeFor(updated, await getSettings());
  await store.table("jobs").upsert(updated);
  await audit(s, "job.updated", "job", job.id, `Edited "${updated.title}"`);
  revalidatePath(`/employer/jobs/${job.id}`);
  revalidatePath(`/recruiter/jobs/${job.id}`);
  redirect(isStaffRole(s.role) ? `/recruiter/jobs/${job.id}` : `/employer/jobs/${job.id}`);
}

/** Close a job (no more matching) or reopen it. */
export async function setJobStatus(form: FormData) {
  const s = await requireRole("employer");
  const store = await db();
  const job = await store.table("jobs").get(str(form, "id"));
  if (!job || (!isStaffRole(s.role) && job.employerId !== s.employerId)) return;
  const status = str(form, "status") === "closed" ? "closed" : "open";
  await store.table("jobs").upsert({ ...job, status });
  await audit(s, status === "closed" ? "job.closed" : "job.reopened", "job", job.id, `${status === "closed" ? "Closed" : "Reopened"} "${job.title}"`);
  revalidatePath(`/employer/jobs/${job.id}`);
  revalidatePath("/employer");
  revalidatePath("/recruiter");
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
  await audit(s, `match.employer_${stage}`, "match", m.id, `${stage === "interview" ? "Requested interview" : "Passed"} on a candidate for "${job.title}"`);
  revalidatePath(`/employer/jobs/${job.id}`);
}

// ---------------- Recruiter (staff) ----------------

async function staff() {
  const s = await requireRole("staff");
  return { s, store: await db() };
}

/** Admin-only actions (billing, employer accounts, training directory). */
async function withCap(cap: Capability) {
  const s = await requireCap(cap);
  return { s, store: await db() };
}

export async function shortlist(form: FormData) {
  const { s, store } = await staff();
  const jobId = str(form, "jobId");
  const workerId = str(form, "workerId");
  const existing = (await store.table("matches").list({ jobId } as Partial<Match>)).find((m) => m.workerId === workerId);
  if (!existing) {
    const id = newId();
    await store.table("matches").upsert({ id, jobId, workerId, stage: "shortlisted", score: Number(str(form, "score") || 0), notes: "", createdAt: nowISO(), updatedAt: nowISO() });
    await audit(s, "match.shortlisted", "match", id, `Shortlisted worker ${workerId} for job ${jobId}`);
  }
  revalidatePath(`/recruiter/jobs/${jobId}`);
}

export async function setMatchStage(form: FormData) {
  const { s, store } = await staff();
  const m = await store.table("matches").get(str(form, "matchId"));
  if (!m) return;
  const stage = str(form, "stage") as MatchStage;
  if (!["shortlisted", "sent", "interview", "rejected"].includes(stage)) return;
  await store.table("matches").upsert({ ...m, stage, notes: str(form, "notes") || m.notes, updatedAt: nowISO() });
  await audit(s, "match.stage", "match", m.id, `Moved to ${stage} (job ${m.jobId}, worker ${m.workerId})`);
  if (stage === "sent") {
    const [job, worker] = await Promise.all([store.table("jobs").get(m.jobId), store.table("workers").get(m.workerId)]);
    if (job && worker) {
      const { fireEmployerWebhook, candidatePayload } = await import("@/lib/ats");
      void fireEmployerWebhook(job.employerId, "candidate.sent", candidatePayload(worker, await store.table("credentials").list({ workerId: worker.id } as Partial<Credential>), job));
    }
    if (job) await emailEmployer(job.employerId, `New candidate for ${job.title}`, `A recruiter sent you a checked candidate for "${job.title}". Review them and request an interview: ${appUrl()}/employer/jobs/${job.id}`);
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
  const { s, store } = await staff();
  const m = await store.table("matches").get(str(form, "matchId"));
  if (!m) return;
  const job = await store.table("jobs").get(m.jobId);
  if (!job) return;
  const startDate = date(form, "startDate") ?? job.startDate;
  // Required background check / drug screen must be clear for this employer before day one.
  const { hireGate } = await import("@/lib/screening/policy");
  const gate = hireGate(job, await store.table("screenings").list({ workerId: m.workerId } as never), todayISO());
  if (!gate.ok) return;
  await store.table("matches").upsert({ ...m, stage: "hired", updatedAt: nowISO() });
  const { fireEmployerWebhook, candidatePayload } = await import("@/lib/ats");
  const hiredWorker = await store.table("workers").get(m.workerId);
  if (hiredWorker) void fireEmployerWebhook(job.employerId, "worker.hired", { ...candidatePayload(hiredWorker, await store.table("credentials").list({ workerId: m.workerId } as Partial<Credential>), job), startDate });
  if (job.hireType === "temp") {
    // Temp: CrewPass employs the worker on an assignment and bills hourly. No placement fee.
    const { createAssignmentFor } = await import("@/lib/crew");
    await createAssignmentFor(s, m, Number(str(form, "payRate")) || null, startDate);
    const active = (await store.table("assignments").list({ jobId: job.id } as never)).filter((a) => a.status === "active").length;
    if (active >= job.headcount) await store.table("jobs").upsert({ ...job, status: "filled" });
    revalidatePath(`/recruiter/jobs/${job.id}`);
    revalidatePath("/recruiter/crews");
    return;
  }
  const cfg = await getSettings();
  const p: Placement = {
    id: newId(), matchId: m.id, jobId: job.id, workerId: m.workerId, employerId: job.employerId, startDate,
    day30Date: addDays(startDate, cfg.feeDueDay), guaranteeEndsOn: addDays(startDate, cfg.guaranteeDays), fee: job.placementFee, status: "active",
    invoiceId: null, invoiceUrl: null, createdAt: nowISO(),
  };
  await store.table("placements").upsert(p);
  await audit(s, "placement.hired", "placement", p.id, `Hired worker ${m.workerId} for "${job.title}", starts ${startDate}, fee $${p.fee}`);
  const hired = (await store.table("matches").list({ jobId: job.id } as Partial<Match>)).filter((x) => x.stage === "hired").length;
  if (hired >= job.headcount) await store.table("jobs").upsert({ ...job, status: "filled" });
  revalidatePath(`/recruiter/jobs/${job.id}`);
  revalidatePath("/recruiter/placements");
  revalidatePath("/admin/billing");
}

export async function updatePlacement(form: FormData) {
  const { s, store } = await staff();
  const p = await store.table("placements").get(str(form, "placementId"));
  if (!p) return;
  const action = str(form, "action");
  // Recruiters confirm day 30 and record early leavers; invoicing and payments are admin-only.
  if ((action === "invoice" || action === "paid") && !can(s.role, "bill")) return;
  await audit(s, `placement.${action}`, "placement", p.id, `Placement ${p.id}: ${action}`);
  if (action === "confirm") {
    await store.table("placements").upsert({ ...p, status: "day30_confirmed" });
  } else if (action === "invoice") {
    const [employer, job, worker] = await Promise.all([store.table("employers").get(p.employerId), store.table("jobs").get(p.jobId), store.table("workers").get(p.workerId)]);
    if (!employer || !job || !worker) return;
    const inv = await createPlacementInvoice(p, employer, job, worker);
    await store.table("placements").upsert({ ...p, status: "invoiced", invoiceId: inv.id, invoiceUrl: inv.url });
    await emailEmployer(p.employerId, `Invoice for ${worker.name.split(" ")[0]} — ${job.title}`, `Your placement fee of $${p.fee} is due in 15 days.${inv.url ? ` View and pay: ${inv.url}` : ""}\nAll hires and invoices: ${appUrl()}/employer/hires`);
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
  await audit(s, `card.${decision === "reject" ? "rejected" : decision === "verify" ? "verified" : "updated"}`, "credential", c.id, `${decision === "reject" ? "Rejected" : decision === "verify" ? "Verified" : "Updated"} ${str(form, "type") || c.type} for worker ${c.workerId}${str(form, "method") ? ` (${str(form, "method")})` : ""}`);
  if (decision === "reject") {
    await store.table("credentials").remove(c.id);
  } else {
    const type = str(form, "type") || c.type;
    const updated: Credential = {
      ...c, type, number: str(form, "number") || null, issuedOn: date(form, "issuedOn"), expiresOn: date(form, "expiresOn"),
      needsReview: false,
      ...(decision === "verify"
        ? { verification: "verified" as const, verifiedBy: s.actor, verifiedMethod: str(form, "method") || CREDENTIAL_BY_ID[type]?.verifyHow || "Checked" }
        : {}),
    };
    await store.table("credentials").upsert(updated);
  }
  revalidatePath("/recruiter/review");
  revalidatePath("/recruiter");
}

export async function createEmployer(form: FormData) {
  const { s, store } = await withCap("manageEmployers");
  const name = str(form, "name");
  if (!name) return;
  const id = newId();
  await store.table("employers").upsert({ id, name, contactName: str(form, "contactName"), email: str(form, "email").toLowerCase(), phone: str(form, "phone"), zip: str(form, "zip"), recruiterId: str(form, "recruiterId") || null, createdAt: nowISO() });
  await audit(s, "employer.created", "employer", id, `Added employer ${name}`);
  revalidatePath("/admin/employers");
}

export async function runRemindersNow() {
  await staff();
  await runExpiryReminders();
  revalidatePath("/recruiter/outbox");
}

// ---------------- Training directory (staff) ----------------

export async function saveProgram(form: FormData) {
  const { s, store } = await withCap("manageTraining");
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
    providerId: existing?.providerId ?? null,
    status: str(form, "status") === "pending" ? "pending" : "published",
  });
  await audit(s, existing ? "training.updated" : "training.created", "training", id, `${existing ? "Updated" : "Added"} training "${str(form, "name")}"`);
  revalidatePath("/admin/training");
  revalidatePath("/training");
  redirect("/admin/training");
}

export async function deleteProgram(form: FormData) {
  const { s, store } = await withCap("manageTraining");
  await store.table("training_programs").remove(str(form, "id"));
  await audit(s, "training.deleted", "training", str(form, "id"), `Deleted training ${str(form, "id")}`);
  revalidatePath("/admin/training");
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

/**
 * Worker: delete my account. Removes cards (and photos), signup chats, messages and matches.
 * If they were ever placed, the placement and screening outcome rows are kept for billing and
 * legal records, but the profile is stripped of everything that identifies them.
 */
export async function deleteMyAccount(form: FormData) {
  const s = await requireWorker();
  if (str(form, "confirm").toUpperCase() !== "DELETE") redirect("/me/profile?del=confirm");
  const store = await db();
  const w = await store.table("workers").get(s.workerId);
  if (!w) redirect("/");
  for (const c of await store.table("credentials").list({ workerId: w.id } as Partial<Credential>)) {
    if (c.photoPath) await store.removeFile(c.photoPath).catch(() => {});
    await store.table("credentials").remove(c.id);
  }
  for (const x of (await store.table("onboarding_sessions").list()).filter((x) => x.workerId === w.id)) await store.table("onboarding_sessions").remove(x.id);
  for (const m of (await store.table("outbox").list()).filter((m) => m.to === w.phone || (w.email && m.to === w.email))) await store.table("outbox").remove(m.id);
  // Anyone who was placed or worked a temp assignment keeps payroll, billing and legal records (anonymized).
  const placed = (await store.table("placements").list({ workerId: w.id } as Partial<Placement>)).length > 0 || (await store.table("assignments").list({ workerId: w.id } as never)).length > 0;
  const by = { workerId: w.id } as never;
  for (const x of await store.table("interviews").list(by)) await store.table("interviews").remove(x.id);
  for (const x of await store.table("assessment_attempts").list(by)) await store.table("assessment_attempts").remove(x.id);
  for (const x of await store.table("pay_reports").list(by)) await store.table("pay_reports").remove(x.id);
  for (const x of (await store.table("crew_roster").list()).filter((c) => c.workerId === w.id)) await store.table("crew_roster").remove(x.id);
  for (const m of await store.table("matches").list({ workerId: w.id } as Partial<Match>)) if (!placed || m.stage !== "hired") await store.table("matches").remove(m.id);
  if (placed) {
    await store.table("workers").upsert({
      ...w, name: "Deleted worker", phone: `deleted:${w.id}`, email: null, zip: null, lat: null, lng: null, skills: [], summary: "",
      consentSms: false, alerts: "none", onboardingComplete: false,
    });
  } else {
    for (const x of await store.table("screenings").list({ workerId: w.id } as never)) await store.table("screenings").remove(x.id);
    await store.table("workers").remove(w.id);
  }
  await audit({ role: "worker", actor: `worker ${w.id}` }, "worker.deleted", "worker", w.id, placed ? "Worker deleted their account (anonymized; placement records kept)" : "Worker deleted their account");
  if (s.userId) {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    await admin.auth.admin.deleteUser(s.userId).catch(() => {});
  }
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  for (const c of ["cp_token", "cp_refresh", "cp_role", "cp_worker", "cp_webkey", "cp_loc"]) jar.delete(c);
  redirect("/?deleted=1");
}
