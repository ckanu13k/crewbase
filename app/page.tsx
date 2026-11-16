import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight, BadgeCheck, BellRing, Briefcase, Camera, Clock, GraduationCap, HardHat, Languages, MessageSquareText,
  Phone, ShieldCheck, Sparkles, Users,
} from "lucide-react";
import { db, isDemo } from "@/lib/db";
import { HOME } from "@/lib/permissions";
import { getLang, getSession } from "@/lib/session";
import { tradeLabel } from "@/lib/taxonomy";
import { Shell } from "@/components/Shell";
import { Logo } from "@/components/Logo";

export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const lang = await getLang();
  const es = lang === "es";
  const demo = isDemo();
  const session = await getSession();
  if (session && !demo) redirect(HOME[session.role]);

  const store = await db();
  const [workers, employers] = demo ? await Promise.all([store.table("workers").list(), store.table("employers").list()]) : [[], []];
  const smsNumber = process.env.NEXT_PUBLIC_SMS_NUMBER;
  const hireHref = demo ? "#demo" : "/login?as=employer";

  const steps = [
    { icon: MessageSquareText, title: es ? "Regístrate en 5 minutos" : "Sign up in 5 minutes", body: es ? "Por texto, llamada o aquí. Cuéntanos tu experiencia con tus palabras." : "By text, phone call or right here. Tell us your experience in your own words." },
    { icon: Camera, title: es ? "Sube tus tarjetas" : "Add your cards", body: es ? "Toma foto de tu OSHA, NCCER o TWIC. Leemos las fechas y te avisamos antes de que venzan." : "Snap your OSHA, NCCER or TWIC. We read the dates and remind you before they expire." },
    { icon: Briefcase, title: es ? "Recibe trabajos que te quedan" : "Get jobs that fit", body: es ? "Te mostramos qué te falta para cada trabajo y dónde conseguirlo." : "See exactly what you're missing for each job, and where to get it." },
  ];

  const employerPoints = [
    { icon: Clock, title: es ? "Lista en 48 horas" : "Shortlist in 48 hours", body: es ? "Candidatos revisados por un reclutador, no un montón de currículums." : "Recruiter-checked candidates, not a pile of resumes." },
    { icon: BadgeCheck, title: es ? "Tarjetas verificadas" : "Verified cards", body: es ? "Cada tarjeta muestra cómo se verificó y cuándo vence." : "Every card shows how it was verified and when it expires." },
    { icon: ShieldCheck, title: es ? "Tarifa fija, al día 30" : "Flat fee, due on day 30", body: es ? "Reemplazo gratis si la persona se va antes de 90 días." : "Free replacement if the hire leaves within 90 days." },
  ];

  return (
    <Shell lang={lang} back="/" bare>
      {deleted && <div className="bg-emerald-600 px-4 py-2 text-center text-sm font-semibold text-white">Your account was deleted. Thank you for using CrewPass.</div>}
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-deep via-blue-800 to-blue-600 text-white">
        <div className="pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full bg-blue-400/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:py-20 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-blue-100 ring-1 ring-white/20">
              <HardHat size={14} /> {es ? "Área de Houston · English y Español" : "Greater Houston · English & Español"}
            </span>
            <h1 className="mt-5 text-4xl leading-[1.08] font-extrabold tracking-tight sm:text-5xl">
              {es ? "Trabajo de oficio que te queda. Tarjetas siempre al día." : "Craft work that fits. Cards that stay current."}
            </h1>
            <p className="mt-4 max-w-xl text-lg text-blue-100">
              {es
                ? "Para tuberos, soldadores, andamieros, electricistas y más. Encuentra trabajo, guarda tus certificaciones y capacítate para el siguiente puesto."
                : "For pipefitters, welders, scaffold builders, electricians and more. Find work, keep your certifications in one place, and train for the next job."}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/onboard" className="btn bg-white px-5 text-brand-dark shadow-lg shadow-blue-950/20 hover:bg-blue-50">
                {es ? "Busco trabajo" : "I'm looking for work"} <ArrowRight size={18} />
              </Link>
              <Link href={hireHref} className="btn px-5 text-white ring-1 ring-white/40 hover:bg-white/10">
                {es ? "Estoy contratando" : "I'm hiring"}
              </Link>
              {!demo && (
                <Link href="/login" className="btn px-3 text-blue-100 hover:text-white">
                  {es ? "Iniciar sesión" : "Sign in"}
                </Link>
              )}
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-blue-100">
              <li className="flex items-center gap-2"><Sparkles size={16} className="text-blue-200" />{es ? "Gratis para trabajadores" : "Free for workers"}</li>
              <li className="flex items-center gap-2"><Phone size={16} className="text-blue-200" />{es ? "Por texto o llamada" : "Works by text or call"}</li>
              <li className="flex items-center gap-2"><Languages size={16} className="text-blue-200" />{es ? "Bilingüe" : "Bilingual"}</li>
            </ul>
            {smsNumber && (
              <p className="mt-4 text-sm text-blue-100">
                {es ? "Manda JOBS por texto al" : "Text JOBS to"} <b className="text-white">{smsNumber}</b>
              </p>
            )}
          </div>

          {/* Product preview */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="rotate-1 rounded-3xl bg-white p-5 text-ink shadow-2xl shadow-blue-950/40">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-semibold text-brand">{es ? "Trabajo para ti" : "Job that fits you"}</div>
                  <div className="mt-1 text-lg font-bold">{es ? "Tubero, paro de planta" : "Turnaround pipefitter"}</div>
                  <div className="text-sm text-slate-500">Deer Park · 5 mi</div>
                </div>
                <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand-dark ring-4 ring-blue-100">89</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="chip">$30–36/hr</span>
                <span className="chip">6×12s</span>
                <span className="chip">{es ? "Empieza en 3 semanas" : "Starts in 3 weeks"}</span>
              </div>
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
                {[
                  ["OSHA 10", es ? "Verificada" : "Verified", "text-emerald-700 bg-emerald-50"],
                  ["TWIC", es ? "Verificada" : "Verified", "text-emerald-700 bg-emerald-50"],
                  ["Basic Plus", es ? "Vence pronto" : "Expires soon", "text-amber-700 bg-amber-50"],
                ].map(([name, status, cls]) => (
                  <div key={name} className="flex items-center justify-between">
                    <span className="font-medium text-slate-700">{name}</span>
                    <span className={`pill ${cls}`}>{status}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -bottom-6 -left-4 flex -rotate-2 items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-ink shadow-xl shadow-blue-950/30">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-white"><BellRing size={18} /></span>
              <div>
                <div className="font-semibold">{es ? "Basic Plus vence en 30 días" : "Basic Plus expires in 30 days"}</div>
                <div className="text-xs text-slate-500">{es ? "Próxima clase: martes 7am" : "Next class: Tuesday 7am"}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="eyebrow">{es ? "Para trabajadores" : "For workers"}</div>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{es ? "Cómo funciona" : "How it works"}</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="card">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand"><s.icon size={22} /></span>
                <span className="text-sm font-semibold text-slate-400">0{i + 1}</span>
              </div>
              <div className="mt-4 text-lg font-semibold">{s.title}</div>
              <p className="mt-1 text-[15px] text-slate-600">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/onboard" className="btn-primary">{es ? "Empezar gratis" : "Get started free"} <ArrowRight size={18} /></Link>
          <Link href="/training" className="btn-ghost"><GraduationCap size={18} /> {es ? "Ver capacitación" : "Browse training"}</Link>
        </div>
      </section>

      {/* Employers */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <div className="eyebrow">{es ? "Para empleadores" : "For employers"}</div>
            <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{es ? "Gente de oficio verificada, sin cuotas de agencia" : "Verified craft workers, without agency markups"}</h2>
            <p className="mt-3 text-[15px] text-slate-600">
              {es
                ? "Publica un trabajo con los requisitos reales: tarjetas, nivel NCCER, turno y ubicación. Te mandamos una lista corta revisada."
                : "Post a job with the real requirements: cards, NCCER level, shift and site. We send you a checked shortlist."}
            </p>
            <Link href={hireHref} className="btn-primary mt-6">{es ? "Publicar un trabajo" : "Post a job"} <ArrowRight size={18} /></Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {employerPoints.map((p) => (
              <div key={p.title} className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200/70">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-brand shadow-card"><p.icon size={20} /></span>
                <div className="mt-4 font-semibold">{p.title}</div>
                <p className="mt-1 text-sm text-slate-600">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {demo && (
        <section id="demo" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14">
          <div className="eyebrow">Demo</div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">Try it as…</h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="card lg:col-span-2">
              <div className="flex items-center gap-2 font-semibold"><Users size={18} className="text-brand" /> A worker</div>
              <p className="muted mt-1">Sample profiles with different trades, cards and gaps.</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {workers.filter((w) => w.onboardingComplete).slice(0, 10).map((w) => (
                  <form key={w.id} action="/api/demo" method="post">
                    <input type="hidden" name="role" value="worker" />
                    <input type="hidden" name="workerId" value={w.id} />
                    <input type="hidden" name="lang" value={w.lang} />
                    <button className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-blue-300 hover:bg-blue-50/50">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand-dark">
                        {w.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{w.name}</span>
                        <span className="block text-xs text-slate-500">{tradeLabel(w.trade, "en")} · {w.lang === "es" ? "Español" : "English"}</span>
                      </span>
                    </button>
                  </form>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="card">
                <div className="flex items-center gap-2 font-semibold"><Briefcase size={18} className="text-brand" /> An employer</div>
                <div className="mt-3 grid gap-2">
                  {employers.map((e) => (
                    <form key={e.id} action="/api/demo" method="post">
                      <input type="hidden" name="role" value="employer" />
                      <input type="hidden" name="employerId" value={e.id} />
                      <button className="btn-ghost btn-sm w-full justify-start">{e.name}</button>
                    </form>
                  ))}
                </div>
              </div>
              <div className="card">
                <div className="flex items-center gap-2 font-semibold"><GraduationCap size={18} className="text-brand" /> A training provider</div>
                <form action="/api/demo" method="post" className="mt-3">
                  <input type="hidden" name="role" value="provider" />
                  <input type="hidden" name="providerId" value="pr1" />
                  <button className="btn-ghost btn-sm w-full justify-start">Ship Channel Safety Council (demo)</button>
                </form>
              </div>
              <div className="card bg-gradient-to-br from-brand-deep to-blue-700 text-white">
                <div className="font-semibold">Our team</div>
                <p className="mt-1 text-sm text-blue-100">Recruiters match and screen. The founder's admin view adds billing, team and settings — nobody else sees it.</p>
                <div className="mt-4 grid gap-2">
                  <form action="/api/demo" method="post">
                    <input type="hidden" name="role" value="recruiter" />
                    <button className="btn w-full bg-white text-brand-dark hover:bg-blue-50">Open console <ArrowRight size={16} /></button>
                  </form>
                  <form action="/api/demo" method="post">
                    <input type="hidden" name="role" value="recruiter" />
                    <input type="hidden" name="memberId" value="tm3" />
                    <button className="btn w-full bg-white/10 text-white ring-1 ring-white/30 hover:bg-white/20">Second recruiter (James)</button>
                  </form>
                  <form action="/api/demo" method="post">
                    <input type="hidden" name="role" value="admin" />
                    <button className="btn w-full bg-white/10 text-white ring-1 ring-white/30 hover:bg-white/20">Founder view (admin) <ArrowRight size={16} /></button>
                  </form>
                </div>
              </div>
            </div>
          </div>
          <form action="/api/demo" method="post" className="mt-4 text-right">
            <input type="hidden" name="action" value="reset" />
            <button className="text-sm text-slate-500 underline-offset-2 hover:underline">Reset demo data</button>
          </form>
        </section>
      )}

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-slate-500">
          <Logo size={24} />
          <span>{es ? "Gratis para trabajadores. Hecho en Houston." : "Free for workers. Built in Houston."}</span>
        </div>
      </footer>
    </Shell>
  );
}
