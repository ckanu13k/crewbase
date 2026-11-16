import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { requireWorker, getLang } from "@/lib/session";
import { db } from "@/lib/db";
import { Shell, workerNav } from "@/components/Shell";
import { TestTimer } from "@/components/TestTimer";
import { submitTest } from "@/app/hiring-actions";
import { ASSESSMENT_BY_ID, TIME_LIMIT_MIN } from "@/lib/assessments";
import { getSettings } from "@/lib/settings";

export default async function TakeTest({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireWorker();
  const lang = await getLang();
  const es = lang === "es";
  const att = await (await db()).table("assessment_attempts").get(id);
  if (!att || att.workerId !== s.workerId || att.kind !== "knowledge") notFound();
  const a = ASSESSMENT_BY_ID[att.assessmentId];
  if (!a) notFound();
  const cfg = await getSettings();
  const qs = att.questionIds.map((qid) => a.questions.find((q) => q.id === qid)!).filter(Boolean);
  const deadline = new Date(Date.parse(att.startedAt) + TIME_LIMIT_MIN * 60_000).toISOString();

  if (att.completedAt) {
    return (
      <Shell lang={lang} nav={workerNav(lang)} back={`/learn/test/${id}`}>
        <div className="card text-center" data-testid="test-result">
          {att.passed ? <CheckCircle2 className="mx-auto text-emerald-600" size={40} /> : <XCircle className="mx-auto text-amber-600" size={40} />}
          <h1 className="h1 mt-2">{a.title[lang]}: {att.score}%</h1>
          <p className="mt-1 text-slate-600">
            {att.passed
              ? es ? "¡Aprobaste! Los empleadores verán este resultado junto a tu perfil." : "You passed! Employers will see this result next to your profile."
              : es ? `Necesitas ${cfg.assessmentPassPct}% para aprobar. Practica y vuelve a intentarlo en ${cfg.assessmentRetakeDays} días.` : `You need ${cfg.assessmentPassPct}% to pass. Practice and try again in ${cfg.assessmentRetakeDays} days.`}
          </p>
          {att.note && <p className="mt-1 text-sm text-amber-700">{att.note}</p>}
          <p className="mt-2 text-xs text-slate-500">{es ? "No mostramos las respuestas para que la prueba siga siendo justa para todos." : "We don't show the answers, so the test stays fair for everyone."}</p>
          <Link href="/learn" className="btn-primary mt-4">{es ? "Volver" : "Back to tests"}</Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell lang={lang} nav={workerNav(lang)} back={`/learn/test/${id}`}>
      <div className="sticky top-16 z-20 mb-3 flex items-center justify-between rounded-xl bg-white/90 px-1 py-2 backdrop-blur">
        <h1 className="h2">{a.title[lang]}</h1>
        <TestTimer deadline={deadline} formId="test-form" label={es ? "Quedan" : "Time left"} />
      </div>
      <form id="test-form" action={submitTest} className="space-y-3">
        <input type="hidden" name="attemptId" value={att.id} />
        {qs.map((q, i) => (
          <fieldset key={q.id} className="card" data-testid="test-question">
            <legend className="mb-2 font-semibold">{i + 1}. {q.q[lang]}</legend>
            <div className="space-y-1.5">
              {q.options.map((opt, j) => (
                <label key={j} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                  <input type="radio" name={`q${i}`} value={j} className="mt-1" /> <span>{opt[lang]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <button className="btn-primary w-full" data-testid="submit-test">{es ? "Entregar prueba" : "Submit test"}</button>
      </form>
    </Shell>
  );
}
