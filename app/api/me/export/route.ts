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
    signupConversation: sessions.filter((x) => x.workerId === worker.id),
    messagesWeSentYou: outbox.filter((m) => m.to === worker.phone || (worker.email && m.to === worker.email)),
  };
  await audit(s, "worker.exported", "worker", worker.id, "Worker downloaded their data");
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="crewpass-my-data.json"`, "Cache-Control": "no-store" },
  });
}
