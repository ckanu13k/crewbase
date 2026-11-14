import Link from "next/link";
import { db, todayISO } from "@/lib/db";
import { getLang, getSession } from "@/lib/session";
import { Shell, workerNav } from "@/components/Shell";
import { t } from "@/lib/i18n";
import { TRADES, credShort, skillLabel } from "@/lib/taxonomy";
import { FUNDING_LABEL, money, sortPrograms } from "@/lib/training";
import type { Funding } from "@/lib/types";

export default async function Training({ searchParams }: { searchParams: Promise<{ trade?: string; funding?: string; es?: string }> }) {
  const sp = await searchParams;
  const lang = await getLang();
  const session = await getSession();
  const es = lang === "es";
  const today = todayISO();
  let programs = await (await db()).table("training_programs").list();
  if (sp.trade) programs = programs.filter((p) => p.trade === sp.trade || p.trade === null);
  if (sp.funding) programs = programs.filter((p) => p.funding.includes(sp.funding as Funding));
  if (sp.es) programs = programs.filter((p) => p.languages.includes("es"));
  programs = sortPrograms(programs, today);

  return (
    <Shell lang={lang} nav={session?.role === "worker" ? workerNav(lang) : undefined} back="/training">
      <h1 className="h1">{t(lang, "training")}</h1>
      <p className="muted mb-3">
        {es
          ? "Clases cerca de Houston con fechas, costo y formas de pago. WIOA y Workforce Pell se solicitan con tu junta laboral local (Workforce Solutions)."
          : "Classes around Houston with dates, cost and ways to pay. Apply for WIOA or Workforce Pell through your local workforce board (Workforce Solutions)."}
      </p>

      <form className="card mb-4 grid gap-2 sm:grid-cols-4">
        <select name="trade" defaultValue={sp.trade ?? ""} className="input">
          <option value="">{t(lang, "allTrades")}</option>
          {TRADES.map((x) => <option key={x.id} value={x.id}>{x.label[lang]}</option>)}
        </select>
        <select name="funding" defaultValue={sp.funding ?? ""} className="input">
          <option value="">{t(lang, "anyFunding")}</option>
          {(Object.keys(FUNDING_LABEL) as Funding[]).map((f) => <option key={f} value={f}>{FUNDING_LABEL[f][lang]}</option>)}
        </select>
        <label className="flex items-center gap-2 px-2 text-sm">
          <input type="checkbox" name="es" value="1" defaultChecked={Boolean(sp.es)} /> {t(lang, "spanishOnly")}
        </label>
        <button className="btn-primary">{es ? "Filtrar" : "Filter"}</button>
      </form>

      <div className="space-y-2">
        {programs.map((p) => (
          <div key={p.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-bold">{p.name}</div>
                <div className="muted">{p.provider} · {p.city}</div>
              </div>
              {p.sample && <span className="pill bg-slate-100 text-slate-500">{t(lang, "sampleData")}</span>}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1 text-sm sm:grid-cols-4">
              <div><b>{t(lang, "starts")}:</b> {p.nextStart ?? "—"}</div>
              <div><b>{es ? "Duración" : "Length"}:</b> {p.weeks ? `${p.weeks} ${t(lang, "weeks")}` : "—"}</div>
              <div><b>{t(lang, "cost")}:</b> {money(p.costUsd)}</div>
              <div><b>{es ? "Idioma" : "Language"}:</b> {p.languages.map((l) => l.toUpperCase()).join(" / ")}</div>
            </div>
            {(p.coversCredentials.length > 0 || p.coversSkills.length > 0) && (
              <div className="mt-2 text-xs text-slate-600">
                {es ? "Te da: " : "Gets you: "}
                {[...p.coversCredentials.map(credShort), ...p.coversSkills.map((s) => skillLabel(s, lang)), ...(p.nccerLevel ? [`NCCER ${p.nccerLevel}`] : [])].join(" · ")}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-1">{p.funding.map((f) => <span key={f} className="pill bg-blue-50 text-blue-700 ring-1 ring-blue-200">{FUNDING_LABEL[f][lang]}</span>)}</div>
            {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-brand-dark underline">{es ? "Más información" : "More info"}</a>}
          </div>
        ))}
        {programs.length === 0 && <p className="card muted">{es ? "No hay clases con esos filtros." : "No classes match those filters."}</p>}
      </div>
      <p className="muted mt-4">
        <Link href="/learn" className="underline">{es ? "Practica con exámenes cortos →" : "Practice with short quizzes →"}</Link>
      </p>
    </Shell>
  );
}
