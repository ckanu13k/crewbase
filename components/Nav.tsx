"use client";
// Navigation that knows the current page: desktop links in the header, and the mobile tab bar.
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck, Briefcase, ClipboardCheck, GraduationCap, Home, LayoutDashboard, MessageSquare, PlusCircle,
  Users, Building2, HandCoins, BookOpen, Workflow, ShieldCheck, Receipt, UsersRound, Settings, History, GraduationCap as Cap2, ListTodo, Clock, HardHat, Banknote, HeartPulse, type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: string };

const ICONS: Record<string, LucideIcon> = {
  home: Home, wallet: BadgeCheck, training: GraduationCap, practice: BookOpen, jobs: Briefcase, post: PlusCircle,
  dashboard: LayoutDashboard, review: ClipboardCheck, workers: Users, placements: HandCoins, employers: Building2, texts: MessageSquare, optimize: Workflow, screening: ShieldCheck, billing: Receipt, team: UsersRound, settings: Settings, activity: History, todo: ListTodo, classes: Cap2, work: HardHat, timesheets: Clock, crew: UsersRound, payroll: Banknote, benefits: HeartPulse,
};

function isActive(path: string, href: string) {
  if (href === "/me" || href === "/recruiter" || href === "/employer" || href === "/admin") return path === href || (href === "/me" && (path.startsWith("/me/jobs") || path.startsWith("/me/interviews")));
  return path === href || path.startsWith(href + "/");
}

export function DesktopNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="ml-4 hidden items-center gap-1 lg:flex">
      {items.map((n) => {
        const active = isActive(path, n.href);
        return (
          <Link key={n.href} href={n.href} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${active ? "bg-brand-soft text-brand-dark" : "text-slate-600 hover:bg-slate-100 hover:text-ink"}`}>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function TabBar({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map((n) => {
        const Icon = ICONS[n.icon] ?? Home;
        const active = isActive(path, n.href);
        return (
          <Link key={n.href} href={n.href} className={`flex min-w-[4.25rem] flex-1 flex-col items-center gap-1 px-1 pt-2 pb-1.5 text-[11px] font-semibold transition ${active ? "text-brand" : "text-slate-500"}`}>
            <span className={`grid h-7 w-12 place-items-center rounded-full transition ${active ? "bg-brand-soft" : ""}`}>
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
            </span>
            <span className="whitespace-nowrap">{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
