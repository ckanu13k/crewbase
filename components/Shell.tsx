import Link from "next/link";
import { cookies } from "next/headers";
import { Languages, LogOut, Sparkles } from "lucide-react";
import { isDemo } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ROLE_LABEL } from "@/lib/permissions";
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
  { href: "/employer/hires", label: "Hires & billing", icon: "placements" },
];
/** Recruiter workspace. Admins see the same plus a link to their own workspace (added in Shell). */
export const staffNav: Nav = [
  { href: "/recruiter", label: "Dashboard", icon: "dashboard" },
  { href: "/recruiter/optimize", label: "Optimizer", icon: "optimize" },
  { href: "/recruiter/review", label: "Review", icon: "review" },
  { href: "/recruiter/screenings", label: "Screening", icon: "screening" },
  { href: "/recruiter/workers", label: "Workers", icon: "workers" },
  { href: "/recruiter/placements", label: "Placements", icon: "placements" },
  { href: "/recruiter/outbox", label: "Texts", icon: "texts" },
];
/** Admin workspace: the business side. */
export const adminNav: Nav = [
  { href: "/admin", label: "Overview", icon: "dashboard" },
  { href: "/admin/billing", label: "Billing", icon: "billing" },
  { href: "/admin/employers", label: "Employers", icon: "employers" },
  { href: "/admin/team", label: "Team", icon: "team" },
  { href: "/admin/training", label: "Training", icon: "training" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
  { href: "/recruiter", label: "Recruiting", icon: "workers" },
];

export async function Shell({ lang, nav: navIn, back, wide, bare, children }: { lang: Lang; nav?: Nav; back?: string; wide?: boolean; bare?: boolean; children: React.ReactNode }) {
  const demo = isDemo();
  const session = navIn ? await getSession() : null;
  // Admins working in the recruiter screens get a way back to their own workspace.
  const nav = navIn === staffNav && session?.role === "admin" ? [...staffNav, { href: "/admin", label: "Admin", icon: "settings" }] : navIn;
  const persona = session ? ROLE_LABEL[session.role] : null;
  const signedIn = !demo && Boolean((await cookies()).get("cp_token")?.value);
  const width = wide ? "max-w-6xl" : "max-w-3xl";
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className={`mx-auto flex h-14 items-center gap-2 px-4 ${nav ? "max-w-6xl" : width}`}>
          <Link href="/" aria-label="CrewPass home"><Logo /></Link>
          {nav && <DesktopNav items={nav} />}
          <div className="ml-auto flex items-center gap-1">
            {persona && (session?.role === "admin" || session?.role === "recruiter") && (
              <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 sm:inline" data-testid="persona">{persona}</span>
            )}
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
