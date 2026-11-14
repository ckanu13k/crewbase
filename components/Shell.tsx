import Link from "next/link";
import { cookies } from "next/headers";
import { Languages, LogOut, Sparkles } from "lucide-react";
import { isDemo } from "@/lib/db";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { Logo } from "./Logo";
import { DesktopNav, TabBar, type NavItem } from "./Nav";

type Nav = NavItem[];

export function workerNav(lang: Lang): Nav {
  return [
    { href: "/me", label: t(lang, "home"), icon: "home" },
    { href: "/me/cards", label: t(lang, "wallet"), icon: "wallet" },
    { href: "/training", label: t(lang, "training"), icon: "training" },
    { href: "/learn", label: t(lang, "practice"), icon: "practice" },
  ];
}
export const employerNav: Nav = [
  { href: "/employer", label: "Jobs", icon: "jobs" },
  { href: "/employer/jobs/new", label: "Post a job", icon: "post" },
];
export const staffNav: Nav = [
  { href: "/recruiter", label: "Dashboard", icon: "dashboard" },
  { href: "/recruiter/optimize", label: "Optimizer", icon: "optimize" },
  { href: "/recruiter/review", label: "Review", icon: "review" },
  { href: "/recruiter/workers", label: "Workers", icon: "workers" },
  { href: "/recruiter/placements", label: "Placements", icon: "placements" },
  { href: "/recruiter/employers", label: "Employers", icon: "employers" },
  { href: "/recruiter/training", label: "Training", icon: "training" },
  { href: "/recruiter/outbox", label: "Texts", icon: "texts" },
];

export async function Shell({ lang, nav, back, wide, bare, children }: { lang: Lang; nav?: Nav; back?: string; wide?: boolean; bare?: boolean; children: React.ReactNode }) {
  const demo = isDemo();
  const signedIn = !demo && Boolean((await cookies()).get("cp_token")?.value);
  const width = wide ? "max-w-6xl" : "max-w-3xl";
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className={`mx-auto flex h-14 items-center gap-2 px-4 ${nav ? "max-w-6xl" : width}`}>
          <Link href="/" aria-label="CrewPass home"><Logo /></Link>
          {nav && <DesktopNav items={nav} />}
          <div className="ml-auto flex items-center gap-1">
            <form action="/api/lang" method="post">
              <input type="hidden" name="lang" value={lang === "en" ? "es" : "en"} />
              <input type="hidden" name="back" value={back ?? "/"} />
              <button className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-ink">
                <Languages size={16} /> {t(lang, "language")}
              </button>
            </form>
            {demo && (
              <form action="/api/demo" method="post">
                <input type="hidden" name="action" value="logout" />
                <button className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-ink">{t(lang, "signOut")}</button>
              </form>
            )}
            {signedIn && (
              <form action="/api/auth/logout" method="post">
                <button className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-ink">
                  <LogOut size={16} /> <span className="hidden sm:inline">{lang === "es" ? "Salir" : "Sign out"}</span>
                </button>
              </form>
            )}
          </div>
        </div>
        {demo && (
          <div className="flex items-center justify-center gap-1.5 border-t border-blue-100 bg-brand-soft px-4 py-1.5 text-center text-xs font-medium text-brand-dark">
            <Sparkles size={13} /> {t(lang, "demoBanner")}
          </div>
        )}
      </header>

      {bare ? (
        <main className="flex-1 pb-24 lg:pb-0">{children}</main>
      ) : (
        <main className={`mx-auto w-full flex-1 px-4 py-6 pb-28 lg:pb-10 ${width}`}>{children}</main>
      )}

      {nav && <TabBar items={nav} />}
    </div>
  );
}

/** Page title block used across screens. */
export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h1 className="h1">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
