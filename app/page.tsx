import Link from "next/link";
import { redirect } from "next/navigation";
import { db, isDemo } from "@/lib/db";
import { getLang, getSession } from "@/lib/session";
import { t } from "@/lib/i18n";
import { tradeLabel } from "@/lib/taxonomy";
import { Shell } from "@/components/Shell";

export default async function Home() {
  const lang = await getLang();
  const demo = isDemo();
  const session = await getSession();
  if (session && !demo) redirect(session.role === "worker" ? "/me" : session.role === "employer" ? "/employer" : "/recruiter");

  const store = await db();
  const [workers, employers] = demo ? await Promise.all([store.table("workers").list(), store.table("employers").list()]) : [[], []];
  const smsNumber = process.env.NEXT_PUBLIC_SMS_NUMBER;

  return (
    <Shell lang={lang} back="/">
      <section className="py-4">
        <h1 className="text-3xl font-extrabold tracking-tight">{t(lang, "tagline")}</h1>
        <p className="mt-2 text-stone-600">
          {lang === "es"
            ? "Para tuberos, soldadores, andamieros, electricistas y más en el área de Houston."
            : "For pipefitters, welders, scaffold builders, electricians and more in Greater Houston."}
        </p>
      </section>

      <div className="grid gap-3">
        <Link href="/onboard" className="card block border-2 border-brand transition hover:shadow-md">
          <div className="text-xl font-bold">{t(lang, "imWorker")} →</div>
          <p className="muted mt-1">{t(lang, "imWorkerSub")}</p>
          {smsNumber && (
            <p className="mt-2 text-sm font-semibold">
              {t(lang, "textUs")} {smsNumber}
            </p>
          )}
        </Link>
        <Link href={demo ? "#employer-demo" : "/login?as=employer"} className="card block transition hover:shadow-md">
          <div className="text-xl font-bold">{t(lang, "imHiring")} →</div>
          <p className="muted mt-1">{t(lang, "imHiringSub")}</p>
        </Link>
        {!demo && (
          <div className="flex gap-2">
            <Link href="/login" className="btn-ghost flex-1">{lang === "es" ? "Iniciar sesión" : "Sign in"}</Link>
          </div>
        )}
      </div>

      {demo && (
        <section className="mt-8 space-y-4">
          <h2 className="h2">Try the demo as…</h2>

          <div className="card">
            <div className="font-semibold">A worker</div>
            <p className="muted mb-3">Sample profiles with different trades, cards and gaps.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {workers.filter((w) => w.onboardingComplete).slice(0, 10).map((w) => (
                <form key={w.id} action="/api/demo" method="post">
                  <input type="hidden" name="role" value="worker" />
                  <input type="hidden" name="workerId" value={w.id} />
                  <input type="hidden" name="lang" value={w.lang} />
                  <button className="btn-ghost btn-sm w-full justify-between">
                    <span>{w.name}</span>
                    <span className="muted">{tradeLabel(w.trade, "en")} · {w.lang.toUpperCase()}</span>
                  </button>
                </form>
              ))}
            </div>
          </div>

          <div className="card" id="employer-demo">
            <div className="font-semibold">An employer</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {employers.map((e) => (
                <form key={e.id} action="/api/demo" method="post">
                  <input type="hidden" name="role" value="employer" />
                  <input type="hidden" name="employerId" value={e.id} />
                  <button className="btn-ghost btn-sm w-full">{e.name}</button>
                </form>
              ))}
            </div>
          </div>

          <div className="card flex flex-wrap items-center gap-3">
            <div className="flex-1">
              <div className="font-semibold">The recruiter console</div>
              <p className="muted">Review cards, rank candidates, run placements and invoices.</p>
            </div>
            <form action="/api/demo" method="post">
              <input type="hidden" name="role" value="staff" />
              <button className="btn-dark">{t(lang, "staff")}</button>
            </form>
          </div>

          <form action="/api/demo" method="post" className="text-right">
            <input type="hidden" name="action" value="reset" />
            <button className="text-sm text-stone-500 underline">Reset demo data</button>
          </form>
        </section>
      )}
    </Shell>
  );
}
