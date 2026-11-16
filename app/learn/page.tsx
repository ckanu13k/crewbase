import Link from "next/link";
import { BadgeCheck, Timer } from "lucide-react";
import { getLang, getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { Shell, workerNav } from "@/components/Shell";
import { QUIZZES } from "@/lib/quizzes";
import { ASSESSMENTS, QUESTIONS_PER_TEST, TIME_LIMIT_MIN, assessmentsForTrade, bestResults, nextAttemptAt } from "@/lib/assessments";
import { getSettings } from "@/lib/settings";
import { startTest } from "@/app/hiring-actions";
import { t } from "@/lib/i18n";
import type { AssessmentAttempt } from "@/lib/types";

export default async function Learn({ searchParams }: { searchParams: Promise<{ wait?: string }> }) {
  const sp = await searchParams;
  const lang = await getLang();
  const es = lang === "es";
  const s = await getSession();
  const isWorker = s?.role === "worker" && Boolean(s.workerId);
  const store = await db();
  const worker = isWorker ? await store.table("workers").get(s!.workerId!) : null;
  const attempts = isWorker ? await store.table("assessment_attempts").list({ workerId: s!.workerId! } as Partial<AssessmentAttempt>) : [];
  const best = bestResults(attempts);
  const cfg = await getSettings();
  const mine = new Set(assessmentsForTrade(worker?.trade ?? null).map((a) => a.id));
  const tests = [...ASSESSMENTS].sort((a, b) => Number(mine.has(b.id)) - Number(mine.has(a.id)));
  const now = new Date();

  return (
    <Shell lang={lang} nav={isWorker ? workerNav(lang) : undefined} back="/learn">
      <h1 className="h1">{es ? "Pruebas de habilidades" : "Skills tests"}</h1>
      <p className="muted mb-4">
        {es
          ? `Los empleadores ven tu resultado. ${QUESTIONS_PER_TEST} preguntas, ${TIME_LIMIT_MIN} minutos, aprobado con ${cfg.assessmentPassPct}%. Puedes repetirla cada ${cfg.assessmentRetakeDays} días.`
          : `Employers see your result. ${QUESTIONS_PER_TEST} questions, ${TIME_LIMIT_MIN} minutes, pass at ${cfg.assessmentPassPct}%. You can retake it every ${cfg.assessmentRetakeDays} days.`}
      </p>
      {sp.wait && <p className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">{es ? "Todavía no puedes repetir esa prueba." : "You can't retake that test yet."}</p>}
      <div className="space-y-2">
        {tests.map((a) => {
          const b = best[a.id];
          const next = nextAttemptAt(attempts, a.id, cfg.assessmentRetakeDays, now);
          const unfinished = attempts.find((x) => x.assessmentId === a.id && x.kind === "knowledge" && !x.completedAt && now.getTime() - Date.parse(x.startedAt) < TIME_LIMIT_MIN * 60_000);
          return (
            <div key={a.id} className="card flex flex-wrap items-center justify-between gap-3" data-testid="skills-test">
              <div className="min-w-0">
                <div className="font-bold">{a.title[lang]} {mine.has(a.id) && <span className="pill ml-1 bg-brand-soft align-middle text-brand-dark">{es ? "Para tu oficio" : "For your trade"}</span>}</div>
                <div className="text-sm text-slate-500">
                  {b?.knowledge ? `${es ? "Tu mejor resultado" : "Your best"}: ${b.knowledge.score}% ${b.knowledge.passed ? "✓" : ""}` : es ? "Sin intentar" : "Not taken"}
                  {b?.handsOn?.passed && <span className="ml-2 inline-flex items-center gap-1 text-emerald-700"><BadgeCheck size={14} />{es ? "Práctica verificada" : "Hands-on verified"}</span>}
                </div>
                <div className="text-xs text-slate-400">{es ? "Práctica en persona" : "Hands-on check"}: {a.handsOn[lang]}</div>
              </div>
              {isWorker ? (
                unfinished ? <Link href={`/learn/test/${unfinished.id}`} className="btn-primary btn-sm">{es ? "Continuar" : "Resume"}</Link>
                : next ? <span className="text-xs text-slate-500">{es ? "Repetir desde" : "Retake from"} {next.toISOString().slice(0, 10)}</span>
                : (
                  <form action={startTest}>
                    <input type="hidden" name="assessmentId" value={a.id} />
                    <button className="btn-primary btn-sm" data-testid={`start-${a.id}`}><Timer size={15} /> {b?.knowledge ? (es ? "Repetir" : "Retake") : es ? "Empezar" : "Start"}</button>
                  </form>
                )
              ) : null}
            </div>
          );
        })}
      </div>

      <h2 className="h2 mb-1 mt-8">{t(lang, "practice")}</h2>
      <p className="muted mb-3">{t(lang, "practiceIntro")}</p>
      <div className="space-y-2">
        {QUIZZES.map((q) => (
          <Link key={q.id} href={`/learn/${q.id}`} className="card block transition hover:shadow-md">
            <div className="font-bold">{q.title[lang]}</div>
            <div className="muted">{q.blurb[lang]}</div>
          </Link>
        ))}
      </div>
    </Shell>
  );
}
