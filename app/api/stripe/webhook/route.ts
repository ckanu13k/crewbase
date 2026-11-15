import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import type { Placement } from "@/lib/types";

// Stripe → Developers → Webhooks → {APP_URL}/api/stripe/webhook, event: invoice.paid.
// Marks placement invoices paid automatically. Needs STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!process.env.STRIPE_SECRET_KEY || !secret) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const raw = await req.text();
  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let event: import("stripe").Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }
  if (event.type === "invoice.paid") {
    const inv = event.data.object as { id?: string };
    const store = await db();
    const rows = (await store.table("placements").list({ invoiceId: inv.id } as Partial<Placement>)).filter((p) => p.status === "invoiced");
    for (const p of rows) {
      await store.table("placements").upsert({ ...p, status: "paid" });
      await audit({ role: "system", actor: "stripe" } as never, "placement.paid", "placement", p.id, `Stripe reported invoice ${inv.id} paid`);
    }
  }
  return NextResponse.json({ received: true });
}
