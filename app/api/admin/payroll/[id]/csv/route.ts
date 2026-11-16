// Pay-run CSV for the payroll provider. Founder only.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { payRunCsv } from "@/lib/payroll";
import { audit } from "@/lib/audit";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession();
  if (!can(s?.role, "payroll")) return new NextResponse("Not found", { status: 404 });
  const store = await db();
  const run = await store.table("pay_runs").get(id);
  if (!run) return new NextResponse("Not found", { status: 404 });
  const names = Object.fromEntries((await store.table("workers").list()).map((w) => [w.id, w.name]));
  await audit(s, "payroll.exported", "pay_run", id, `Downloaded pay run CSV ${run.periodStart}`);
  return new NextResponse(payRunCsv(run.lines, names, { start: run.periodStart, end: run.periodEnd }), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="payroll-${run.periodStart}.csv"`, "Cache-Control": "no-store" },
  });
}
