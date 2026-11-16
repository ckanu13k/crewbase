"use server";
// Interview scheduling, ATS connections, skills tests and anonymous pay sharing.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, newId, nowISO } from "@/lib/db";
import { requireEmployer, requireRole, requireWorker } from "@/lib/session";
import { isStaffRole } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { sendSms } from "@/lib/messaging";
import { emailEmployer } from "@/lib/email";
import { appUrl } from "@/lib/onboarding/runtime";
import { chicagoNow, cleanSlots, slotLabel } from "@/lib/interviews";
import { candidatePayload, fireEmployerWebhook } from "@/lib/ats";
import { isSafeWebhookUrl, newWebhookSecret } from "@/lib/webhooks";
import { ASSESSMENT_BY_ID, TIME_LIMIT_MIN, drawQuestions, gradeAttempt, nextAttemptAt } from "@/lib/assessments";
import { plausibleHourly } from "@/lib/paycompare";
import { TRADE_BY_ID } from "@/lib/taxonomy";
import type { AssessmentAttempt, Credential, Interview } from "@/lib/types";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

// ---------------- Interviews ----------------

/** Employer (own job) or recruiter offers up to 3 times; the worker picks one by text link. */
export async function proposeInterview(form: FormData) {
  const s = await requireRole("employer");
  const store = await db();
  const m = await store.table("matches").get(str(form, "matchId"));
  if (!m) return;
  const job = await store.table("jobs").get(m.jobId);
  if (!job || (!isStaffRole(s.role) && job.employerId !== s.employerId)) return;
  if (!["sent", "interview"].includes(m.stage)) return;
  const slots = cleanSlots(form.getAll("slot").map(String), chicagoNow());
  const back = isStaffRole(s.role) ? `/recruiter/jobs/${job.id}` : `/employer/jobs/${job.id}`;
  if (slots.length === 0) redirect(`${back}?err=slots`);
  const mode = (["in_person", "phone", "video"] as const).find((x) => x === str(form, "mode")) ?? "in_person";
  for (const old of (await store.table("interviews").list({ matchId: m.id } as never)).filter((i) => i.status !== "canceled")) {
    await store.table("interviews").upsert({ ...old, status: "canceled", updatedAt: nowISO() });
  }
  const iv: Interview = {
    id: newId(), matchId: m.id, jobId: job.id, workerId: m.workerId, employerId: job.employerId, slots, chosenSlot: null, mode, location: str(form, "location").slice(0, 200),
    status: "proposed", createdBy: s.actor, createdAt: nowISO(), updatedAt: nowISO(),
  };
  await store.table("interviews").upsert(iv);
  await store.table("matches").upsert({ ...m, stage: "interview", notes: [m.notes, `Interview times offered by ${isStaffRole(s.role) ? "recruiter" : "employer"}.`].filter(Boolean).join("\n"), updatedAt: nowISO() });
  await audit(s, "interview.proposed", "interview", iv.id, `Offered ${slots.length} interview time(s) for "${job.title}" to worker ${m.workerId}`);
  const w = await store.table("workers").get(m.workerId);
  if (w?.consentSms) {
    const es = w.lang === "es";
    await sendSms(w.phone, es
      ? `CrewPass: ¡Quieren entrevistarte para "${job.title}"! Escoge un horario: ${appUrl()}/me/interviews/${iv.id}`
      : `CrewPass: They want to interview you for "${job.title}"! Pick a time: ${appUrl()}/me/interviews/${iv.id}`);
  }
  revalidatePath(back);
  redirect(`${back}?interview=sent`);
}

export async function bookInterview(form: FormData) {
  const s = await requireWorker();
  const store = await db();
  const iv = await store.table("interviews").get(str(form, "interviewId"));
  if (!iv || iv.workerId !== s.workerId || iv.status === "canceled") return;
  const slot = str(form, "slot");
  if (!iv.slots.includes(slot) || slot <= chicagoNow()) return;
  const booked = { ...iv, chosenSlot: slot, status: "booked" as const, updatedAt: nowISO() };
  await store.table("interviews").upsert(booked);
  const [job, w] = await Promise.all([store.table("jobs").get(iv.jobId), store.table("workers").get(iv.workerId)]);
  await audit({ role: "worker", actor: s.actor }, "interview.booked", "interview", iv.id, `Worker picked ${slot}`);
  if (job && w) {
    await emailEmployer(iv.employerId, `Interview booked: ${w.name.split(" ")[0]} — ${job.title}`, `${w.name.split(" ")[0]} picked ${slotLabel(slot)} (Central). ${iv.location ? `Where: ${iv.location}. ` : ""}Add it to your calendar: ${appUrl()}/api/interviews/${iv.id}/ics`);
    void fireEmployerWebhook(iv.employerId, "interview.booked", { ...candidatePayload(w, await store.table("credentials").list({ workerId: w.id } as Partial<Credential>), job), interview: { at: slot, timezone: "America/Chicago", mode: iv.mode, location: iv.location } });
  }
  revalidatePath(`/me/interviews/${iv.id}`);
  revalidatePath("/me");
}

export async function cancelInterview(form: FormData) {
  const s = await requireRole("worker", "employer");
  const store = await db();
  const iv = await store.table("interviews").get(str(form, "interviewId"));
  if (!iv) return;
  const mine = s.role === "worker" ? iv.workerId === s.workerId : isStaffRole(s.role) || iv.employerId === s.employerId;
  if (!mine || iv.status === "canceled") return;
  await store.table("interviews").upsert({ ...iv, status: "canceled", updatedAt: nowISO() });
  await audit(s, "interview.canceled", "interview", iv.id, `Interview canceled by ${s.role}`);
  if (s.role === "worker") await emailEmployer(iv.employerId, "Interview canceled", `The candidate canceled their interview. Offer new times from the job page: ${appUrl()}/employer/jobs/${iv.jobId}`);
  else {
    const w = await store.table("workers").get(iv.workerId);
    if (w?.consentSms) await sendSms(w.phone, w.lang === "es" ? "CrewPass: Se canceló tu entrevista. Te avisamos si ofrecen otro horario." : "CrewPass: Your interview was canceled. We'll text you if they offer a new time.");
  }
  revalidatePath(`/me/interviews/${iv.id}`);
  revalidatePath(`/employer/jobs/${iv.jobId}`);
}

// ---------------- ATS connection (employer) ----------------

async function employerOwner() {
  const s = await requireEmployer();
  const { isDemo } = await import("@/lib/db");
  const { employerFor } = await import("@/lib/team");
  const ok = isDemo() || s.role === "admin" || (await employerFor(s.actor))?.role === "owner";
  if (!ok) redirect("/employer/team?err=owner");
  return s;
}

export async function saveAtsWebhook(form: FormData) {
  const s = await employerOwner();
  const store = await db();
  const e = await store.table("employers").get(s.employerId);
  if (!e) return;
  const url = str(form, "url");
  if (url === "") {
    await store.table("employers").upsert({ ...e, atsWebhookUrl: null, atsWebhookSecret: null });
    await audit(s, "ats.disconnected", "employer", e.id, "Removed ATS webhook");
    revalidatePath("/employer/team");
    return;
  }
  const check = isSafeWebhookUrl(url);
  if (!check.ok) redirect(`/employer/team?ats=${encodeURIComponent(check.reason)}`);
  const rotate = str(form, "rotate") === "on" || !e.atsWebhookSecret;
  await store.table("employers").upsert({ ...e, atsWebhookUrl: check.url.toString(), atsWebhookSecret: rotate ? newWebhookSecret() : e.atsWebhookSecret });
  await audit(s, "ats.connected", "employer", e.id, `ATS webhook set to ${check.url.host}${rotate ? " (new signing secret)" : ""}`);
  revalidatePath("/employer/team");
  redirect("/employer/team?ats=saved");
}

export async function testAtsWebhook() {
  const s = await employerOwner();
  const r = await fireEmployerWebhook(s.employerId, "test", { message: "Test event from CrewPass" });
  redirect(`/employer/team?ats=${encodeURIComponent(r ? (r.ok ? `Test delivered (HTTP ${r.status}).` : `Test failed: ${r.error}`) : "Set a webhook URL first.")}`);
}

// ---------------- Skills tests ----------------

export async function startTest(form: FormData) {
  const s = await requireWorker();
  const store = await db();
  const a = ASSESSMENT_BY_ID[str(form, "assessmentId")];
  if (!a) return;
  const mine = await store.table("assessment_attempts").list({ workerId: s.workerId } as Partial<AssessmentAttempt>);
  const now = new Date();
  const unfinished = mine.find((x) => x.assessmentId === a.id && x.kind === "knowledge" && !x.completedAt && now.getTime() - Date.parse(x.startedAt) < TIME_LIMIT_MIN * 60_000);
  if (unfinished) redirect(`/learn/test/${unfinished.id}`);
  const cfg = await getSettings();
  if (nextAttemptAt(mine, a.id, cfg.assessmentRetakeDays, now)) redirect("/learn?wait=1");
  const att: AssessmentAttempt = {
    id: newId(), workerId: s.workerId, assessmentId: a.id, kind: "knowledge", questionIds: drawQuestions(a), answers: null, startedAt: now.toISOString(),
    completedAt: null, score: null, passed: null, proctored: false, assessor: null, note: null,
  };
  await store.table("assessment_attempts").upsert(att);
  redirect(`/learn/test/${att.id}`);
}

export async function submitTest(form: FormData) {
  const s = await requireWorker();
  const store = await db();
  const att = await store.table("assessment_attempts").get(str(form, "attemptId"));
  if (!att || att.workerId !== s.workerId || att.completedAt || att.kind !== "knowledge") redirect("/learn");
  const answers = att.questionIds.map((_, i) => {
    const v = Number(str(form, `q${i}`));
    return Number.isInteger(v) ? v : -1;
  });
  const cfg = await getSettings();
  const g = gradeAttempt(att, answers, new Date(), cfg.assessmentPassPct);
  await store.table("assessment_attempts").upsert({ ...att, answers, completedAt: nowISO(), score: g.score, passed: g.passed, note: g.late ? "Submitted after the time limit" : null });
  await audit({ role: "worker", actor: s.actor }, "test.completed", "assessment", att.id, `${att.assessmentId}: ${g.score}%${g.passed ? " (pass)" : ""}${g.late ? " — late" : ""}`);
  revalidatePath("/learn");
  redirect(`/learn/test/${att.id}`);
}

/** Recruiter or assessor records a hands-on check they watched. */
export async function recordHandsOn(form: FormData) {
  const s = await requireRole("staff");
  const store = await db();
  const a = ASSESSMENT_BY_ID[str(form, "assessmentId")];
  const w = await store.table("workers").get(str(form, "workerId"));
  if (!a || !w) return;
  const passed = str(form, "result") === "pass";
  const at = nowISO();
  const id = newId();
  await store.table("assessment_attempts").upsert({
    id, workerId: w.id, assessmentId: a.id, kind: "hands_on", questionIds: [], answers: null, startedAt: at, completedAt: at, score: passed ? 100 : 0, passed,
    proctored: true, assessor: s.actor, note: str(form, "note").slice(0, 400) || null,
  });
  await audit(s, "test.hands_on", "assessment", id, `Hands-on ${a.title.en}: ${passed ? "pass" : "not yet"} for ${w.name}`);
  revalidatePath(`/recruiter/workers/${w.id}`);
}

// ---------------- Pay sharing ----------------

export async function sharePay(form: FormData) {
  const s = await requireWorker();
  const store = await db();
  const w = await store.table("workers").get(s.workerId);
  const trade = str(form, "trade");
  const hourly = Math.round(Number(str(form, "hourly")) * 100) / 100;
  if (!w || !TRADE_BY_ID[trade] || !plausibleHourly(hourly) || !w.zip) redirect("/pay?shared=bad");
  const mine = (await store.table("pay_reports").list({ workerId: w.id } as never)).find((r) => r.trade === trade);
  await store.table("pay_reports").upsert({ id: mine?.id ?? newId(), workerId: w.id, trade, zip: w.zip, hourly, createdAt: nowISO() });
  revalidatePath("/pay");
  redirect("/pay?shared=1");
}
