// Hours-based benefit eligibility. Pure functions, tested in newfeatures.test.ts.
// The ACA treats someone averaging 30+ hours a week (130 hours a month) as full-time; an employer with 50+
// full-time-equivalent employees must offer them coverage. We track each temp worker's monthly hours from
// approved timesheets so they (and we) can see where they stand.

import { paidHours } from "./payroll";
import type { BenefitKind, Lang, Timesheet } from "./types";

export const ACA_MONTHLY_HOURS = 130;

export function monthlyHours(timesheets: Pick<Timesheet, "date" | "hours" | "attendance" | "status">[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of timesheets) {
    if (t.status !== "approved") continue;
    const m = t.date.slice(0, 7);
    out[m] = Math.round(((out[m] ?? 0) + paidHours(t)) * 100) / 100;
  }
  return out;
}

/** Average monthly hours over the last `months` calendar months ending with `thisMonth` (YYYY-MM), counting empty months as 0. */
export function averageHours(byMonth: Record<string, number>, thisMonth: string, months = 3): number {
  let [y, m] = thisMonth.split("-").map(Number);
  let sum = 0;
  for (let i = 0; i < months; i++) {
    sum += byMonth[`${y}-${String(m).padStart(2, "0")}`] ?? 0;
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return Math.round((sum / months) * 10) / 10;
}

export const BENEFIT_KIND_LABEL: Record<BenefitKind, Record<Lang, string>> = {
  workers_comp: { en: "Workers' compensation", es: "Seguro de accidentes de trabajo (workers' comp)" },
  occupational_accident: { en: "Occupational accident", es: "Accidentes ocupacionales" },
  health: { en: "Health coverage", es: "Seguro médico" },
  dental_vision: { en: "Dental and vision", es: "Dental y visión" },
  paid_time_off: { en: "Paid time off", es: "Tiempo libre pagado" },
  retirement: { en: "Retirement savings", es: "Ahorro para el retiro" },
  other: { en: "Other", es: "Otro" },
};
