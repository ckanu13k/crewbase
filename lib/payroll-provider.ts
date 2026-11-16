import "server-only";
// Moving money for temp payroll. CrewPass computes hours, overtime, per diem and early pay; a payroll
// partner (an embedded-payroll / employer-of-record provider) runs tax withholding, W-2s, deposits and
// instant-pay cards. Until one is connected, live payouts stay "pending" and the founder marks them sent
// after paying through the partner's dashboard. In the demo, early pay is simulated as sent.
import { isDemo, nowISO } from "./db";
import type { Payout } from "./types";

export const payrollPartnerConfigured = () => Boolean(process.env.PAYROLL_PROVIDER && process.env.PAYROLL_API_KEY);

export async function sendEarlyPay(p: Payout): Promise<Payout> {
  if (isDemo()) return { ...p, status: "sent", providerRef: `demo_pay_${p.id.slice(0, 8)}`, sentAt: nowISO() };
  // A partner integration goes here (create an off-cycle payroll for this shift). Not connected yet.
  return p;
}
