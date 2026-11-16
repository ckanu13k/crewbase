// CSV of the candidates shared with an employer for one job, for importing into their ATS.
// Only people a recruiter has sent them; no phone, email or address.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { isStaffRole } from "@/lib/permissions";
import { csvEscape } from "@/lib/webhooks";
import { credShort, tradeLabel } from "@/lib/taxonomy";
import { crewSignals } from "@/lib/crewdata";
import { audit } from "@/lib/audit";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession();
  const store = await db();
  const job = await store.table("jobs").get(id);
  if (!s || !job || !(isStaffRole(s.role) || (s.role === "employer" && s.employerId === job.employerId))) return new NextResponse("Not found", { status: 404 });
  const matches = (await store.table("matches").list({ jobId: id } as never)).filter((m) => ["sent", "interview", "hired", "rejected"].includes(m.stage));
  const [workers, creds, interviews] = await Promise.all([store.table("workers").list(), store.table("credentials").list(), store.table("interviews").list({ jobId: id } as never)]);
  const sig = await crewSignals(matches.map((m) => m.workerId));
  const rows = [["candidate_id", "name", "trade", "years_experience", "language", "stage", "match_score", "verified_cards", "reliability", "interview_at", "profile_link"]];
  for (const m of matches) {
    const w = workers.find((x) => x.id === m.workerId);
    if (!w) continue;
    const [first, last] = w.name.split(" ");
    const iv = interviews.find((i) => i.matchId === m.id && i.status === "booked");
    const r = sig.rel(w.id);
    rows.push([w.id, `${first} ${last?.[0] ?? ""}.`, tradeLabel(w.trade, "en"), String(w.yearsExperience ?? ""), w.lang, m.stage, String(m.score),
      creds.filter((c) => c.workerId === w.id && c.verification === "verified").map((c) => credShort(c.type)).join("; "),
      r.score === null ? "new" : String(r.score), iv?.chosenSlot ?? "", `/employer/jobs/${id}`]);
  }
  await audit(s, "candidates.exported", "job", id, `Exported ${rows.length - 1} candidate(s) as CSV`);
  return new NextResponse(rows.map((r) => r.map(csvEscape).join(",")).join("\n") + "\n", {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="candidates-${id.slice(0, 8)}.csv"`, "Cache-Control": "no-store" },
  });
}
