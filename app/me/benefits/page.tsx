import { HeartPulse } from "lucide-react";
import { requireWorker, getLang } from "@/lib/session";
import { db, todayISO } from "@/lib/db";
import { PageHeader, Shell, workerNav } from "@/components/Shell";
import { ACA_MONTHLY_HOURS, BENEFIT_KIND_LABEL, averageHours, monthlyHours } from "@/lib/benefits";

export default async function MyBenefits() {
  const s = await requireWorker();
  const lang = await getLang();
  const es = lang === "es";
  const store = await db();
  const [plans, timesheets, assignments] = await Promise.all([
    store.table("benefit_plans").list(),
    store.table("timesheets").list({ workerId: s.workerId } as never),
    store.table("assignments").list({ workerId: s.workerId } as never),
  ]);
  const byMonth = monthlyHours(timesheets);
  const month = todayISO().slice(0, 7);
  const avg = averageHours(byMonth, month, 3);
  const active = plans.filter((p) => p.status === "active");
  const planned = plans.filter((p) => p.status === "planned");

  return (
    <Shell lang={lang} nav={workerNav(lang)} back="/me/benefits">
      <PageHeader title={es ? "Beneficios y seguro" : "Benefits & insurance"} subtitle={es ? "Lo que tienes cuando trabajas en un trabajo temporal con CrewPass." : "What you get while you work temp assignments through CrewPass."} />
      {assignments.length === 0 && <p className="mb-4 rounded-xl bg-brand-soft px-4 py-3 text-sm text-blue-900">{es ? "Estos beneficios aplican en trabajos temporales, donde CrewPass es tu empleador. En contratación directa, la empresa te da sus propios beneficios." : "These apply on temp assignments, where CrewPass is your employer. On direct hires, the company gives you its own benefits."}</p>}
      <div className="space-y-3">
        {active.map((p) => (
          <div key={p.id} className="card" data-testid="benefit">
            <div className="flex items-start gap-3">
              <HeartPulse className="mt-0.5 shrink-0 text-brand" size={20} />
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-slate-500">{BENEFIT_KIND_LABEL[p.kind][lang]}{p.carrier ? ` · ${p.carrier}` : ""}</div>
                <p className="mt-1 text-sm text-slate-700">{p.eligibility}</p>
                <p className="mt-1 text-sm"><b>{es ? "Tu costo" : "Your cost"}:</b> {p.workerCost || "—"}</p>
                {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand underline">{es ? "Detalles del plan" : "Plan details"}</a>}
              </div>
            </div>
          </div>
        ))}
        {active.length === 0 && <p className="card muted">{es ? "Pronto publicaremos los beneficios." : "Benefits will be listed here soon."}</p>}
      </div>
      {planned.length > 0 && <p className="mt-3 text-sm text-slate-500">{es ? "Próximamente" : "Coming"}: {planned.map((p) => p.name).join(", ")}</p>}

      <h2 className="h2 mb-2 mt-6">{es ? "Tus horas" : "Your hours"}</h2>
      <div className="card" data-testid="aca-hours">
        <p className="text-sm text-slate-700">
          {es ? "Promedio de los últimos 3 meses" : "Average over the last 3 months"}: <b>{avg} h/{es ? "mes" : "month"}</b>.{" "}
          {avg >= ACA_MONTHLY_HOURS
            ? es ? "Cuentas como tiempo completo para el seguro médico." : "You count as full-time for health coverage."
            : es ? `Tiempo completo para el seguro médico es ${ACA_MONTHLY_HOURS} h/mes (30 h/semana).` : `Full-time for health coverage is ${ACA_MONTHLY_HOURS} h/month (30 h/week).`}
        </p>
        <ul className="mt-2 flex flex-wrap gap-2 text-xs">
          {Object.entries(byMonth).sort().reverse().slice(0, 6).map(([m, h]) => <li key={m} className="chip">{m}: {h} h</li>)}
        </ul>
        <p className="mt-2 text-xs text-slate-500">{es ? "Si te lastimas en el trabajo, avisa a tu supervisor y a CrewPass el mismo día." : "If you're hurt at work, tell your supervisor and CrewPass the same day."}</p>
      </div>
    </Shell>
  );
}
