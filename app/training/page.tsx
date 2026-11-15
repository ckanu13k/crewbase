import Link from "next/link";
import { CalendarDays, Clock, DollarSign, Languages, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { db, todayISO } from "@/lib/db";
import { getLang, getSession } from "@/lib/session";
import { PageHeader, Shell, workerNav } from "@/components/Shell";
import { LocationBar } from "@/components/LocationBar";
import { t } from "@/lib/i18n";
import { AREAS } from "@/lib/geo";
import { getUserLocation } from "@/lib/location";
import { evaluateMatch } from "@/lib/matching";
import { TRADES, credShort, skillLabel } from "@/lib/taxonomy";
import { FUNDING_LABEL, money, rankTrainingNear } from "@/lib/training";
import type { Credential, Funding, Job } from "@/lib/types";
import type { Gap } from "@/lib/matching";

const RADII = [10, 25, 50, 0];

export default async function Training({ searchParams }: { searchParams: Promise<{ trade?: string; funding?: string; es?: string; r?: string }> }) {
  const sp = await searchParams;
  const lang = await getLang();
  const session = await getSession();
  const es = lang === "es";
  const today = todayISO();
  const store = await db();

  const [allPrograms, jobs] = await Promise.all([store.table("training_programs").list(), store.table("jobs").list({ status: "open" } as Partial<Job>)]);
  const worker = session?.role === "worker" && session.workerId ? await store.table("workers").get(session.workerId) : null;
  const loc = await getUserLocation(worker);
  const radius = sp.r !== undefined && RADII.includes(Number(sp.r)) ? Number(sp.r) : worker?.radiusMiles || 25;

  // A signed-in worker's blocking gaps on jobs in their trade near them.
  let myGaps: Gap[] = [];
  if (worker) {
    const creds = await store.table("credentials").list({ workerId: worker.id } as Partial<Credential>);
    for (const j of jobs) {
      if (j.trade !== worker.trade) continue;
      const r = evaluateMatch(worker, creds, j, today);
      if (!r.eligible) myGaps.push(...r.gaps.filter((g) => g.blocking));
    }
    myGaps = myGaps.filter((g, i) => myGaps.findIndex((x) => x.kind === g.kind && x.credential === g.credential && x.skill === g.skill) === i);
  }

  let programs = allPrograms.filter((p) => p.status !== "pending");
  if (sp.trade) programs = programs.filter((p) => p.trade === sp.trade || p.trade === null);
  if (sp.funding) programs = programs.filter((p) => p.funding.includes(sp.funding as Funding));
  if (sp.es) programs = programs.filter((p) => p.languages.includes("es"));
  const ranked = rankTrainingNear({ programs, jobs, from: loc?.point ?? null, radiusMiles: radius, today, myGaps }).slice(0, 10);
  const radiusText = radius === 0 ? (es ? "en cualquier distancia" : "at any distance") : es ? `a ${radius} millas` : `within ${radius} miles`;

  return (
    <Shell lang={lang} nav={session?.role === "worker" ? workerNav(lang) : undefined} back="/training">
      <PageHeader
        eyebrow={es ? "Capacitación" : "Training"}
        title={es ? "Las mejores clases cerca de ti" : "Top trainings near you"}
        subtitle={
          es
            ? "Ordenadas por cuántos trabajos abiertos cerca de ti piden lo que enseñan. Se actualiza solo cuando los empleadores cambian sus requisitos."
            : "Ranked by how many open jobs near you ask for what they teach. Updates on its own when employers change their requirements."
        }
      />
      <LocationBar lang={lang} label={loc?.label ?? null} areas={AREAS} />

      <form className="card mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <select name="r" defaultValue={String(radius)} className="input" aria-label={es ? "Distancia" : "Distance"}>
          {RADII.map((r) => <option key={r} value={r}>{r === 0 ? (es ? "Cualquier distancia" : "Any distance") : `${r} mi`}</option>)}
        </select>
        <select name="trade" defaultValue={sp.trade ?? ""} className="input" aria-label={es ? "Oficio" : "Trade"}>
          <option value="">{t(lang, "allTrades")}</option>
          {TRADES.map((x) => <option key={x.id} value={x.id}>{x.label[lang]}</option>)}
        </select>
        <select name="funding" defaultValue={sp.funding ?? ""} className="input" aria-label={es ? "Pago" : "Funding"}>
          <option value="">{t(lang, "anyFunding")}</option>
          {(Object.keys(FUNDING_LABEL) as Funding[]).map((f) => <option key={f} value={f}>{FUNDING_LABEL[f][lang]}</option>)}
        </select>
        <label className="flex items-center gap-2 px-2 text-sm max-sm:col-span-2">
          <input type="checkbox" name="es" value="1" defaultChecked={Boolean(sp.es)} /> {t(lang, "spanishOnly")}
        </label>
        <button className="btn-primary max-sm:col-span-2">{es ? "Filtrar" : "Filter"}</button>
      </form>

      <ol className="space-y-3">
        {ranked.map(({ program: p, miles, openingsUnlocked, closesMyGaps, inRange }, i) => (
          <li key={p.id} className="space-y-3">
            {!inRange && (i === 0 || ranked[i - 1].inRange) && (
              <div className="px-1 pt-2 text-sm font-semibold text-slate-500" data-testid="farther">
                {i === 0
                  ? es ? `No hay clases ${radiusText}. Las más útiles un poco más lejos:` : `No classes ${radiusText}. The most useful ones a bit farther away:`
                  : es ? "Más lejos, pero útiles para trabajos cerca de ti:" : "Farther away, but useful for jobs near you:"}
              </div>
            )}
          <div className="card" data-testid="training-card">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-sm font-bold text-white">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-ink">{p.name}</div>
                    <div className="muted flex flex-wrap items-center gap-x-1.5">
                      {p.provider}
                      <span aria-hidden>·</span>
                      <span className="inline-flex items-center gap-1"><MapPin size={13} />{p.city || "—"}{miles !== null && <b className="text-ink" data-testid="training-miles">{` · ${miles} mi`}</b>}</span>
                    </div>
                  </div>
                  {p.sample && <span className="pill bg-slate-100 text-slate-500">{t(lang, "sampleData")}</span>}
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {closesMyGaps > 0 && (
                    <span className="pill bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                      <Sparkles size={12} /> {es ? `Cubre ${closesMyGaps} cosa(s) que te faltan` : `Covers ${closesMyGaps} thing${closesMyGaps > 1 ? "s" : ""} you're missing`}
                    </span>
                  )}
                  <span className={`pill ${openingsUnlocked ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200" : "bg-slate-100 text-slate-500"}`} data-testid="training-openings">
                    {es ? `${openingsUnlocked} puesto(s) abiertos ${radiusText} lo piden` : `${openingsUnlocked} open position${openingsUnlocked === 1 ? "" : "s"} ${radiusText} ask for this`}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-slate-600 sm:grid-cols-4">
                  <div className="flex items-center gap-1.5"><CalendarDays size={14} /> {p.nextStart ?? "—"}</div>
                  <div className="flex items-center gap-1.5"><Clock size={14} /> {p.weeks ? `${p.weeks} ${t(lang, "weeks")}` : "—"}</div>
                  <div className="flex items-center gap-1.5"><DollarSign size={14} /> {money(p.costUsd)}</div>
                  <div className="flex items-center gap-1.5"><Languages size={14} /> {p.languages.map((l) => l.toUpperCase()).join(" / ")}</div>
                </div>

                {(p.coversCredentials.length > 0 || p.coversSkills.length > 0) && (
                  <div className="mt-2 text-xs text-slate-600">
                    <b>{es ? "Te da: " : "Gets you: "}</b>
                    {[...p.coversCredentials.map(credShort), ...p.coversSkills.map((s) => skillLabel(s, lang)), ...(p.nccerLevel ? [`NCCER ${p.nccerLevel}`] : [])].join(" · ")}
                  </div>
                )}
                {p.requirementNote && (
                  <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-700"><ShieldCheck size={13} /> {es ? "Lo que piden hoy" : "What employers ask for now"}</span>
                    {p.reviewedOn && <span className="text-slate-400"> · {es ? "revisado" : "checked"} {p.reviewedOn}</span>}
                    <div className="mt-0.5">{p.requirementNote}</div>
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-1">{p.funding.map((f) => <span key={f} className="pill bg-blue-50 text-blue-700 ring-1 ring-blue-200">{FUNDING_LABEL[f][lang]}</span>)}</div>
                {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-brand-dark underline">{es ? "Más información" : "More info"}</a>}
              </div>
            </div>
          </div>
          </li>
        ))}
        {ranked.length === 0 && (
          <p className="card muted">
            {es ? "No hay clases con esos filtros cerca. Prueba otra distancia." : "No classes match those filters nearby. Try a wider distance."}
          </p>
        )}
      </ol>
      <p className="muted mt-4">
        <Link href="/learn" className="underline">{es ? "Practica con exámenes cortos →" : "Practice with short quizzes →"}</Link>
      </p>
    </Shell>
  );
}
