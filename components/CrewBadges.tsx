// Small badges for temp work, reliability and skills tests. Server-safe (no client code).
import type { Reliability } from "@/lib/reliability";
import { ASSESSMENT_BY_ID, type bestResults } from "@/lib/assessments";
import type { Job, Lang } from "@/lib/types";

export function payText(job: Pick<Job, "payMin" | "payMax">) {
  return job.payMax > job.payMin ? `$${job.payMin}–${job.payMax}/hr` : `$${job.payMin}/hr`;
}

export function HireTypeBadge({ job, lang = "en" }: { job: Pick<Job, "hireType">; lang?: Lang }) {
  const temp = job.hireType === "temp";
  const es = lang === "es";
  return (
    <span className={`pill ${temp ? "bg-violet-50 text-violet-700 ring-1 ring-violet-200" : "bg-slate-100 text-slate-600"}`} data-testid="hire-type">
      {temp ? (es ? "Temporal · pago semanal" : "Temp · weekly pay") : es ? "Contratación directa" : "Direct hire"}
    </span>
  );
}

export function ReliabilityPill({ r, lang = "en" }: { r: Reliability; lang?: Lang }) {
  const es = lang === "es";
  const cls = r.score === null ? "bg-slate-100 text-slate-600" : r.score >= 95 ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : r.score >= 85 ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200" : r.score >= 70 ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200" : "bg-red-50 text-red-700 ring-1 ring-red-200";
  const text = r.score === null ? (es ? `Nuevo · ${r.shifts} turnos` : `New · ${r.shifts} shifts`) : `${es ? "Confiable" : "Reliability"} ${r.score} · ${r.shifts} ${es ? "turnos" : "shifts"}`;
  return (
    <span className={`pill ${cls}`} data-testid="reliability" title={r.ratings ? `${r.ratings} rating(s): quality ${r.quality}/5, safety ${r.safety}/5, would rehire ${r.rehirePct}%` : undefined}>
      {text}{r.quality !== null && ` · ★ ${r.quality}`}
    </span>
  );
}

export function TestBadges({ best, lang = "en" }: { best: ReturnType<typeof bestResults>; lang?: Lang }) {
  const es = lang === "es";
  const items = Object.entries(best).filter(([, v]) => v.knowledge?.passed || v.handsOn?.passed);
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1" data-testid="test-badges">
      {items.map(([id, v]) => (
        <span key={id} className="pill bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200" title={v.handsOn?.passed ? `Hands-on check by ${v.handsOn.assessor}` : "In-app test, not proctored"}>
          {ASSESSMENT_BY_ID[id]?.title[lang] ?? id}: {v.handsOn?.passed ? (es ? "práctica ✓" : "hands-on ✓") : ""}{v.handsOn?.passed && v.knowledge?.passed ? " · " : ""}{v.knowledge?.passed ? `${v.knowledge.score}%${es ? " (en app)" : " (in app)"}` : ""}
        </span>
      ))}
    </div>
  );
}
