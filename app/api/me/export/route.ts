// "Download my data": everything CrewPass holds about the signed-in worker, as JSON.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import type { Credential, Match, Placement, Screening } from "@/lib/types";

export async function GET() {
  const s = await getSession();
  if (s?.role !== "worker" || !s.workerId) return new NextResponse("Not found", { status: 404 });
  const store = await db();
  const worker = await store.table("workers").get(s.workerId);
  if (!worker) return new NextResponse("Not found", { status: 404 });
  const [credentials, matches, screenings, placements, sessions, outbox, jobs, employers] = await Promise.all([
    store.table("credentials").list({ workerId: worker.id } as Partial<Credential>),
    store.table("matches").list({ workerId: worker.id } as Partial<Match>),
    store.table("screenings").list({ workerId: worker.id } as Partial<Screening>),
    store.table("placements").list({ workerId: worker.id } as Partial<Placement>),
    store.table("onboarding_sessions").list(),
    store.table("outbox").list(),
    store.table("jobs").list(),
    store.table("employers").list(),
  ]);
  const by = { workerId: worker.id } as never;
  const [assignments, timesheets, payouts, ratings, tests, interviews, payReports] = await Promise.all([
    store.table("assignments").list(by), store.table("timesheets").list(by), store.table("payouts").list(by), store.table("ratings").list(by),
    store.table("assessment_attempts").list(by), store.table("interviews").list(by), store.table("pay_reports").list(by),
  ]);
  const J = Object.fromEntries(jobs.map((j) => [j.id, j.title]));
  const E = Object.fromEntries(employers.map((e) => [e.id, e.name]));
  const body = {
    exportedAt: new Date().toISOString(),
    note: "Card photos are listed by file name; download them from the Cards screen. Screening reports are held by the screening company, not CrewPass.",
    profile: worker,
    cards: credentials,
    jobsYouWerePutForwardFor: matches.map((m) => ({ job: J[m.jobId], stage: m.stage, score: m.score, updatedAt: m.updatedAt })),
    screenings: screenings.map((x) => ({ kind: x.kind, employer: E[x.employerId], job: J[x.jobId], status: x.status, authorizedAt: x.consentAt, resultAt: x.completedAt, goodThrough: x.expiresOn, preAdverseNoticeAt: x.preAdverseAt, finalNoticeAt: x.finalAdverseAt })),
    placements: placements.map((p) => ({ job: J[p.jobId], employer: E[p.employerId], startDate: p.startDate, status: p.status })),
    tempAssignments: assignments.map((a) => ({ job: J[a.jobId], employer: E[a.employerId], startDate: a.startDate, endDate: a.endDate, payRate: a.payRate, perDiem: a.perDiem, status: a.status })),
    timesheets: timesheets.map((t) => ({ date: t.date, clockIn: t.clockIn, clockOut: t.clockOut, breakMinutes: t.breakMinutes, hours: t.hours, attendance: t.attendance, status: t.status, note: t.note })),
    earlyPay: payouts.map((p) => ({ amount: p.amount, speed: p.speed, status: p.status, sentAt: p.sentAt })),
    ratingsSummary: { count: ratings.length, averageQuality: ratings.length ? ratings.reduce((a, r) => a + r.quality, 0) / ratings.length : null, averageSafety: ratings.length ? ratings.reduce((a, r) => a + r.safety, 0) / ratings.length : null },
    skillsTests: tests.map((t) => ({ test: t.assessmentId, kind: t.kind, score: t.score, passed: t.passed, completedAt: t.completedAt, assessor: t.assessor })),
    interviews: interviews.map((i) => ({ job: J[i.jobId], status: i.status, time: i.chosenSlot, location: i.location })),
    payYouShared: payReports.map((r) => ({ trade: r.trade, hourly: r.hourly, sharedAt: r.createdAt })),
    signupConversation: sessions.filter((x) => x.workerId === worker.id),
    messagesWeSentYou: outbox.filter((m) => m.to === worker.phone || (worker.email && m.to === worker.email)),
  };
  await audit(s, "worker.exported", "worker", worker.id, "Worker downloaded their data");
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="crewpass-my-data.json"`, "Cache-Control": "no-store" },
  });
}
