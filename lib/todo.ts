import "server-only";
// A recruiter's to-do list: generated from their accounts' pipelines, plus personal tasks.
import { db, todayISO } from "./db";
import { KIND_LABEL, businessDaysBetween, canSendFinalNotice, hireGate } from "./screening/policy";
import { getSettings } from "./settings";

export interface TodoItem {
  key: string;
  kind: "screening" | "followup" | "hire" | "placement" | "sourcing" | "cards";
  title: string;
  detail: string;
  href: string;
  urgent: boolean;
}

const daysSince = (iso: string, today: string) => Math.floor((Date.parse(today) - Date.parse(iso.slice(0, 10))) / 86_400_000);

/** employerIds = the accounts in scope (null = all). */
export async function generatedTodos(employerIds: Set<string> | null): Promise<TodoItem[]> {
  const store = await db();
  const today = todayISO();
  const cfg = await getSettings();
  const [jobs, matches, screenings, placements, workers, creds] = await Promise.all([
    store.table("jobs").list(), store.table("matches").list(), store.table("screenings").list(),
    store.table("placements").list(), store.table("workers").list(), store.table("credentials").list(),
  ]);
  const inScope = (employerId: string) => !employerIds || employerIds.has(employerId);
  const J = Object.fromEntries(jobs.map((j) => [j.id, j]));
  const W = Object.fromEntries(workers.map((w) => [w.id, w.name]));
  const out: TodoItem[] = [];

  for (const s of screenings.filter((x) => inScope(x.employerId))) {
    const who = W[s.workerId] ?? "worker", job = J[s.jobId]?.title ?? "job", kind = KIND_LABEL[s.kind].en.toLowerCase();
    if (s.status === "needs_review") out.push({ key: `scr-r-${s.id}`, kind: "screening", title: `Review flagged ${kind} — ${who}`, detail: job, href: "/recruiter/screenings", urgent: true });
    if (s.status === "pre_adverse" && canSendFinalNotice(s, today, cfg.adverseWaitDays)) out.push({ key: `scr-f-${s.id}`, kind: "screening", title: `Final notice now allowed — ${who}`, detail: `${kind} · ${job}`, href: "/recruiter/screenings", urgent: true });
    if (s.status === "awaiting_consent" && businessDaysBetween(s.createdAt, today) >= 2) out.push({ key: `scr-c-${s.id}`, kind: "screening", title: `Nudge ${who} to authorize the ${kind}`, detail: `Waiting ${daysSince(s.createdAt, today)} days · ${job}`, href: `/recruiter/workers/${s.workerId}`, urgent: false });
  }
  for (const m of matches) {
    const job = J[m.jobId];
    if (!job || !inScope(job.employerId)) continue;
    if (m.stage === "sent" && daysSince(m.updatedAt, today) >= 3) out.push({ key: `fu-${m.id}`, kind: "followup", title: `Follow up with the employer on ${W[m.workerId] ?? "a candidate"}`, detail: `Sent ${daysSince(m.updatedAt, today)} days ago · ${job.title}`, href: `/recruiter/jobs/${job.id}`, urgent: false });
    if (m.stage === "interview") {
      const gate = hireGate(job, screenings.filter((x) => x.workerId === m.workerId), today);
      out.push(gate.ok
        ? { key: `hire-${m.id}`, kind: "hire", title: `Ready to hire? ${W[m.workerId] ?? "candidate"}`, detail: `Interviewing · ${job.title}`, href: `/recruiter/jobs/${job.id}`, urgent: false }
        : { key: `gate-${m.id}`, kind: "screening", title: `Screening needed before hiring ${W[m.workerId] ?? "candidate"}`, detail: job.title, href: `/recruiter/jobs/${job.id}`, urgent: gate.items.some((i) => i.state === "missing") });
    }
  }
  for (const p of placements.filter((x) => inScope(x.employerId) && x.status === "active" && x.day30Date <= today)) {
    out.push({ key: `p30-${p.id}`, kind: "placement", title: `Confirm ${W[p.workerId] ?? "worker"} is still on the job`, detail: `Day ${cfg.feeDueDay} was ${p.day30Date} · ${J[p.jobId]?.title ?? ""}`, href: "/recruiter/placements", urgent: true });
  }
  for (const j of jobs.filter((x) => x.status === "open" && inScope(x.employerId))) {
    const ms = matches.filter((m) => m.jobId === j.id);
    const hired = ms.filter((m) => m.stage === "hired").length;
    const startsIn = -daysSince(j.startDate, today);
    if (hired < j.headcount && startsIn <= 10 && ms.filter((m) => m.stage !== "rejected").length < (j.headcount - hired) * 2) {
      out.push({ key: `src-${j.id}`, kind: "sourcing", title: `Find candidates: ${j.title}`, detail: `Starts ${startsIn <= 0 ? "now" : `in ${startsIn} days`} · ${hired}/${j.headcount} filled`, href: `/recruiter/jobs/${j.id}`, urgent: startsIn <= 5 });
    }
  }
  const toReview = creds.filter((c) => c.needsReview || c.verification === "document").length;
  if (toReview) out.push({ key: "cards", kind: "cards", title: `${toReview} card(s) waiting for review`, detail: "Shared queue for the whole team", href: "/recruiter/review", urgent: false });
  return out.sort((a, b) => Number(b.urgent) - Number(a.urgent));
}

/** Accounts assigned to a team member; null if they have none (then they see everything). */
export async function myEmployerIds(memberId: string | null): Promise<Set<string> | null> {
  if (!memberId) return null;
  const mine = (await (await db()).table("employers").list()).filter((e) => e.recruiterId === memberId);
  return mine.length ? new Set(mine.map((e) => e.id)) : null;
}
