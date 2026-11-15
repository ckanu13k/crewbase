"use server";
// Background checks and drug screens: request → worker authorizes → provider → outcome →
// (if needed) individual review or FCRA adverse-action steps → billed to the employer.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, newId, nowISO, todayISO } from "@/lib/db";
import { requireCap, requireRole, requireWorker } from "@/lib/session";
import { sendSms } from "@/lib/messaging";
import { appUrl } from "@/lib/onboarding/runtime";
import { createScreeningInvoice } from "@/lib/billing";
import { areaLabel } from "@/lib/geo";
import { activeProvider, checkrInvite, splitName } from "@/lib/screening/providers";
import {
  ADVERSE_WAIT_BUSINESS_DAYS, DEFAULT_PRICE, FCRA_RIGHTS_URL, KIND_LABEL, VALID_DAYS, addDays, billable, canSendFinalNotice, kindsToOrder,
} from "@/lib/screening/policy";
import type { Screening, ScreeningKind } from "@/lib/types";
import { audit } from "@/lib/audit";
import { emailEmployer } from "@/lib/email";
import { getSettings, screeningPrice, screeningValidDays } from "@/lib/settings";
import { getSession } from "@/lib/session";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const KINDS: ScreeningKind[] = ["background", "drug"];

async function staff() {
  await requireRole("staff");
  return db();
}

const who = () => getSession();

function refresh(jobId?: string) {
  revalidatePath("/recruiter/screenings");
  if (jobId) revalidatePath(`/recruiter/jobs/${jobId}`);
  revalidatePath("/me/screening");
  revalidatePath("/me");
}

/** Staff: request the job's required screenings (or the kinds ticked) for a worker in the pipeline. */
export async function requestScreenings(form: FormData) {
  const store = await staff();
  const m = await store.table("matches").get(str(form, "matchId"));
  if (!m) return;
  const [job, worker, existing] = await Promise.all([
    store.table("jobs").get(m.jobId),
    store.table("workers").get(m.workerId),
    store.table("screenings").list({ workerId: m.workerId } as Partial<Screening>),
  ]);
  if (!job || !worker) return;
  const ticked = form.getAll("kind").map(String).filter((k): k is ScreeningKind => KINDS.includes(k as ScreeningKind));
  const needed = new Set(kindsToOrder({ ...job, requiresBackground: ticked.includes("background") || job.requiresBackground, requiresDrug: ticked.includes("drug") || job.requiresDrug }, existing, todayISO()));
  const kinds = (ticked.length ? ticked : [...needed]).filter((k) => needed.has(k));
  if (!kinds.length) return;
  const provider = activeProvider();
  const cfg = await getSettings();
  for (const kind of kinds) {
    const price = Number(str(form, `price_${kind}`)) || screeningPrice(kind, cfg) || DEFAULT_PRICE[kind];
    const row: Screening = {
      id: newId(), workerId: worker.id, employerId: job.employerId, jobId: job.id, matchId: m.id, kind, provider,
      providerRef: null, consentUrl: null, status: "awaiting_consent", consentAt: null, consentName: null, orderedAt: null,
      completedAt: null, expiresOn: null, reviewedNote: null, preAdverseAt: null, reportCopySent: false, finalAdverseAt: null,
      priceUsd: price, invoiceId: null, createdAt: nowISO(), updatedAt: nowISO(),
    };
    await store.table("screenings").upsert(row);
    await audit(await who(), "screening.requested", "screening", row.id, `Requested ${KIND_LABEL[kind].en.toLowerCase()} for ${worker.name} (${job.title})`);
  }
  if (worker.consentSms) {
    const es = worker.lang === "es";
    const what = kinds.map((k) => KIND_LABEL[k][worker.lang].toLowerCase()).join(es ? " y " : " and ");
    await sendSms(worker.phone, es
      ? `CrewPass: Para seguir con "${job.title}" el empleador pide ${what}. Autorízalo aquí: ${appUrl()}/me/screening`
      : `CrewPass: To move ahead on "${job.title}" the employer needs a ${what}. Authorize it here: ${appUrl()}/me/screening`);
  }
  refresh(job.id);
}

/** Worker (manual provider): sign the authorization inside CrewPass. */
export async function consentToScreenings(form: FormData) {
  const s = await requireWorker();
  const store = await db();
  const name = str(form, "signature");
  if (str(form, "agree") !== "yes" || name.length < 3) redirect("/me/screening?err=sign");
  const ids = form.getAll("id").map(String);
  for (const id of ids) {
    const row = await store.table("screenings").get(id);
    if (!row || row.workerId !== s.workerId || row.status !== "awaiting_consent" || row.provider !== "manual") continue;
    await store.table("screenings").upsert({ ...row, status: "in_progress", consentAt: nowISO(), consentName: name, updatedAt: nowISO() });
    await audit(s, "screening.authorized", "screening", row.id, `Worker signed the authorization for a ${row.kind} check`);
  }
  refresh();
  redirect("/me/screening?ok=1");
}

/** Worker (Checkr): give an email so Checkr can send its own disclosure and authorization, then go there. */
export async function startCheckrAuthorization(form: FormData) {
  const s = await requireWorker();
  const store = await db();
  const email = str(form, "email");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect("/me/screening?err=email");
  const [worker, rows] = await Promise.all([
    store.table("workers").get(s.workerId),
    store.table("screenings").list({ workerId: s.workerId } as Partial<Screening>),
  ]);
  const pending = rows.filter((r) => r.status === "awaiting_consent" && r.provider === "checkr" && !r.consentUrl);
  if (!worker || !pending.length) redirect("/me/screening");
  const job = await store.table("jobs").get(pending[0].jobId);
  const { firstName, lastName } = splitName(worker.name);
  const res = await checkrInvite({ firstName, lastName, email, kinds: [...new Set(pending.map((p) => p.kind))], city: areaLabel(job?.zip) ?? "Houston" });
  for (const p of pending) {
    const inv = res.invitations.find((i) => i.kind === p.kind);
    await store.table("screenings").upsert({ ...p, providerRef: res.candidateId, consentUrl: inv?.url ?? null, updatedAt: nowISO() });
  }
  refresh();
  redirect(res.invitations[0]?.url ?? "/me/screening");
}

async function load(form: FormData) {
  const store = await staff();
  const row = await store.table("screenings").get(str(form, "id"));
  return { store, row };
}

/** Staff (manual): ordered in the provider's portal. Starts billing. */
export async function markScreeningOrdered(form: FormData) {
  const { store, row } = await load(form);
  if (!row || row.status !== "in_progress") return;
  await store.table("screenings").upsert({ ...row, orderedAt: row.orderedAt ?? nowISO(), updatedAt: nowISO() });
  await audit(await who(), "screening.ordered", "screening", row.id, `Ordered ${row.kind} check with the provider`);
  refresh(row.jobId);
}

/** Staff (manual): record the provider's outcome — clear, or flagged for review. Nothing else is stored. */
export async function recordScreeningResult(form: FormData) {
  const { store, row } = await load(form);
  if (!row || row.status !== "in_progress") return;
  const result = str(form, "result");
  if (result !== "clear" && result !== "needs_review") return;
  const today = todayISO();
  const cfg = await getSettings();
  await store.table("screenings").upsert({
    ...row,
    status: result,
    orderedAt: row.orderedAt ?? nowISO(),
    completedAt: nowISO(),
    expiresOn: result === "clear" ? addDays(today, screeningValidDays(row.kind, cfg) || VALID_DAYS[row.kind]) : null,
    updatedAt: nowISO(),
  });
  await audit(await who(), "screening.result", "screening", row.id, `Recorded ${row.kind} result: ${result === "clear" ? "clear" : "flagged for review"}`);
  if (result === "clear") {
    const job = await store.table("jobs").get(row.jobId);
    if (job) await emailEmployer(row.employerId, `Screening clear for a candidate — ${job.title}`, `A ${KIND_LABEL[row.kind].en.toLowerCase()} came back clear for a candidate on "${job.title}". ${appUrl()}/employer/jobs/${job.id}`);
  }
  refresh(row.jobId);
}

/** Staff: after an individual review of a flagged result, clear the worker for this job. */
export async function clearAfterReview(form: FormData) {
  const { store, row } = await load(form);
  if (!row || (row.status !== "needs_review" && row.status !== "pre_adverse")) return;
  const note = str(form, "note").slice(0, 300);
  if (!note) return;
  const cfg = await getSettings();
  await store.table("screenings").upsert({ ...row, status: "clear", reviewedNote: note, expiresOn: addDays(todayISO(), screeningValidDays(row.kind, cfg)), updatedAt: nowISO() });
  await audit(await who(), "screening.cleared_after_review", "screening", row.id, `Cleared ${row.kind} after individual review: ${note}`);
  refresh(row.jobId);
}

/** Staff: FCRA step 1 — pre-adverse action notice. Requires that a copy of the report was sent. */
export async function sendPreAdverseNotice(form: FormData) {
  const { store, row } = await load(form);
  if (!row || row.status !== "needs_review") return;
  if (str(form, "reportCopySent") !== "yes") return;
  const [worker, job, employer] = await Promise.all([store.table("workers").get(row.workerId), store.table("jobs").get(row.jobId), store.table("employers").get(row.employerId)]);
  await store.table("screenings").upsert({ ...row, status: "pre_adverse", preAdverseAt: nowISO(), reportCopySent: true, updatedAt: nowISO() });
  await audit(await who(), "screening.pre_adverse", "screening", row.id, `Sent pre-adverse notice (${row.kind}); report copy + Summary of Rights confirmed sent`);
  if (worker && job) {
    const es = worker.lang === "es";
    const kind = KIND_LABEL[row.kind][worker.lang].toLowerCase();
    await sendSms(worker.phone, es
      ? `CrewPass: Según tu ${kind}, ${employer?.name ?? "el empleador"} podría no seguir con "${job.title}". Te enviamos una copia del reporte y tus derechos (${FCRA_RIGHTS_URL}). Tienes ${ADVERSE_WAIT_BUSINESS_DAYS} días hábiles para corregir errores: ${appUrl()}/me/screening`
      : `CrewPass: Based on your ${kind}, ${employer?.name ?? "the employer"} may not move ahead on "${job.title}". We sent you a copy of the report and your rights (${FCRA_RIGHTS_URL}). You have ${ADVERSE_WAIT_BUSINESS_DAYS} business days to dispute anything wrong: ${appUrl()}/me/screening`);
  }
  refresh(row.jobId);
}

/** Staff: FCRA step 2 — final notice, only after the waiting period. Takes the worker off this job. */
export async function sendFinalAdverseNotice(form: FormData) {
  const { store, row } = await load(form);
  if (!row || !canSendFinalNotice(row, todayISO(), (await getSettings()).adverseWaitDays)) return;
  const [worker, job] = await Promise.all([store.table("workers").get(row.workerId), store.table("jobs").get(row.jobId)]);
  await store.table("screenings").upsert({ ...row, status: "not_cleared", finalAdverseAt: nowISO(), updatedAt: nowISO() });
  await audit(await who(), "screening.final_adverse", "screening", row.id, `Sent final adverse action notice (${row.kind})`);
  if (row.matchId) {
    const m = await store.table("matches").get(row.matchId);
    if (m && m.stage !== "hired") await store.table("matches").upsert({ ...m, stage: "rejected", notes: [m.notes, `Not cleared: ${row.kind} (final notice sent)`].filter(Boolean).join("\n"), updatedAt: nowISO() });
  }
  if (worker && job) {
    const es = worker.lang === "es";
    await sendSms(worker.phone, es
      ? `CrewPass: Aviso final: no seguiremos con "${job.title}" por el resultado de tu revisión. El proveedor del reporte no tomó esta decisión. Puedes pedir una copia gratis en 60 días y disputar errores. Tus derechos: ${FCRA_RIGHTS_URL}`
      : `CrewPass: Final notice: we won't move ahead on "${job.title}" because of your screening result. The screening company didn't make this decision. You can get a free copy within 60 days and dispute anything wrong. Your rights: ${FCRA_RIGHTS_URL}`);
  }
  refresh(row.jobId);
}

export async function cancelScreening(form: FormData) {
  const { store, row } = await load(form);
  if (!row || row.status === "clear" || row.status === "not_cleared") return;
  await store.table("screenings").upsert({ ...row, status: "canceled", updatedAt: nowISO() });
  await audit(await who(), "screening.canceled", "screening", row.id, `Canceled ${row.kind} check`);
  refresh(row.jobId);
}

/** Staff: invoice everything billable for one employer. */
export async function invoiceEmployerScreenings(form: FormData) {
  await requireCap("bill");
  const store = await db();
  const employer = await store.table("employers").get(str(form, "employerId"));
  if (!employer) return;
  const rows = billable(await store.table("screenings").list({ employerId: employer.id } as Partial<Screening>));
  if (!rows.length) return;
  const workers = Object.fromEntries((await store.table("workers").list()).map((w) => [w.id, w.name]));
  const inv = await createScreeningInvoice(
    employer,
    rows.map((r) => ({ id: r.id, amountUsd: r.priceUsd, description: `${KIND_LABEL[r.kind].en} — ${workers[r.workerId] ?? "worker"} (ordered ${r.orderedAt?.slice(0, 10)})` })),
  );
  for (const r of rows) await store.table("screenings").upsert({ ...r, invoiceId: inv.id, updatedAt: nowISO() });
  await audit(await who(), "screening.invoiced", "employer", employer.id, `Invoiced ${rows.length} screening(s) to ${employer.name} (${inv.id})`);
  revalidatePath("/recruiter/screenings");
  revalidatePath("/admin/billing");
}
