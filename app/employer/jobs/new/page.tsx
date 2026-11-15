import { requireRole, getLang } from "@/lib/session";
import { isStaffRole } from "@/lib/permissions";
import { db, todayISO } from "@/lib/db";
import { Shell, employerNav, staffNav } from "@/components/Shell";
import { JobForm } from "@/components/JobForm";
import { CREDENTIALS, SKILLS, TRADES } from "@/lib/taxonomy";

export default async function NewJob() {
  const s = await requireRole("employer");
  const lang = await getLang();
  const store = await db();
  const employers = await store.table("employers").list();
  const mine = employers.find((e) => e.id === s.employerId);
  const start = new Date(Date.parse(todayISO()) + 14 * 86_400_000).toISOString().slice(0, 10);
  return (
    <Shell lang={lang} nav={isStaffRole(s.role) ? staffNav : employerNav} back="/employer/jobs/new">
      <h1 className="h1 mb-1">Post a job</h1>
      <p className="muted mb-4">We rank every verified worker against this in seconds. A recruiter sends you a shortlist within 48 hours.</p>
      <JobForm
        trades={TRADES.map((t) => ({ id: t.id, label: t.label.en }))}
        credentials={CREDENTIALS.map((c) => ({ id: c.id, label: c.label.en }))}
        skills={SKILLS.map((x) => ({ id: x.id, label: x.label.en, trades: x.trades }))}
        employers={isStaffRole(s.role) ? employers.map((e) => ({ id: e.id, label: e.name })) : undefined}
        defaultZip={mine?.zip ?? ""}
        defaultStart={start}
      />
    </Shell>
  );
}
