import { NextResponse } from "next/server";
import { db, nowISO, todayISO } from "@/lib/db";
import { kindForPackage, verifyCheckrSignature } from "@/lib/screening/providers";
import { addDays, isOpen, VALID_DAYS } from "@/lib/screening/policy";
import type { Screening } from "@/lib/types";

// Checkr webhook: Account Settings → Webhooks → {APP_URL}/api/screening/checkr
// Subscribe to invitation.completed, report.created and report.completed.
// Stores the outcome only (clear / needs review) and dates; the report stays in Checkr.
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyCheckrSignature(raw, req.headers.get("x-checkr-signature"))) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  const evt = JSON.parse(raw) as { type?: string; data?: { object?: { candidate_id?: string; package?: string; result?: string | null; assessment?: string | null } } };
  const obj = evt.data?.object;
  const kind = kindForPackage(obj?.package);
  if (!evt.type || !obj?.candidate_id || !kind) return NextResponse.json({ ok: true, ignored: true });

  const store = await db();
  const rows = (await store.table("screenings").list({ providerRef: obj.candidate_id } as Partial<Screening>))
    .filter((s) => s.kind === kind && isOpen(s))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const s = rows[0];
  if (!s) return NextResponse.json({ ok: true, unmatched: true });

  if (evt.type === "invitation.completed" || evt.type === "report.created") {
    await store.table("screenings").upsert({ ...s, status: "in_progress", consentAt: s.consentAt ?? nowISO(), orderedAt: s.orderedAt ?? nowISO(), updatedAt: nowISO() });
  } else if (evt.type === "report.completed") {
    // Checkr returns "clear" or "consider" (or an assessment if adjudication rules are set up).
    const clear = obj.result === "clear" || obj.assessment === "eligible";
    const today = todayISO();
    await store.table("screenings").upsert({
      ...s,
      status: clear ? "clear" : "needs_review",
      orderedAt: s.orderedAt ?? nowISO(),
      completedAt: nowISO(),
      expiresOn: clear ? addDays(today, VALID_DAYS[kind]) : null,
      updatedAt: nowISO(),
    });
  }
  return NextResponse.json({ ok: true });
}
