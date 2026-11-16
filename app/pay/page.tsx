import { getLang, getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader, Shell, workerNav } from "@/components/Shell";
import { payStats, type PaySample } from "@/lib/paycompare";
import { getSettings } from "@/lib/settings";
import { TRADES, tradeLabel } from "@/lib/taxonomy";
import { AREAS, areaLabel } from "@/lib/geo";
import { sharePay } from "@/app/hiring-actions";

export default async function PayCompare({ searchParams }: { searchParams: Promise<{ zip?: string; shared?: string }> }) {
  const sp = await searchParams;
  const lang = await getLang();
  const es = lang === "es";
  const s = await getSession();
  const store = await db();
  const isWorker = s?.role === "worker" && Boolean(s.workerId);
  const worker = isWorker ? await store.table("workers").get(s!.workerId!) : null;
  const [jobs, reports] = await Promise.all([store.table("jobs").list(), store.table("pay_reports").list()]);
  const cutoff = new Date(Date.now() - 365 * 86_400_000).toISOString();
  const samples: PaySample[] = [
    ...jobs.filter((j) => j.createdAt >= cutoff && j.payMin > 0).map((j) => ({ trade: j.trade, zip: j.zip, hourly: (j.payMin + Math.max(j.payMax, j.payMin)) / 2, source: "job" as const })),
    ...reports.map((r) => ({ trade: r.trade, zip: r.zip, hourly: r.hourly, source: "worker" as const })),
  ];
  const zip = /^\d{5}$/.test(sp.zip ?? "") ? sp.zip! : sp.zip === "all" ? null : worker?.zip ?? null;
  const cfg = await getSettings();
  const { shown, hidden } = payStats(samples, { minSamples: cfg.payCompareMinSamples, nearZip: zip, radiusMiles: 30 });
  const mineTrade = worker?.trade;

  return (
    <Shell lang={lang} nav={isWorker ? workerNav(lang) : undefined} back="/pay">
      <PageHeader title={es ? "¿Cuánto se paga?" : "What does it pay?"} subtitle={es ? "Pago por hora de trabajos en CrewPass y lo que comparten otros trabajadores, sin nombres." : "Hourly pay from jobs on CrewPass plus what workers share anonymously. No names, ever."} />
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="label">{es ? "Cerca de" : "Near"}</label>
          <select name="zip" defaultValue={zip ?? "all"} className="input">
            <option value="all">{es ? "Toda el área" : "Whole area"}</option>
            {worker?.zip && !AREAS.some((a) => a.zip === worker.zip) && <option value={worker.zip}>{es ? "Mi ZIP" : "My ZIP"} ({worker.zip})</option>}
            {AREAS.map((a) => <option key={a.zip} value={a.zip}>{a.label}</option>)}
          </select>
        </div>
        <button className="btn-soft">{es ? "Ver" : "Show"}</button>
      </form>
      <div className="card overflow-x-auto" data-testid="pay-table">
        <table className="data">
          <thead><tr><th>{es ? "Oficio" : "Trade"}</th><th>{es ? "Mediana" : "Median"}</th><th>{es ? "Rango típico" : "Typical range"}</th><th>{es ? "Datos" : "Samples"}</th></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={4} className="muted">{es ? "Todavía no hay suficientes datos aquí." : "Not enough data here yet."}</td></tr>}
            {shown.map((r) => (
              <tr key={r.trade} className={r.trade === mineTrade ? "bg-brand-soft/60" : ""}>
                <td className="font-semibold">{tradeLabel(r.trade, lang)}</td>
                <td className="font-bold">${r.median.toFixed(2)}</td>
                <td>${r.p25.toFixed(2)} – ${r.p75.toFixed(2)}</td>
                <td className="text-xs text-slate-500">{r.jobs} {es ? "trabajos" : "jobs"} · {r.reports} {es ? "trabajadores" : "workers"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {es ? `Mostramos un oficio solo con ${cfg.payCompareMinSamples}+ datos${zip ? ` dentro de 30 millas de ${areaLabel(zip) ?? zip}` : ""}. ` : `A trade is shown only with ${cfg.payCompareMinSamples}+ samples${zip ? ` within 30 miles of ${areaLabel(zip) ?? zip}` : ""}. `}
        {hidden.length > 0 && (es ? `Con pocos datos aún: ${hidden.map((h) => tradeLabel(h.trade, lang)).join(", ")}.` : `Still collecting: ${hidden.map((h) => tradeLabel(h.trade, lang)).join(", ")}.`)}
        {es ? " Los trabajos usan el punto medio del rango publicado, sin viáticos." : " Jobs use the midpoint of the posted range, not counting per diem."}
      </p>

      {isWorker && (
        <form action={sharePay} className="card mt-6 space-y-2" data-testid="share-pay">
          <h2 className="h2">{es ? "Comparte tu pago (anónimo)" : "Share your pay (anonymous)"}</h2>
          {sp.shared === "1" && <p className="text-sm font-semibold text-emerald-700">{es ? "¡Gracias! Se suma a los datos." : "Thanks! It's now part of the numbers."}</p>}
          {sp.shared === "bad" && <p className="text-sm text-amber-700">{es ? "Revisa el oficio y el pago por hora (y que tu perfil tenga ZIP)." : "Check the trade and hourly pay (and that your profile has a ZIP)."}</p>}
          <div className="grid gap-2 sm:grid-cols-3">
            <select name="trade" defaultValue={worker?.trade ?? ""} className="input" required aria-label={es ? "Oficio" : "Trade"}>
              {TRADES.map((tr) => <option key={tr.id} value={tr.id}>{tr.label[lang]}</option>)}
            </select>
            <input name="hourly" type="number" step="0.25" min="7.25" max="150" placeholder={es ? "$ por hora" : "$ per hour"} className="input" required />
            <button className="btn-primary">{es ? "Compartir" : "Share"}</button>
          </div>
          <p className="text-xs text-slate-500">{es ? "Guardamos solo el oficio, tu ZIP y el pago. Nadie ve quién lo compartió." : "We keep only the trade, your ZIP and the pay. Nobody sees who shared it."}</p>
        </form>
      )}
    </Shell>
  );
}
