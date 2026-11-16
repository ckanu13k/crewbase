import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarCheck, CalendarDays, MapPin } from "lucide-react";
import { requireWorker, getLang } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader, Shell, workerNav } from "@/components/Shell";
import { bookInterview, cancelInterview } from "@/app/hiring-actions";
import { chicagoNow, modeLabel, slotLabel } from "@/lib/interviews";

export default async function MyInterview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireWorker();
  const lang = await getLang();
  const es = lang === "es";
  const store = await db();
  const iv = await store.table("interviews").get(id);
  if (!iv || iv.workerId !== s.workerId) notFound();
  const [job, employer] = await Promise.all([store.table("jobs").get(iv.jobId), store.table("employers").get(iv.employerId)]);
  const now = chicagoNow();
  const open = iv.slots.filter((x) => x > now);

  return (
    <Shell lang={lang} nav={workerNav(lang)} back={`/me/interviews/${id}`}>
      <PageHeader eyebrow={employer?.name} title={es ? `Entrevista: ${job?.title}` : `Interview: ${job?.title}`} />
      <div className="card">
        <p className="flex items-center gap-2 text-sm text-slate-600"><MapPin size={15} className="text-brand" />{modeLabel(iv.mode, es)}{iv.location ? ` · ${iv.location}` : ""}</p>
        {iv.status === "booked" && iv.chosenSlot && (
          <div className="mt-3" data-testid="interview-booked">
            <p className="flex items-center gap-2 text-lg font-semibold text-emerald-700"><CalendarCheck size={20} /> {slotLabel(iv.chosenSlot, es)}</p>
            <p className="muted">{es ? "Hora del centro (Houston). Llega 10 minutos antes con tus tarjetas." : "Central time (Houston). Arrive 10 minutes early with your cards."}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={`/api/interviews/${iv.id}/ics`} className="btn-soft btn-sm"><CalendarDays size={15} /> {es ? "Agregar a mi calendario" : "Add to my calendar"}</a>
              <form action={cancelInterview}><input type="hidden" name="interviewId" value={iv.id} /><button className="btn-ghost btn-sm">{es ? "No puedo ir" : "I can't make it"}</button></form>
            </div>
          </div>
        )}
        {iv.status === "proposed" && (
          <form action={bookInterview} className="mt-3 space-y-2" data-testid="interview-slots">
            <input type="hidden" name="interviewId" value={iv.id} />
            <p className="font-semibold">{es ? "Escoge un horario:" : "Pick a time:"}</p>
            {open.map((slot, i) => (
              <label key={slot} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 hover:border-blue-300">
                <input type="radio" name="slot" value={slot} defaultChecked={i === 0} /> {slotLabel(slot, es)}
              </label>
            ))}
            {open.length === 0 ? <p className="muted">{es ? "Ya pasaron estos horarios; pediremos otros." : "These times have passed; we'll ask for new ones."}</p> : <button className="btn-primary w-full">{es ? "Confirmar" : "Confirm"}</button>}
          </form>
        )}
        {iv.status === "canceled" && <p className="mt-3 text-slate-600">{es ? "Esta entrevista se canceló." : "This interview was canceled."}</p>}
      </div>
      <Link href={`/me/jobs/${iv.jobId}`} className="mt-3 inline-block text-sm font-semibold text-brand">{es ? "Ver el trabajo" : "See the job"} →</Link>
    </Shell>
  );
}
