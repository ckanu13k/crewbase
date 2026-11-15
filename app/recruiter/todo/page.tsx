import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight, Circle } from "lucide-react";
import { requireRole, getLang } from "@/lib/session";
import { db, todayISO } from "@/lib/db";
import { PageHeader, Shell, staffNav } from "@/components/Shell";
import { generatedTodos, myEmployerIds } from "@/lib/todo";
import { addTask, toggleTask, deleteTask } from "@/app/recruiter-actions";
import type { Task } from "@/lib/types";

export default async function Todo({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const s = await requireRole("staff");
  const sp = await searchParams;
  const lang = await getLang();
  const today = todayISO();
  const mine = await myEmployerIds(s.memberId);
  const scopeAll = sp.scope === "all" || !mine;
  const items = await generatedTodos(scopeAll ? null : mine);
  const tasks = s.memberId ? (await (await db()).table("tasks").list({ ownerId: s.memberId } as Partial<Task>)).sort((a, b) => Number(a.done) - Number(b.done) || (a.dueOn ?? "9").localeCompare(b.dueOn ?? "9")) : [];

  return (
    <Shell lang={lang} nav={staffNav} back="/recruiter/todo" wide>
      <PageHeader
        eyebrow="Recruiter"
        title="My to-do"
        subtitle={scopeAll ? "Everything that needs a person, across all accounts." : "What needs you on your accounts, most urgent first."}
        action={mine ? (
          <div className="flex rounded-lg bg-slate-100 p-1 text-sm font-semibold">
            <Link href="/recruiter/todo" className={`rounded-md px-3 py-1 ${!scopeAll ? "bg-white shadow-sm" : "text-slate-500"}`}>My accounts</Link>
            <Link href="/recruiter/todo?scope=all" className={`rounded-md px-3 py-1 ${scopeAll ? "bg-white shadow-sm" : "text-slate-500"}`}>Everyone's</Link>
          </div>
        ) : undefined}
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="card p-0">
          <ul className="divide-y divide-slate-100" data-testid="todo-generated">
            {items.length === 0 && <li className="px-5 py-6 text-sm text-slate-500">All caught up.</li>}
            {items.map((t) => (
              <li key={t.key}>
                <Link href={t.href} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                  {t.urgent ? <AlertTriangle size={18} className="shrink-0 text-amber-600" /> : <Circle size={18} className="shrink-0 text-slate-300" />}
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{t.title}</span><span className="block text-xs text-slate-500">{t.detail}</span></span>
                  <ChevronRight size={16} className="text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h2 className="h2 mb-2">My notes & tasks</h2>
          {!s.memberId ? <p className="muted">Personal tasks need a team record — ask an admin to add your email in Admin → Team.</p> : (
            <>
              <form action={addTask} className="mb-3 space-y-2">
                <input name="title" required maxLength={200} placeholder="e.g. Call Westside about Friday start" className="input" />
                <div className="flex gap-2"><input name="dueOn" type="date" defaultValue={today} className="input" /><button className="btn-primary btn-sm">Add</button></div>
              </form>
              <ul className="space-y-1" data-testid="todo-tasks">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-2 text-sm">
                    <form action={toggleTask}><input type="hidden" name="id" value={t.id} /><button aria-label={t.done ? "Mark not done" : "Mark done"} className="mt-0.5">{t.done ? <CheckCircle2 size={18} className="text-emerald-600" /> : <Circle size={18} className="text-slate-400" />}</button></form>
                    <span className={`flex-1 ${t.done ? "text-slate-400 line-through" : ""}`}>
                      {t.link ? <Link href={t.link} className="hover:underline">{t.title}</Link> : t.title}
                      {t.dueOn && <span className={`block text-xs ${!t.done && t.dueOn < today ? "font-semibold text-red-600" : "text-slate-400"}`}>due {t.dueOn}</span>}
                    </span>
                    <form action={deleteTask}><input type="hidden" name="id" value={t.id} /><button className="text-xs text-slate-400 hover:text-red-600">✕</button></form>
                  </li>
                ))}
                {tasks.length === 0 && <li className="muted">No personal tasks.</li>}
              </ul>
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}
