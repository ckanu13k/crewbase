import Link from "next/link";
import { BadgeDollarSign, CalendarDays, ChevronRight, Clock, HeartPulse, LogIn, LogOut, ShieldCheck, Zap } from "lucide-react";
import { requireWorker, getLang } from "@/lib/session";
import { db, todayISO } from "@/lib/db";
import { PageHeader, Shell, workerNav } from "@/components/Shell";
import { ReliabilityPill, payText } from "@/components/CrewBadges";
import { callOff, clockIn, clockOut, saveMyTimesheet, setPayoutSpeed } from "@/app/crew-actions";
import { addDaysISO, computeWeek, weekStart } from "@/lib/payroll";
import { reliability } from "@/lib/reliability";
import { money } from "@/lib/training";
import { chicagoNow } from "@/lib/interviews";
import type { Assignment, Timesheet } from "@/lib/types";

const STATUS = {
  open: { en: "On the clock", es: "Trabajando" },
  submitted: { en: "Waiting for approval", es: "Esperando aprobación" },
  approved: { en: "Approved", es: "Aprobado" },
  disputed: { en: "Questioned — your recruiter will call", es: "En revisión — tu reclutador te llamará" },
};
const ATT = { worked: { en: "", es: "" }, late: { en: "Late", es: "Tarde" }, no_show: { en: "No-show", es: "No se presentó" }, called_off: { en: "Called off", es: "Avisó que no iba" } };

export default async function MyWork() {
  const s = await requireWorker();
  const lang = await getLang();
  const es = lang === "es";
  const store = await db();
  const today = todayISO();
  const by = { workerId: s.workerId } as never;
  const [worker, assignments, timesheets, payouts, runs, ratings, jobs, employers] = await Promise.all([
    store.table("workers").get(s.workerId),
    store.table("assignments").list(by),
    store.table("timesheets").list(by),
    store.table("payouts").list(by),
    store.table("pay_runs").list(),
    store.table("ratings").list(by),
    store.table("jobs").list(),
    store.table("employers").list(),
  ]);
  const J = Object.fromEntries(jobs.map((j) => [j.id, j]));
  const E = Object.fromEntries(employers.map((e) => [e.id, e.name]));
  const active = assignments.filter((a: Assignment) => a.status === "active");
  const wk = weekStart(today);
  const thisWeek = timesheets.filter((t) => t.date >= wk && t.date <= addDaysISO(wk, 6)).sort((a, b) => b.date.localeCompare(a.date));
  const recent = timesheets.filter((t) => t.date < wk).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  const estimate = computeWeek(thisWeek, assignments, payouts).lines[0];
  const myRuns = runs.filter((r) => r.status !== "draft").map((r) => ({ r, l: r.lines.find((l) => l.workerId === s.workerId) })).filter((x) => x.l).sort((a, b) => b.r.periodStart.localeCompare(a.r.periodStart));
  const rel = reliability(timesheets, ratings);
  const speed = worker?.payoutSpeed ?? "weekly";
  const onClock = (a: Assignment) => timesheets.find((t) => t.assignmentId === a.id && t.status === "open" && t.clockIn && !t.clockOut);

  return (
    <Shell lang={lang} nav={workerNav(lang)} back="/me/work">
      <PageHeader title={es ? "Trabajo y pago" : "Work & pay"} subtitle={es ? "Tus trabajos temporales, horas y pagos." : "Your temp assignments, hours and pay."} />

      {assignments.length === 0 && (
        <div className="card">
          <p className="text-slate-600">{es ? "Aún no tienes trabajos temporales. En los trabajos temporales CrewPass te paga cada semana, o el mismo día si quieres." : "No temp assignments yet. On temp jobs CrewPass pays you every week — or the same day if you prefer."}</p>
          <Link href="/me" className="btn-primary mt-3">{es ? "Ver trabajos" : "See jobs"}</Link>
        </div>
      )}

      {active.map((a) => {
        const job = J[a.jobId];
        const open = onClock(a);
        return (
          <div key={a.id} className="card mb-4" data-testid="assignment">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-lg font-semibold">{job?.title}</div>
                <div className="text-sm text-slate-500">{E[a.employerId]} · ZIP {job?.zip}</div>
              </div>
              <span className="pill bg-violet-50 text-violet-700 ring-1 ring-violet-200">{es ? "Temporal" : "Temp"}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <span className="chip"><BadgeDollarSign size={13} className="text-brand" />{payText({ payMin: a.payRate, payMax: a.payRate })}</span>
              {a.perDiem > 0 && <span className="chip">{es ? "Viáticos" : "Per diem"} {money(a.perDiem)}/{es ? "día" : "day"}</span>}
              <span className="chip"><CalendarDays size={13} className="text-brand" />{a.startDate}{a.endDate ? ` → ${a.endDate}` : ""}</span>
              {a.workOrder && <span className="chip">WO {a.workOrder}</span>}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {open ? (
                <form action={clockOut} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="assignmentId" value={a.id} />
                  <span className="text-sm font-semibold text-emerald-700" data-testid="on-clock"><Clock size={14} className="mr-1 inline" />{es ? "Entraste a las" : "Clocked in at"} {open.clockIn}</span>
                  <select name="breakMinutes" defaultValue="30" className="input min-h-10 w-auto py-1 text-sm" aria-label={es ? "Descanso" : "Break"}>
                    {[0, 15, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min {es ? "de descanso" : "break"}</option>)}
                  </select>
                  <button className="btn-primary" data-testid="clock-out"><LogOut size={16} /> {es ? "Marcar salida" : "Clock out"}</button>
                </form>
              ) : a.startDate <= today ? (
                <form action={clockIn}>
                  <input type="hidden" name="assignmentId" value={a.id} />
                  <button className="btn-primary" data-testid="clock-in"><LogIn size={16} /> {es ? "Marcar entrada" : "Clock in"}</button>
                </form>
              ) : null}
              {!open && a.startDate <= today && !timesheets.some((t) => t.assignmentId === a.id && t.date === today) ? (
                <details data-testid="call-off">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-600">{es ? "No puedo ir hoy" : "I can't make it today"}</summary>
                  <form action={callOff} className="mt-2 flex flex-wrap gap-2">
                    <input type="hidden" name="assignmentId" value={a.id} />
                    <input name="reason" maxLength={200} placeholder={es ? "Motivo (opcional)" : "Reason (optional)"} className="input min-h-10 flex-1 py-1 text-sm" />
                    <button className="btn-ghost btn-sm">{es ? "Avisar a la empresa" : "Tell the employer"}</button>
                  </form>
                  <p className="mt-1 text-xs text-slate-500">{es ? "Avisar antes cuenta mejor en tu historial que no presentarte." : "Telling them ahead counts better on your record than not showing up."}</p>
                </details>
              ) : a.startDate > today ? (
                <span className="muted">{es ? `Empieza el ${a.startDate}.` : `Starts ${a.startDate}.`}</span>
              ) : null}
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-brand">{es ? "Agregar o corregir un día" : "Add or fix a day"}</summary>
              <form action={saveMyTimesheet} className="mt-2 grid gap-2 sm:grid-cols-5">
                <input type="hidden" name="assignmentId" value={a.id} />
                <input type="date" name="date" max={today} min={a.startDate} defaultValue={today} className="input" required aria-label={es ? "Fecha" : "Date"} />
                <input type="time" name="clockIn" className="input" required aria-label={es ? "Entrada" : "In"} />
                <input type="time" name="clockOut" className="input" required aria-label={es ? "Salida" : "Out"} />
                <input type="number" name="breakMinutes" min={0} max={240} defaultValue={30} className="input" aria-label={es ? "Descanso (min)" : "Break (min)"} />
                <button className="btn-soft">{es ? "Enviar" : "Submit"}</button>
                <input name="note" placeholder={es ? "Nota (opcional)" : "Note (optional)"} className="input sm:col-span-5" />
              </form>
            </details>
          </div>
        );
      })}

      {assignments.length > 0 && (
        <>
          <h2 className="h2 mb-2 mt-6">{es ? "Turnos recientes" : "Recent shifts"}</h2>
          <div className="card overflow-x-auto">
            <table className="data">
              <thead><tr><th>{es ? "Día" : "Day"}</th><th>{es ? "Entrada / salida" : "In / out"}</th><th>{es ? "Horas" : "Hours"}</th><th>{es ? "Estado" : "Status"}</th></tr></thead>
              <tbody>
                {thisWeek.length === 0 && <tr><td colSpan={4} className="muted">{es ? "Sin horas esta semana." : "No hours yet this week."}</td></tr>}
                {[...thisWeek, ...recent].map((t: Timesheet) => (
                  <tr key={t.id} data-testid="my-timesheet" className={t.date < wk ? "text-slate-500" : ""}>
                    <td>{t.date}</td>
                    <td>{t.clockIn ?? "—"} – {t.clockOut ?? "—"}{t.breakMinutes ? ` (${t.breakMinutes}m)` : ""}</td>
                    <td>{t.hours}{ATT[t.attendance][lang] && <span className="ml-1 text-xs font-semibold text-amber-700">{ATT[t.attendance][lang]}</span>}</td>
                    <td>{STATUS[t.status][lang]}{t.payoutId && <span className="ml-1 text-xs text-emerald-700">· {es ? "pagado rápido" : "paid early"}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {estimate && (
            <p className="mt-2 text-sm text-slate-600" data-testid="week-estimate">
              {es ? "Aprobado esta semana" : "Approved this week"}: <b>{estimate.hours} h</b>{estimate.otHours > 0 && ` (${estimate.otHours} ${es ? "extra" : "overtime"})`} · {es ? "bruto" : "gross"} <b>{money(estimate.gross)}</b>
              {estimate.paidEarly > 0 && ` · ${es ? "ya pagado" : "already paid"} ${money(estimate.paidEarly)}`}{estimate.perDiem > 0 && ` · ${es ? "viáticos" : "per diem"} ${money(estimate.perDiem)}`}
            </p>
          )}

          <h2 className="h2 mb-2 mt-6">{es ? "¿Cuándo quieres tu pago?" : "When do you want to be paid?"}</h2>
          <form action={setPayoutSpeed} className="card space-y-2" data-testid="payout-speed">
            {([
              ["weekly", es ? "Cada semana (viernes)" : "Weekly (Friday)", es ? "Todo junto, una vez por semana." : "Everything at once, once a week."],
              ["next_day", es ? "Al día siguiente" : "Next day", es ? "Cada turno aprobado se deposita al día siguiente." : "Each approved shift is deposited the next day."],
              ["instant", es ? "Al instante" : "Instant", es ? "Cada turno aprobado llega a tu tarjeta en minutos." : "Each approved shift lands on your card within minutes."],
            ] as const).map(([v, label, sub]) => (
              <label key={v} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 ${speed === v ? "border-brand bg-brand-soft" : "border-slate-200"}`}>
                <input type="radio" name="speed" value={v} defaultChecked={speed === v} className="mt-1" />
                <span><span className="font-semibold">{v === "instant" && <Zap size={14} className="mr-1 inline text-amber-500" />}{label}</span><span className="block text-sm text-slate-500">{sub}</span></span>
              </label>
            ))}
            <p className="text-xs text-slate-500">{es ? "Sin costo para ti. Los impuestos se retienen normalmente; tiempo extra y viáticos se pagan el viernes." : "Free for you. Taxes are withheld as usual; overtime and per diem are settled on Friday."}</p>
            {worker?.payrollStatus !== "ready" && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{es ? "Para recibir pagos, completa tus papeles de nómina (W-4, I-9 y depósito). Tu reclutador te manda el enlace." : "To get paid, finish your payroll paperwork (W-4, I-9 and direct deposit). Your recruiter will send the link."}</p>}
            <button className="btn-soft">{es ? "Guardar" : "Save"}</button>
          </form>

          {payouts.length > 0 && (
            <>
              <h3 className="mt-5 mb-1 font-semibold">{es ? "Pagos rápidos" : "Early pay"}</h3>
              <ul className="card divide-y divide-slate-100 py-1 text-sm">
                {payouts.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8).map((p) => (
                  <li key={p.id} className="flex justify-between py-2" data-testid="payout"><span>{chicagoNow(new Date(p.createdAt)).slice(0, 10)} · {p.speed === "instant" ? (es ? "al instante" : "instant") : es ? "al día siguiente" : "next day"}</span><span className="font-semibold">{money(p.amount)} · {p.status === "sent" ? (es ? "enviado" : "sent") : p.status === "failed" ? (es ? "falló" : "failed") : es ? "pendiente" : "pending"}</span></li>
                ))}
              </ul>
            </>
          )}
          {myRuns.length > 0 && (
            <>
              <h3 className="mt-5 mb-1 font-semibold">{es ? "Semanas pagadas" : "Pay weeks"}</h3>
              <ul className="card divide-y divide-slate-100 py-1 text-sm">
                {myRuns.map(({ r, l }) => (
                  <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{r.periodStart} – {r.periodEnd}</span><span>{l!.hours} h · {es ? "bruto" : "gross"} <b>{money(l!.gross)}</b>{l!.perDiem ? ` + ${money(l!.perDiem)} ${es ? "viáticos" : "per diem"}` : ""} · {r.status === "paid" ? (es ? "pagado" : "paid") : es ? "en proceso" : "processing"}</span></li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <h2 className="h2 mb-2 mt-6">{es ? "Tu historial" : "Your track record"}</h2>
      <div className="card">
        <ReliabilityPill r={rel} lang={lang} />
        <p className="mt-2 text-sm text-slate-600">
          {rel.score === null
            ? es ? "Después de 3 turnos verás tu puntaje de confiabilidad. Llegar a tiempo y avisar si no puedes ir lo mantiene alto." : "After 3 shifts you'll see your reliability score. Showing up on time — and calling ahead if you can't — keeps it high."
            : es ? `${rel.shifts} turnos: ${rel.late} tarde, ${rel.noShows} sin avisar, ${rel.calledOff} avisó.` : `${rel.shifts} shifts: ${rel.late} late, ${rel.noShows} no-show, ${rel.calledOff} called off.`}
          {rel.ratings > 0 && (es ? ` Calificación de empleadores: calidad ${rel.quality}/5, seguridad ${rel.safety}/5.` : ` Employer ratings: quality ${rel.quality}/5, safety ${rel.safety}/5.`)}
        </p>
        <p className="mt-1 text-xs text-slate-500">{es ? "¿Algo no está bien? Llama a tu reclutador para revisarlo." : "Something wrong? Call your recruiter to have it reviewed."}</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link href="/me/benefits" className="card card-hover flex items-center gap-3"><HeartPulse className="text-brand" size={22} /><span className="flex-1 font-semibold">{es ? "Beneficios y seguro" : "Benefits & insurance"}</span><ChevronRight size={18} className="text-slate-400" /></Link>
        <Link href="/pay" className="card card-hover flex items-center gap-3"><ShieldCheck className="text-brand" size={22} /><span className="flex-1 font-semibold">{es ? "Compara tu pago" : "Compare your pay"}</span><ChevronRight size={18} className="text-slate-400" /></Link>
      </div>
    </Shell>
  );
}
