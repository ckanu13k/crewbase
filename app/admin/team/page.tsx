import { requireCap, getLang } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader, Shell, adminNav } from "@/components/Shell";
import { addTeamMember, removeTeamMember } from "@/app/admin-actions";
import { envAdmins } from "@/lib/team";

export default async function Team({ searchParams }: { searchParams: Promise<{ err?: string; ok?: string }> }) {
  await requireCap("manageTeam");
  const sp = await searchParams;
  const lang = await getLang();
  const members = (await (await db()).table("team_members").list()).sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
  const owners = envAdmins();

  return (
    <Shell lang={lang} nav={adminNav} back="/admin/team" wide>
      <PageHeader eyebrow="Admin" title="Team" subtitle="Recruiters who can use the recruiter console. The admin workspace is only for the founder (set in ADMIN_EMAILS) and can't be granted here." />
      {sp.ok && <div className="mb-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">Saved. They sign in at /login with this email.</div>}
      {sp.err === "email" && <div className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">Enter a valid email.</div>}
      {sp.err === "founder" && <div className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">That's a founder email — it already has admin access.</div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="card overflow-x-auto">
          <table className="data">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead>
            <tbody>
              {owners.map((o) => (
                <tr key={o}><td className="font-semibold">Founder</td><td>{o}</td><td><span className="pill bg-brand-soft text-brand-dark">admin</span><div className="text-xs text-slate-400">set in ADMIN_EMAILS</div></td><td /></tr>
              ))}
              {members.map((m) => (
                <tr key={m.id} data-testid="team-row">
                  <td className="font-semibold">{m.name || "—"}</td>
                  <td>{m.email}</td>
                  <td><span className="pill bg-slate-100 text-slate-600">recruiter</span></td>
                  <td><form action={removeTeamMember}><input type="hidden" name="id" value={m.id} /><button className="btn-sm text-slate-400 hover:text-red-600">Remove</button></form></td>
                </tr>
              ))}
              {members.length === 0 && owners.length === 0 && <tr><td colSpan={4} className="muted">No one yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <form action={addTeamMember} className="card space-y-2">
          <h2 className="h2">Add a recruiter</h2>
          <input name="name" placeholder="Name" className="input" />
          <input name="email" type="email" required placeholder="Work email" className="input" />
          <button className="btn-primary w-full">Add recruiter</button>
          <p className="text-xs text-slate-500">Recruiters get matching, screening and placements. They never see billing, team, settings or the activity log.</p>
          <p className="text-xs text-slate-500">Employers aren't added here: create the company in Employers and their contact email can sign in.</p>
        </form>
      </div>
    </Shell>
  );
}
