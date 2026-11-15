import Link from "next/link";
import { requireCap, getLang } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader, Shell, adminNav } from "@/components/Shell";

const AREAS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "card", label: "Cards" },
  { key: "screening", label: "Screening" },
  { key: "match", label: "Pipeline" },
  { key: "placement", label: "Placements" },
  { key: "team", label: "Team" },
  { key: "settings", label: "Settings" },
  { key: "employer", label: "Employers" },
  { key: "training", label: "Training" },
  { key: "worker", label: "Workers" },
];

export default async function Activity({ searchParams }: { searchParams: Promise<{ area?: string; who?: string }> }) {
  await requireCap("viewAudit");
  const sp = await searchParams;
  const lang = await getLang();
  const all = (await (await db()).table("audit_log").list()).sort((a, b) => b.at.localeCompare(a.at));
  const people = [...new Set(all.map((e) => e.actor))].sort();
  const rows = all.filter((e) => (!sp.area || e.action.startsWith(sp.area + ".")) && (!sp.who || e.actor === sp.who)).slice(0, 300);
  const q = (o: Record<string, string | undefined>) => "?" + new URLSearchParams(Object.entries({ area: sp.area, who: sp.who, ...o }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <Shell lang={lang} nav={adminNav} back="/admin/activity" wide>
      <PageHeader eyebrow="Admin" title="Activity" subtitle="Who did what and when: card checks, screening steps, hires, invoices, team and settings changes." />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {AREAS.map((a) => (
          <Link key={a.key} href={q({ area: a.key || undefined })} className={`rounded-full px-3 py-1 text-sm font-semibold ${(sp.area ?? "") === a.key ? "bg-brand text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>{a.label}</Link>
        ))}
      </div>
      <form className="mb-4 flex gap-2">
        {sp.area && <input type="hidden" name="area" value={sp.area} />}
        <select name="who" defaultValue={sp.who ?? ""} className="input max-w-xs"><option value="">Everyone</option>{people.map((p) => <option key={p} value={p}>{p}</option>)}</select>
        <button className="btn-ghost btn-sm">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>When</th><th>Who</th><th>What</th><th>Details</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="muted">Nothing recorded yet.</td></tr>}
            {rows.map((e) => (
              <tr key={e.id} data-testid="audit-row">
                <td className="whitespace-nowrap text-xs text-slate-500">{new Date(e.at).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" })}</td>
                <td className="text-sm">{e.actor}<div className="text-xs text-slate-400">{e.actorRole}</div></td>
                <td className="text-xs font-mono text-slate-600">{e.action}</td>
                <td className="text-sm">{e.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted mt-2">Showing the latest {rows.length}. Report contents and card numbers are never written here.</p>
    </Shell>
  );
}
