import { notFound } from "next/navigation";
import Link from "next/link";
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

  return (
    <Shell lang={lang} nav={workerNav(lang)} back={`/me/jobs/${id}`}>
      <Link href="/me" className="muted">← {t(lang, "jobs")}</Link>
      <div className="card mt-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="h1">{job.title}</h1>
            <p className="muted">{employer?.name}</p>
          </div>
          <ScorePill score={r.score} eligible={r.eligible} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div><b>{es ? "Pago" : "Pay"}:</b> ${job.payMin}–{job.payMax}{t(lang, "perHour")}</div>
          <div><b>{es ? "Turno" : "Shift"}:</b> {shiftLabel(job.shift, lang)}</div>
          <div><b>{t(lang, "starts")}:</b> {job.startDate}</div>
          <div><b>{es ? "Distancia" : "Distance"}:</b> {r.distanceMiles !== null ? `${Math.round(r.distanceMiles)} mi (ZIP ${job.zip})` : `ZIP ${job.zip}`}</div>
          <div><b>{es ? "Oficio" : "Trade"}:</b> {tradeLabel(job.trade, lang)}</div>
          <div><b>{es ? "Puestos" : "Openings"}:</b> {job.headcount}</div>
        </div>
        {job.description && <p className="mt-3 text-sm">{job.description}</p>}
        <div className="mt-3 text-sm">
          <b>{es ? "Requisitos" : "Requirements"}:</b>{" "}
          {job.requiredCredentials.map((c) => credLabel(c, lang)).join(", ")}
          {job.minNccerLevel > 0 && `, NCCER ${es ? "nivel" : "level"} ${job.minNccerLevel}+`}
          {job.minYears > 0 && `, ${job.minYears}+ ${es ? "años" : "yrs"}`}
        </div>
        <div className="mt-1 text-sm"><b>{es ? "Habilidades" : "Skills"}:</b> {job.requiredSkills.map((x) => skillLabel(x, lang)).join(", ")}</div>
      </div>

      <div className="card mt-3">
        <h2 className="h2">{t(lang, "whatYoureMissing")}</h2>
        {r.gaps.filter((g) => g.kind !== "trade").length === 0 ? (
          <p className="mt-1 font-semibold text-emerald-700">✔ {t(lang, "youreReady")}</p>
        ) : (
          <>
            {note !== facts.join(" ") && <p className="mt-1 text-sm text-stone-700">{note}</p>}
            <ul className="mt-2 space-y-1 text-sm">
              {r.gaps.map((g, i) => (
                <li key={i} className={g.blocking ? "font-semibold text-red-700" : "text-stone-700"}>
                  {g.blocking ? "⛔" : "•"} {gapText(g, lang)}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {links.some((l) => l.programs.length) && (
        <div className="mt-3 space-y-2">
          <h2 className="h2">{t(lang, "howToGetIt")}</h2>
          {links.filter((l) => l.programs.length).map((l, i) => (
            <div key={i} className="card">
              <div className="text-sm font-semibold text-stone-500">{gapText(l.gap, lang)}</div>
              {l.programs.map((p) => (
                <div key={p.id} className="mt-2 border-t border-stone-100 pt-2">
                  <div className="font-semibold">{p.name}</div>
                  <div className="muted">{p.provider} · {p.city}{p.sample && <span className="pill ml-1 bg-amber-100 text-amber-800">{t(lang, "sampleData")}</span>}</div>
                  <div className="mt-1 text-sm">
                    {t(lang, "starts")}: <b>{p.nextStart ?? "—"}</b>
                    {p.weeks ? ` · ${p.weeks} ${t(lang, "weeks")}` : ""} · {t(lang, "cost")}: {money(p.costUsd)}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">{p.funding.map((f) => <span key={f} className="pill bg-emerald-50 text-emerald-800">{FUNDING_LABEL[f][lang]}</span>)}</div>
                  {p.url && <a href={p.url} className="mt-1 inline-block text-sm text-brand-dark underline" target="_blank" rel="noreferrer">{es ? "Más información" : "More info"}</a>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="sticky bottom-20 mt-4 sm:bottom-4">
        {mine ? (
          <div className="rounded-lg bg-emerald-600 px-4 py-3 text-center font-semibold text-white">✔ {t(lang, "interestSent")}</div>
        ) : (
          <form action={expressInterest}>
            <input type="hidden" name="jobId" value={job.id} />
            <button className="btn-primary w-full">{t(lang, "interested")}</button>
          </form>
        )}
      </div>
    </Shell>
  );
}
