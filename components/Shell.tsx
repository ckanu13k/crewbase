import Link from "next/link";
import { cookies } from "next/headers";
import { isDemo } from "@/lib/db";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

type Nav = { href: string; label: string }[];

export function workerNav(lang: Lang): Nav {
  return [
    { href: "/me", label: t(lang, "home") },
    { href: "/me/cards", label: t(lang, "wallet") },
    { href: "/training", label: t(lang, "training") },
    { href: "/learn", label: t(lang, "practice") },
  ];
}
export const employerNav: Nav = [
  { href: "/employer", label: "Jobs" },
  { href: "/employer/jobs/new", label: "Post a job" },
];
export const staffNav: Nav = [
  { href: "/recruiter", label: "Dashboard" },
  { href: "/recruiter/review", label: "Review" },
  { href: "/recruiter/workers", label: "Workers" },
  { href: "/recruiter/placements", label: "Placements" },
  { href: "/recruiter/employers", label: "Employers" },
  { href: "/recruiter/training", label: "Training" },
  { href: "/recruiter/outbox", label: "Texts" },
];

export async function Shell({ lang, nav, back, wide, children }: { lang: Lang; nav?: Nav; back?: string; wide?: boolean; children: React.ReactNode }) {
  const demo = isDemo();
  const signedIn = !demo && Boolean((await cookies()).get("cp_token")?.value);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 bg-ink text-white" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className={`mx-auto flex items-center gap-3 px-4 py-3 ${wide ? "max-w-6xl" : "max-w-2xl"}`}>
          <Link href="/" className="flex items-center gap-2 font-bold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-brand text-ink">✓</span>
            CrewPass
          </Link>
          <nav className="ml-2 hidden gap-1 sm:flex">
            {nav?.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-md px-2 py-1 text-sm text-stone-300 hover:bg-white/10 hover:text-white">
                {n.label}
              </Link>
            ))}
          </nav>
          <form action="/api/lang" method="post" className="ml-auto">
            <input type="hidden" name="lang" value={lang === "en" ? "es" : "en"} />
            <input type="hidden" name="back" value={back ?? "/"} />
            <button className="rounded-md border border-white/20 px-2 py-1 text-sm hover:bg-white/10">{t(lang, "language")}</button>
          </form>
          {demo && (
            <form action="/api/demo" method="post">
              <input type="hidden" name="action" value="logout" />
              <button className="rounded-md px-2 py-1 text-sm text-stone-300 hover:bg-white/10">{t(lang, "signOut")}</button>
            </form>
          )}
          {signedIn && (
            <form action="/api/auth/logout" method="post">
              <button className="rounded-md px-2 py-1 text-sm text-stone-300 hover:bg-white/10">{lang === "es" ? "Salir" : "Sign out"}</button>
            </form>
          )}
        </div>
        {demo && <div className="bg-amber-300 px-4 py-1 text-center text-xs font-semibold text-ink">{t(lang, "demoBanner")}</div>}
      </header>

      <main className={`mx-auto w-full flex-1 px-4 py-5 pb-24 sm:pb-8 ${wide ? "max-w-6xl" : "max-w-2xl"}`}>{children}</main>

      {nav && (
        <nav className="fixed inset-x-0 bottom-0 z-20 flex overflow-x-auto border-t border-stone-200 bg-white sm:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="min-w-[4.5rem] flex-1 px-2 py-3 text-center text-xs font-semibold whitespace-nowrap text-stone-600 active:bg-stone-100">
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
