import { notFound } from "next/navigation";
import { getLang, getSession } from "@/lib/session";
import { Shell, workerNav } from "@/components/Shell";
import { QUIZ_BY_ID } from "@/lib/quizzes";
import { QuizRunner } from "@/components/QuizRunner";

export default async function QuizPage({ params }: { params: Promise<{ quiz: string }> }) {
  const { quiz } = await params;
  const q = QUIZ_BY_ID[quiz];
  if (!q) notFound();
  const lang = await getLang();
  const s = await getSession();
  return (
    <Shell lang={lang} nav={s?.role === "worker" ? workerNav(lang) : undefined} back={`/learn/${quiz}`}>
      <QuizRunner quiz={q} lang={lang} />
    </Shell>
  );
}
