import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, BadgeCheck, CalendarDays, Camera, ChevronRight, Clock, DollarSign, MapPin, Pencil, ShieldAlert } from "lucide-react";
import { requireWorker, getLang } from "@/lib/session";
import { workerContext } from "@/lib/queries";
import { Shell, workerNav } from "@/components/Shell";
import { ScorePill } from "@/components/Badges";
import { t } from "@/lib/i18n";
import { credentialStatus } from "@/lib/matching";
import { credLabel, skillLabel, tradeLabel } from "@/lib/taxonomy";
import { gapText, shiftLabel } from "@/lib/training";
import { LocationBar } from "@/components/LocationBar";
import { AREAS } from "@/lib/geo";
import { getUserLocation } from "@/lib/location";
import { db } from "@/lib/db";
import { HireTypeBadge, payText } from "@/components/CrewBadges";
import { SECTORS } from "@/lib/taxonomy";
import { slotLabel } from "@/lib/interviews";

export default async function WorkerHome({ searchParams }: { searchParams: Promise<{ sector?: string }> }) {
  const { sector } = await searchParams;
  const s = await requireWorker();
  const lang = await getLang();
  const ctx = await workerContext(s.workerId);
  const { worker, creds, today } = ctx;
  const inSector = (j: { sector?: string }) => !sector || (j.sector ?? "industrial") === sector;
  const fits = ctx.fits.filter((f) => inSector(f.job));
  const close = ctx.close.filter((f) => inSector(f.job));
  if (!worker || !worker.onboardingComplete) redirect("/onboard");
  const es = lang === "es";
  const loc = await getUserLocation(worker);
  const lastSeen = worker.lastSeenAt ?? null;
  const isNew = (createdAt: string) => Boolean(lastSeen && createdAt > lastSeen);
  // Remember this visit so next time only newer jobs are marked "new".
  void (await db()).table("workers").upsert({ ...worker, lastSeenAt: new Date().toISOString() });
  const toAuthorize = (await (await db()).table("screenings").list({ workerId: worker.id } as never)).filter((x) => x.status === "awaiting_consent").length;
  const interviews = (await (await db()).table("interviews").list({ workerId: worker.id } as never)).filter((i) => i.status === "proposed" || (i.status === "booked" && (i.chosenSlot ?? "") >= today));
  const working = (await (await db()).table("assignments").list({ workerId: worker.id } as never)).filter((a) => a.status === "active");

  const alerts = creds.filter((c) => ["expired", "expiring"].includes(credentialStatus(c, today)));
  const unverified = creds.filter((c) => c.verification === "self").length;
  const verified = creds.filter((c) => c.verification === "verified").length;

  return (
    <Shell lang={lang} nav={workerNav(lang)} back="/me">
      {/* Profile summary */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-deep via-blue-800 to-blue-600 p-5 text-white shadow-lift sm:p-6">
        <div className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-blue-400/30 blur-2xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm text-blue-200">{t(lang, "hi")},</div>
            <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{worker.name || "👋"}</h1>
            <p className="mt-1 text-sm text-blue-100">
              {tradeLabel(worker.trade, lang)}
              {worker.yearsExperience !== null && ` · ${worker.yearsExperience} ${es ? "años" : "yrs"}`}
              {worker.nccerLevel > 0 && ` · NCCER ${worker.nccerLevel}`}
            </p>
          </div>
          <Link href="/me/profile" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold ring-1 ring-white/25 hover:bg-white/20">
            <Pencil size={14} /> {t(lang, "profile")}
          </Link>
        </div>
        <div className="relative mt-5 grid grid-cols-3 gap-2">
          {[
            { n: fits.length, l: es ? "Trabajos para ti" : "Jobs that fit" },
            { n: verified, l: es ? "Tarjetas verificadas" : "Verified cards" },
            { n: alerts.length, l: es ? "Por renovar" : "To renew" },
          ].map((x) => (
            <div key={x.l} className="rounded-2xl bg-white/10 px-3 py-2.5 ring-1 ring-white/15">
              <div className="text-2xl font-bold">{x.n}</div>
              <div className="text-[11px] leading-tight text-blue-100">{x.l}</div>
            </div>
          ))}
        </div>
        <div className="relative mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-blue-100">
          {worker.zip && <span className="flex items-center gap-1"><MapPin size={13} /> {loc?.label ?? worker.zip}{worker.radiusMiles ? ` · ${worker.radiusMiles} mi` : ""}</span>}
          <span className="flex items-center gap-1"><Clock size={13} /> {worker.shifts.map((x) => shiftLabel(x, lang)).join(", ")}</span>
        </div>
      </section>

      {interviews.map((iv) => (
        <Link key={iv.id} href={`/me/interviews/${iv.id}`} className="mt-4 flex items-center gap-3 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700" data-testid="interview-banner">
          <CalendarDays size={20} className="shrink-0" />
          <span className="flex-1">{iv.status === "proposed" ? (es ? "¡Te quieren entrevistar! Escoge un horario." : "They want to interview you! Pick a time.") : `${es ? "Entrevista" : "Interview"}: ${slotLabel(iv.chosenSlot!, es)}`}</span>
          <ChevronRight size={18} className="shrink-0 opacity-80" />
        </Link>
      ))}
      {working.length > 0 && (
        <Link href="/me/work" className="mt-4 flex items-center gap-3 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700" data-testid="work-banner">
          <Clock size={20} className="shrink-0" />
          <span className="flex-1">{es ? "Estás en un trabajo temporal: marca entrada y salida, y mira tu pago." : "You're on a temp assignment: clock in and out, and see your pay."}</span>
          <ChevronRight size={18} className="shrink-0 opacity-80" />
        </Link>
      )}
      {toAuthorize > 0 && (
        <Link href="/me/screening" className="mt-4 flex items-center gap-3 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark" data-testid="authorize-banner">
          <ShieldAlert size={20} className="shrink-0" />
          <span className="flex-1">{es ? "Un empleador quiere contratarte: autoriza la revisión de antecedentes / prueba de drogas." : "An employer wants to hire you: authorize the background check / drug screen."}</span>
          <ChevronRight size={18} className="shrink-0 opacity-80" />
        </Link>
      )}
      {(alerts.length > 0 || unverified > 0) && (
        <div className="mt-4 space-y-2">
          {alerts.map((c) => {
            const expired = credentialStatus(c, today) === "expired";
            return (
              <Link key={c.id} href="/training" className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm ring-1 transition hover:shadow-card ${expired ? "bg-red-50 text-red-800 ring-red-200" : "bg-amber-50 text-amber-900 ring-amber-200"}`}>
                {expired ? <ShieldAlert size={20} className="shrink-0" /> : <AlertTriangle size={20} className="shrink-0" />}
                <span className="flex-1">
                  <b>{credLabel(c.type, lang)}</b> {expired ? (es ? "venció" : "expired") : es ? "vence" : "expires"} {c.expiresOn}.{" "}
                  <span className="underline underline-offset-2">{es ? "Ver clases para renovar" : "See renewal classes"}</span>
                </span>
                <ChevronRight size={18} className="shrink-0 opacity-60" />
              </Link>
            );
          })}
          {unverified > 0 && (
            <Link href="/me/cards" className="flex items-center gap-3 rounded-2xl bg-brand-soft px-4 py-3 text-sm text-blue-900 ring-1 ring-blue-200 transition hover:shadow-card">
              <Camera size={20} className="shrink-0 text-brand" />
              <span className="flex-1">
                {es ? `${unverified} tarjeta(s) sin foto. Las tarjetas verificadas suben en la lista de los empleadores.` : `${unverified} card(s) without a photo. Verified cards rank higher with employers.`}
              </span>
              <ChevronRight size={18} className="shrink-0 opacity-60" />
            </Link>
          )}
        </div>
      )}

      <div className="card mt-4 py-3">
        <LocationBar lang={lang} label={loc?.label ?? null} areas={AREAS} compact />
      </div>

      <div className="mt-7 mb-3 flex items-end justify-between">
        <h2 className="h2">{t(lang, "matchedJobs")}</h2>
        <span className="muted">{fits.length}</span>
      </div>
      <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1" data-testid="sector-filter">
        {[{ id: "", label: es ? "Todos" : "All" }, ...SECTORS.map((x) => ({ id: x.id, label: x.label[lang] }))].map((x) => (
          <Link key={x.id || "all"} href={x.id ? `/me?sector=${x.id}` : "/me"} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${(sector ?? "") === x.id ? "bg-brand text-white ring-brand" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"}`}>{x.label}</Link>
        ))}
      </div>
      {fits.length === 0 && (
        <div className="card text-center">
          <BadgeCheck className="mx-auto text-slate-300" size={32} />
          <p className="mt-2 text-slate-600">{t(lang, "noJobs")}</p>
        </div>
      )}
      <div className="space-y-3">
        {fits.map(({ job, result, employer }) => (
          <Link key={job.id} href={`/me/jobs/${job.id}`} className="card card-hover block">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[17px] font-semibold">{job.title}{isNew(job.createdAt) && <span className="pill ml-2 bg-emerald-50 align-middle text-emerald-700 ring-1 ring-emerald-200" data-testid="new-job">{es ? "Nuevo" : "New"}</span>}</div>
                <div className="truncate text-sm text-slate-500">{employer}</div>
              </div>
              <ScorePill score={result.score} eligible />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="chip"><DollarSign size={13} className="text-brand" />{payText(job).slice(1)}</span>
              {job.hireType === "temp" && <HireTypeBadge job={job} lang={lang} />}
              {job.perDiem ? <span className="chip">+${job.perDiem}/{es ? "día viáticos" : "day per diem"}</span> : null}
              <span className="chip"><Clock size={13} className="text-brand" />{shiftLabel(job.shift, lang)}</span>
              {result.distanceMiles !== null && <span className="chip"><MapPin size={13} className="text-brand" />{Math.round(result.distanceMiles)} {t(lang, "miles")}</span>}
              <span className="chip"><CalendarDays size={13} className="text-brand" />{job.startDate}</span>
            </div>
            {result.gaps.some((g) => g.kind === "skill_missing") && (
              <p className="mt-3 text-xs text-slate-500">
                {es ? "También piden: " : "Also asks for: "}
                {result.gaps.filter((g) => g.kind === "skill_missing").map((g) => skillLabel(g.skill!, lang)).join(", ")}
              </p>
            )}
          </Link>
        ))}
      </div>

      {close.length > 0 && (
        <>
          <div className="mt-8 mb-3">
            <h2 className="h2">{t(lang, "closeJobs")}</h2>
            <p className="muted">{es ? "Te falta poco. Mira qué necesitas y dónde conseguirlo." : "You're close. See what's missing and where to get it."}</p>
          </div>
          <div className="space-y-3">
            {close.slice(0, 5).map(({ job, result, employer }) => (
              <Link key={job.id} href={`/me/jobs/${job.id}`} className="card card-hover block">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold">{job.title}</div>
                    <div className="truncate text-sm text-slate-500">{employer} · ${job.payMin}–{job.payMax}{t(lang, "perHour")}</div>
                  </div>
                  <span className="pill bg-amber-50 text-amber-700 ring-1 ring-amber-200">{t(lang, "whatYoureMissing")}</span>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                  {result.gaps.filter((g) => g.blocking).map((g, i) => (
                    <li key={i} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{gapText(g, lang)}</li>
                  ))}
                </ul>
              </Link>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}
