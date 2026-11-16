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

/** One invoice for an employer's screenings (background checks / drug screens), net 15. */
export async function createScreeningInvoice(
  employer: Employer,
  lines: { id: string; description: string; amountUsd: number }[],
): Promise<InvoiceResult> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { id: `demo_scr_${lines[0]?.id.slice(0, 8) ?? "x"}`, url: null, simulated: true };
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
    description: "Pre-employment screening",
    metadata: { employerId: employer.id, screeningIds: lines.map((l) => l.id).join(",").slice(0, 490) },
  });
  for (const l of lines) {
    await stripe.invoiceItems.create({ customer: customer.id, invoice: invoice.id, amount: Math.round(l.amountUsd * 100), currency: "usd", description: l.description });
  }
  const finalized = await stripe.invoices.finalizeInvoice(invoice.id!);
  await stripe.invoices.sendInvoice(finalized.id!);
  return { id: finalized.id!, url: finalized.hosted_invoice_url ?? null, simulated: false };
}

/** Weekly temp-labor invoice: hours (regular and overtime) plus per diem at cost. Net 15. */
export async function createTempInvoice(
  employer: Employer,
  period: { start: string; end: string; runId: string },
  lines: { description: string; amountUsd: number }[],
): Promise<InvoiceResult> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { id: `demo_tmp_${period.runId.slice(0, 6)}_${employer.id.slice(0, 6)}`, url: null, simulated: true };
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
    description: `Temp labor, week of ${period.start} to ${period.end}`,
    metadata: { employerId: employer.id, payRunId: period.runId },
  });
  for (const l of lines) {
    if (l.amountUsd <= 0) continue;
    await stripe.invoiceItems.create({ customer: customer.id, invoice: invoice.id, amount: Math.round(l.amountUsd * 100), currency: "usd", description: l.description });
  }
  const finalized = await stripe.invoices.finalizeInvoice(invoice.id!);
  await stripe.invoices.sendInvoice(finalized.id!);
  return { id: finalized.id!, url: finalized.hosted_invoice_url ?? null, simulated: false };
}
