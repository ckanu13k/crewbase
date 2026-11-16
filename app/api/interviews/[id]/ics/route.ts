// Calendar file for a booked interview. Only the worker, the employer, or our team can download it.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { isStaffRole } from "@/lib/permissions";
import { interviewIcs } from "@/lib/interviews";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession();
  const store = await db();
  const iv = await store.table("interviews").get(id);
  const allowed = s && iv && (isStaffRole(s.role) || (s.role === "worker" && s.workerId === iv.workerId) || (s.role === "employer" && s.employerId === iv.employerId));
  if (!iv || !allowed || iv.status !== "booked" || !iv.chosenSlot) return new NextResponse("Not found", { status: 404 });
  const [job, worker] = await Promise.all([store.table("jobs").get(iv.jobId), store.table("workers").get(iv.workerId)]);
  const who = s.role === "worker" ? "" : ` with ${worker?.name.split(" ")[0] ?? "candidate"}`;
  return new NextResponse(interviewIcs(iv, `Interview: ${job?.title ?? "job"}${who}`), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="interview.ics"`, "Cache-Control": "no-store" },
  });
}
