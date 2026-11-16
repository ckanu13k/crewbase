import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole, getLang } from "@/lib/session";
import { isStaffRole } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Shell, employerNav, staffNav } from "@/components/Shell";
import { JobForm } from "@/components/JobForm";
import { getSettings } from "@/lib/settings";
import { CREDENTIALS, SKILLS, TRADES } from "@/lib/taxonomy";

export default async function EditJob({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireRole("employer");
  const lang = await getLang();
  const job = await (await db()).table("jobs").get(id);
  if (!job || (!isStaffRole(s.role) && job.employerId !== s.employerId)) notFound();
  return (
    <Shell lang={lang} nav={isStaffRole(s.role) ? staffNav : employerNav} back={`/employer/jobs/${id}/edit`}>
      <Link href={isStaffRole(s.role) ? `/recruiter/jobs/${id}` : `/employer/jobs/${id}`} className="muted">← Back to the job</Link>
      <h1 className="h1 mb-1 mt-2">Edit job</h1>
      <p className="muted mb-4">Changes re-rank candidates right away. {job.hireType === "temp" ? "Rates for people already on the job stay as agreed." : `The placement fee stays as agreed ($${job.placementFee.toLocaleString()} per hire).`}</p>
      <JobForm
        job={job}
        trades={TRADES.map((t) => ({ id: t.id, label: t.label.en }))}
        credentials={CREDENTIALS.map((c) => ({ id: c.id, label: c.label.en }))}
        skills={SKILLS.map((x) => ({ id: x.id, label: x.label.en, trades: x.trades }))}
        defaultZip={job.zip}
        markupPct={(await getSettings()).tempMarkupPct}
        defaultStart={job.startDate}
      />
    </Shell>
  );
}
