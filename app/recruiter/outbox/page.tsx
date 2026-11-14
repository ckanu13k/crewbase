import Link from "next/link";
import { requireRole, getLang } from "@/lib/session";
import { db } from "@/lib/db";
import { Shell, staffNav } from "@/components/Shell";
import { runRemindersNow } from "@/app/actions";
import { twilioConfigured } from "@/lib/messaging";

export default async function Outbox() {
  await requireRole("staff");
  const lang = await getLang();
  const store = await db();
  const [msgs, workers] = await Promise.all([store.table("outbox").list(), store.table("workers").list()]);
  const byPhone = Object.fromEntries(workers.map((w) => [w.phone, w.name]));
  msgs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <Shell lang={lang} nav={staffNav} back="/recruiter/outbox" wide>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="h1">Outgoing texts</h1>
          <p className="muted">{twilioConfigured() ? "Sending through Twilio." : "Twilio isn't configured: texts are logged here instead of sent."}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/onboard" className="btn-ghost btn-sm">SMS signup simulator</Link>
          <form action={runRemindersNow}><button className="btn-dark btn-sm">Run expiry reminders now</button></form>
        </div>
      </div>
      <div className="space-y-2">
        {msgs.length === 0 && <p className="card muted">Nothing sent yet. Try “Run expiry reminders now”, or “Text top 10” on a job.</p>}
        {msgs.slice(0, 200).map((m) => (
          <div key={m.id} className="card">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <b>{byPhone[m.to] ?? m.to}</b><span className="muted">{m.to}</span>
              <span className={`pill ${m.status === "sent" ? "bg-emerald-100 text-emerald-800" : m.status === "failed" ? "bg-red-100 text-red-800" : "bg-slate-100"}`}>{m.status}</span>
              <span className="muted ml-auto">{new Date(m.createdAt).toLocaleString("en-US", { timeZone: "America/Chicago" })}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{m.body}</p>
          </div>
        ))}
      </div>
    </Shell>
  );
}
