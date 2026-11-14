import Link from "next/link";
import { getLang, getSession } from "@/lib/session";
import { Shell, workerNav } from "@/components/Shell";
import { QUIZZES } from "@/lib/quizzes";
import { t } from "@/lib/i18n";

export default async function Learn() {
  const lang = await getLang();
  const s = await getSession();
  return (
    <Shell lang={lang} nav={s?.role === "worker" ? workerNav(lang) : undefined} back="/learn">
      <h1 className="h1">{t(lang, "practice")}</h1>
      <p className="muted mb-4">{t(lang, "practiceIntro")}</p>
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
