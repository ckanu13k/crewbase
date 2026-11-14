import Link from "next/link";
import { requireRole, getLang } from "@/lib/session";
import { db, todayISO } from "@/lib/db";
import { Shell, staffNav } from "@/components/Shell";
import { credentialStatus } from "@/lib/matching";
import { TRADES, tradeLabel } from "@/lib/taxonomy";
import type { Credential } from "@/lib/types";

export default async function Workers({ searchParams }: { searchParams: Promise<{ q?: string; trade?: string }> }) {
  await requireRole("staff");
  const sp = await searchParams;
  const lang = await getLang();
  const store = await db();
  const today = todayISO();
  const [workers, creds] = await Promise.all([store.table("workers").list(), store.table("credentials").list()]);
  const byWorker: Record<string, Credential[]> = {};
  for (const c of creds) (byWorker[c.workerId] ??= []).push(c);
  const q = (sp.q ?? "").toLowerCase();
  const rows = workers
    .filter((w) => (!q || w.name.toLowerCase().includes(q) || w.phone.includes(q)) && (!sp.trade || w.trade === sp.trade))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <Shell lang={lang} nav={staffNav} back="/recruiter/workers" wide>
      <h1 className="h1 mb-3">Workers</h1>
      <form className="card mb-3 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Name or phone" className="input max-w-xs" />
        <select name="trade" defaultValue={sp.trade ?? ""} className="input max-w-xs">
          <option value="">All trades</option>
          {TRADES.map((t) => <option key={t.id} value={t.id}>{t.label.en}</option>)}
        </select>
        <button className="btn-dark">Search</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Name</th><th>Trade</th><th>Yrs / NCCER</th><th>ZIP</th><th>Cards</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((w) => {
              const cs = byWorker[w.id] ?? [];
              return (
                <tr key={w.id}>
                  <td><Link className="font-semibold underline" href={`/recruiter/workers/${w.id}`}>{w.name || "(no name yet)"}</Link><div className="muted">{w.phone} · {w.lang.toUpperCase()}</div></td>
                  <td>{tradeLabel(w.trade, "en")}</td>
                  <td>{w.yearsExperience ?? "?"} / {w.nccerLevel || "—"}</td>
                  <td>{w.zip ?? "—"}</td>
                  <td className="text-xs">
                    {cs.filter((c) => c.verification === "verified").length} verified · {cs.length} total
                    {cs.some((c) => credentialStatus(c, today) === "expired") && <span className="pill ml-1 bg-red-100 text-red-800">expired</span>}
                  </td>
                  <td>{w.onboardingComplete ? <span className="pill bg-emerald-100 text-emerald-800">active</span> : <span className="pill bg-amber-100 text-amber-800">mid-signup</span>}{!w.consentSms && <span className="pill ml-1 bg-stone-200">opted out</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
