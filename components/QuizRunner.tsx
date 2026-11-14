"use client";
import { useState } from "react";
import Link from "next/link";
import type { Quiz } from "@/lib/quizzes";
import type { Lang } from "@/lib/types";

export function QuizRunner({ quiz, lang }: { quiz: Quiz; lang: Lang }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const es = lang === "es";
  const done = i >= quiz.questions.length;

  if (done) {
    const pct = Math.round((score / quiz.questions.length) * 100);
    return (
      <div className="card text-center">
        <h1 className="h1">{quiz.title[lang]}</h1>
        <div className="my-6 text-5xl font-extrabold">{score}/{quiz.questions.length}</div>
        <p className="mb-4">{pct >= 80 ? (es ? "¡Muy bien!" : "Nice work!") : es ? "Sigue practicando." : "Keep practicing."}</p>
        <div className="flex justify-center gap-2">
          <button className="btn-primary" onClick={() => { setI(0); setScore(0); setPicked(null); }}>{es ? "Intentar de nuevo" : "Try again"}</button>
          <Link href="/learn" className="btn-ghost">{es ? "Más exámenes" : "More quizzes"}</Link>
        </div>
      </div>
    );
  }

  const q = quiz.questions[i];
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-slate-500">{quiz.title[lang]}</h1>
        <span className="muted">{i + 1}/{quiz.questions.length}</span>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded bg-slate-200">
        <div className="h-full bg-brand transition-all" style={{ width: `${(i / quiz.questions.length) * 100}%` }} />
      </div>
      <div className="card">
        <p className="text-lg font-semibold">{q.q[lang]}</p>
        <div className="mt-4 grid gap-2">
          {q.options.map((opt, k) => {
            const state = picked === null ? "" : k === q.answer ? "border-emerald-500 bg-emerald-50" : k === picked ? "border-red-400 bg-red-50" : "opacity-60";
            return (
              <button key={k} disabled={picked !== null} className={`btn-ghost justify-start text-left font-medium ${state}`}
                onClick={() => { setPicked(k); if (k === q.answer) setScore((s) => s + 1); }}>
                {opt[lang]}
              </button>
            );
          })}
        </div>
        {picked !== null && (
          <div className="mt-4">
            <p className={`font-bold ${picked === q.answer ? "text-emerald-700" : "text-red-700"}`}>{picked === q.answer ? (es ? "Correcto" : "Correct") : es ? "No exactamente" : "Not quite"}</p>
            <p className="mt-1 text-sm text-slate-700">{q.why[lang]}</p>
            <button className="btn-primary mt-3 w-full" onClick={() => { setI(i + 1); setPicked(null); }}>{es ? "Siguiente" : "Next"}</button>
          </div>
        )}
      </div>
      <p className="muted mt-3 text-center">{es ? "Solo práctica: no da tarjeta OSHA." : "Practice only: this does not give you an OSHA card."}</p>
    </div>
  );
}
