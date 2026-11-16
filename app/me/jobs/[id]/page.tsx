import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, DollarSign, ExternalLink, GraduationCap, HardHat, MapPin, Users, XCircle, Info } from "lucide-react";
import { requireWorker, getLang } from "@/lib/session";
import { db, todayISO } from "@/lib/db";
import { Shell, workerNav } from "@/components/Shell";
import { ScorePill } from "@/components/Badges";
import { t } from "@/lib/i18n";
import { evaluateMatch } from "@/lib/matching";
import { credLabel, skillLabel, tradeLabel } from "@/lib/taxonomy";
import { FUNDING_LABEL, gapText, money, programsForGaps, shiftLabel } from "@/lib/training";
import { explainGaps } from "@/lib/ai/explain";
import { expressInterest } from "@/app/actions";
import { payText } from "@/components/CrewBadges";
import type { Credential, Match } from "@/lib/types";

export default async function WorkerJob({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireWorker();
  const lang = await getLang();
  const es = lang === "es";
  const store = await db();
  const today = todayISO();
  const [job, worker, creds, programs, matches] = await Promise.all([
    store.table("jobs").get(id),
    store.table("workers").get(s.workerId),
    store.table("credentials").list({ workerId: s.workerId } as Partial<Credential>),
    store.table("training_programs").list(),
    store.table("matches").list({ jobId: id } as Partial<Match>),
  ]);
  if (!job || !worker) notFound();
  const employer = await store.table("employers").get(job.employerId);
  const r = evaluateMatch(worker, creds, job, today);
  const links = programsForGaps(r.gaps, programs, today);
  const facts = r.gaps.map((g) => gapText(g, lang));
  const note = await explainGaps(job.title, facts, links.flatMap((l) => l.programs.map((p) => `${p.name} (${p.provider}), starts ${p.nextStart ?? "TBD"}`)), lang);
  const mine = matches.find((m) => m.workerId === worker.id);
  const realGaps = r.gaps.filter((g) => g.kind !== "trade");

  const facts4 = [
    { icon: DollarSign, label: es ? "Pago" : "Pay", value: payText(job) + (job.perDiem ? ` + $${job.perDiem}/${es ? "día" : "day"}` : "") },
    { icon: Clock, label: es ? "Turno" : "Shift", value: shiftLabel(job.shift, lang) },
    { icon: CalendarDays, label: t(lang, "starts"), value: job.startDate },
    { icon: MapPin, label: es ? "Distancia" : "Distance", value: r.distanceMiles !== null ? `${Math.round(r.distanceMiles)} mi` : `ZIP ${job.zip}` },
    { icon: HardHat, label: es ? "Oficio" : "Trade", value: tradeLabel(job.trade, lang) },
    { icon: Users, label: es ? "Puestos" : "Openings", value: String(job.headcount) },
  ];

  return (
    <Shell lang={lang} nav={workerNav(lang)} back={`/me/jobs/${id}`}>
      <Link href="/me" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-ink"><ArrowLeft size={16} /> {t(lang, "jobs")}</Link>

      <div className="card mt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="h1">{job.title}</h1>
            <p className="mt-0.5 text-slate-500">{employer?.name}</p>
          </div>
          <ScorePill score={r.score} eligible={r.eligible} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {facts4.map((f) => (
            <div key={f.label} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-brand shadow-card"><f.icon size={16} /></span>
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{f.label}</div>
                <div className="text-sm leading-snug font-semibold">{f.value}</div>
              </div>
            </div>
          ))}
        </div>
        {job.hireType === "temp" && (
          <div className="mt-4 rounded-xl bg-violet-50 px-3 py-2.5 text-sm text-violet-900 ring-1 ring-violet-200" data-testid="temp-info">
            <b>{es ? "Trabajo temporal con CrewPass." : "Temp job through CrewPass."}</b>{" "}
            {es
              ? `CrewPass es tu empleador: te paga cada semana (o al instante si quieres), con seguro de accidentes de trabajo.${job.endDate ? ` Hasta el ${job.endDate}.` : ""}${job.perDiem ? ` Viáticos de $${job.perDiem} por día trabajado.` : ""}`
              : `CrewPass is your employer: paid weekly (or instantly if you want), with workers' comp coverage.${job.endDate ? ` Runs until ${job.endDate}.` : ""}${job.perDiem ? ` $${job.perDiem} per diem for each day worked.` : ""}`}
          </div>
        )}
        {job.description && <p className="mt-4 text-[15px] text-slate-700">{job.description}</p>}
        <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-4 text-sm">
          <div><span className="font-semibold">{es ? "Requisitos" : "Requirements"}:</span>{" "}
            <span className="text-slate-600">
              {job.requiredCredentials.map((c) => credLabel(c, lang)).join(", ")}
              {job.minNccerLevel > 0 && `, NCCER ${es ? "nivel" : "level"} ${job.minNccerLevel}+`}
              {job.minYears > 0 && `, ${job.minYears}+ ${es ? "años" : "yrs"}`}
            </span>
          </div>
          <div><span className="font-semibold">{es ? "Habilidades" : "Skills"}:</span> <span className="text-slate-600">{job.requiredSkills.map((x) => skillLabel(x, lang)).join(", ")}</span></div>
        </div>
      </div>

      <div className="card mt-4">
        <h2 className="h2">{t(lang, "whatYoureMissing")}</h2>
        {realGaps.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 font-semibold text-emerald-700 ring-1 ring-emerald-200"><CheckCircle2 size={18} /> {t(lang, "youreReady")}</p>
        ) : (
          <>
            {note !== facts.join(" ") && <p className="mt-2 text-[15px] text-slate-700">{note}</p>}
            <ul className="mt-3 space-y-2">
              {r.gaps.map((g, i) => (
                <li key={i} className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-sm ${g.blocking ? "bg-red-50 text-red-800" : "bg-slate-50 text-slate-700"}`}>
                  {g.blocking ? <XCircle size={18} className="mt-px shrink-0" /> : <Info size={18} className="mt-px shrink-0 text-slate-400" />}
                  {gapText(g, lang)}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {links.some((l) => l.programs.length) && (
        <div className="mt-6">
          <h2 className="h2 mb-3 flex items-center gap-2"><GraduationCap size={20} className="text-brand" /> {t(lang, "howToGetIt")}</h2>
          <div className="space-y-3">
            {links.filter((l) => l.programs.length).map((l, i) => (
              <div key={i} className="card">
                <div className="eyebrow">{gapText(l.gap, lang)}</div>
                <div className="mt-2 divide-y divide-slate-100">
                  {l.programs.map((p) => (
                    <div key={p.id} className="py-3 first:pt-1 last:pb-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{p.name}</span>
                        {p.sample && <span className="pill bg-slate-100 text-slate-500">{t(lang, "sampleData")}</span>}
                      </div>
                      <div className="text-sm text-slate-500">{p.provider} · {p.city}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="chip"><CalendarDays size={13} className="text-brand" />{p.nextStart ?? "—"}</span>
                        {p.weeks ? <span className="chip"><Clock size={13} className="text-brand" />{p.weeks} {t(lang, "weeks")}</span> : null}
                        <span className="chip"><DollarSign size={13} className="text-brand" />{money(p.costUsd)}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">{p.funding.map((f) => <span key={f} className="pill bg-blue-50 text-blue-700 ring-1 ring-blue-200">{FUNDING_LABEL[f][lang]}</span>)}</div>
                      {p.url && <a href={p.url} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-dark" target="_blank" rel="noreferrer">{es ? "Más información" : "More info"} <ExternalLink size={14} /></a>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sticky bottom-24 z-20 mt-6 lg:bottom-6">
        {mine ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3.5 font-semibold text-white shadow-lift"><CheckCircle2 size={18} /> {t(lang, "interestSent")}</div>
        ) : (
          <form action={expressInterest}>
            <input type="hidden" name="jobId" value={job.id} />
            <button className="btn-primary w-full py-3 text-base shadow-lift">{t(lang, "interested")}</button>
          </form>
        )}
      </div>
    </Shell>
  );
}
