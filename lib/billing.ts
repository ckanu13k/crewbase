import "server-only";
import type { Employer, Job, Placement, Worker } from "./types";

export interface InvoiceResult {
  id: string;
  url: string | null;
  simulated: boolean;
}

/**
 * Bills the placement fee once the hire reaches day 30. Uses Stripe Invoicing (send_invoice, net 15)
 * when STRIPE_SECRET_KEY is set; otherwise returns a simulated invoice id for the demo.
 */
export async function createPlacementInvoice(p: Placement, employer: Employer, job: Job, worker: Worker): Promise<InvoiceResult> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { id: `demo_inv_${p.id.slice(0, 8)}`, url: null, simulated: true };
  }
  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const existing = employer.email ? await stripe.customers.list({ email: employer.email, limit: 1 }) : null;
  const customer =
    existing?.data[0] ??
    (await stripe.customers.create({ name: employer.name, email: employer.email || undefined, phone: employer.phone || undefined, metadata: { employerId: employer.id } }));

  const invoice = await stripe.invoices.create({
    customer: customer.id,
    collection_method: "send_invoice",
    days_until_due: 15,
    auto_advance: false,
    description: `Direct-hire placement: ${job.title}`,
    metadata: { placementId: p.id, jobId: job.id, workerId: worker.id },
  });
  await stripe.invoiceItems.create({
    customer: customer.id,
    invoice: invoice.id,
    amount: Math.round(p.fee * 100),
    currency: "usd",
    description: `Placement fee — ${worker.name}, ${job.title}, start ${p.startDate}. 90-day replacement guarantee through ${p.guaranteeEndsOn}.`,
  });
  const finalized = await stripe.invoices.finalizeInvoice(invoice.id!);
  await stripe.invoices.sendInvoice(finalized.id!);
  return { id: finalized.id!, url: finalized.hosted_invoice_url ?? null, simulated: false };
}
