"use client";
// Countdown for a skills test. Submits the form when time runs out (the server also enforces the limit).
import { useEffect, useState } from "react";

export function TestTimer({ deadline, formId, label }: { deadline: string; formId: string; label: string }) {
  const end = Date.parse(deadline);
  const [left, setLeft] = useState(() => Math.max(0, end - Date.now()));
  useEffect(() => {
    const t = setInterval(() => {
      const l = Math.max(0, end - Date.now());
      setLeft(l);
      if (l === 0) {
        clearInterval(t);
        (document.getElementById(formId) as HTMLFormElement | null)?.requestSubmit();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [end, formId]);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <span className={`pill tabular-nums ${left < 60000 ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-700"}`} role="timer" aria-live="off">
      {label} {m}:{String(s).padStart(2, "0")}
    </span>
  );
}
