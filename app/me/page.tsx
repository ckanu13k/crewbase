import Link from "next/link";
import { redirect } from "next/navigation";
import { requireWorker, getLang } from "@/lib/session";
import { workerContext } from "@/lib/queries";
import { Shell, workerNav } from "@/components/Shell";
import { ScorePill } from "@/components/Badges";
import { t } from "@/lib/i18n";
import { credentialStatus } from "@/lib/matching";
import { credLabel, skillLabel, tradeLabel } from "@/lib/taxonomy";
import { gapText, shiftLabel } from "@/lib/training";

export default async function WorkerHome() {
  const s = await requireWorker();
  const lang = await getLang();
  const { worker, creds, fits, close, today } = await workerContext(s.workerId);
  if (!worker) redirect("/onboard");
  if (!worker.onboardingComplete) redirect("/onboard");
  const es = lang === "es";

  const alerts = creds.filter((c) => ["expired", "expiring"].includes(credentialStatus(c, today)));
  const unverified = creds.filter((c) => c.verification === "self").length;

  return (
    <Shell lang={lang} nav={workerNav(lang)} back="/me">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="h1">{t(lang, "hi")}, {worker.name.split(" ")[0] || "👋"}</h1>
          <p className="muted">
            {tradeLabel(worker.trade, lang)}
            {worker.yearsExperience !== null && ` · ${worker.yearsExperience} ${es ? "años" : "yrs"}`}
            {worker.nccerLevel > 0 && ` · NCCER ${worker.nccerLevel}`}
            {worker.zip && ` · ${worker.zip}`}
            {` · ${worker.shifts.map((x) => shiftLabel(x, lang)).join(", ")}`}
          </p>
        </div>
        <Link href="/me/profile" className="btn-ghost btn-sm shrink-0">{t(lang, "profile")}</Link>
      </div>

      {(alerts.length > 0 || unverified > 0) && (
        <div className="mb-4 space-y-2">
          {alerts.map((c) => {
            const expired = credentialStatus(c, today) === "expired";
            return (
              <Link key={c.id} href="/training" className={`block rounded-lg border px-3 py-2 text-sm font-semibold ${expired ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                {expired ? "⛔" : "⏰"} {credLabel(c.type, lang)} {expired ? (es ? "venció" : "expired") : es ? "vence" : "expires"} {c.expiresOn}. {es ? "Ver clases para renovar →" : "See renewal classes →"}
              </Link>
            );
          })}
          {unverified > 0 && (
            <Link href="/me/cards" className="block rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-900">
              📷 {es ? `${unverified} tarjeta(s) sin foto. Las tarjetas verificadas suben en la lista de los empleadores.` : `${unverified} card(s) without a photo. Verified cards rank higher with employers.`}
            </Link>
          )}
        </div>
      )}

      <h2 className="h2 mb-2">{t(lang, "matchedJobs")}</h2>
      {fits.length === 0 && <p className="card muted">{t(lang, "noJobs")}</p>}
      <div className="space-y-2">
        {fits.map(({ job, result, employer }) => (
          <Link key={job.id} href={`/me/jobs/${job.id}`} className="card block transition hover:shadow-md">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-bold">{job.title}</div>
                <div className="muted">{employer}</div>
              </div>
              <ScorePill score={result.score} eligible />
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              <span className="pill bg-stone-100">${job.payMin}–{job.payMax}{t(lang, "perHour")}</span>
              <span className="pill bg-stone-100">{shiftLabel(job.shift, lang)}</span>
              {result.distanceMiles !== null && <span className="pill bg-stone-100">{Math.round(result.distanceMiles)} {t(lang, "miles")}</span>}
              <span className="pill bg-stone-100">{t(lang, "starts")} {job.startDate}</span>
            </div>
            {result.gaps.some((g) => g.kind === "skill_missing") && (
              <p className="mt-2 text-xs text-stone-500">
                {es ? "También piden: " : "Also asks for: "}
                {result.gaps.filter((g) => g.kind === "skill_missing").map((g) => skillLabel(g.skill!, lang)).join(", ")}
              </p>
            )}
          </Link>
        ))}
      </div>

      {close.length > 0 && (
        <>
          <h2 className="h2 mb-2 mt-6">{t(lang, "closeJobs")}</h2>
          <div className="space-y-2">
            {close.slice(0, 5).map(({ job, result, employer }) => (
              <Link key={job.id} href={`/me/jobs/${job.id}`} className="card block border-dashed transition hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold">{job.title}</div>
                    <div className="muted">{employer} · ${job.payMin}–{job.payMax}{t(lang, "perHour")}</div>
                  </div>
                  <span className="pill bg-amber-100 text-amber-900">{t(lang, "whatYoureMissing")}</span>
                </div>
                <ul className="mt-2 list-disc pl-5 text-sm text-stone-700">
                  {result.gaps.filter((g) => g.blocking).map((g, i) => <li key={i}>{gapText(g, lang)}</li>)}
                </ul>
              </Link>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}
