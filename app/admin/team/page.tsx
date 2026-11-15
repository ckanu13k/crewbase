import { requireCap, getLang } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader, Shell, adminNav } from "@/components/Shell";
import { addTeamMember, removeTeamMember, setTeamRole } from "@/app/admin-actions";
import { envAdmins } from "@/lib/team";

export default async function Team({ searchParams }: { searchParams: Promise<{ err?: string; ok?: string }> }) {
  await requireCap("manageTeam");
  const sp = await searchParams;
  const lang = await getLang();
  const members = (await (await db()).table("team_members").list()).sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
  const owners = envAdmins();

  return (
    <Shell lang={lang} nav={adminNav} back="/admin/team" wide>
      <PageHeader eyebrow="Admin" title="Team" subtitle="Who can use the recruiter console and the admin workspace. Changes apply on their next page load." />
      {sp.ok && <div className="mb-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">Saved. They sign in at /login with this email.</div>}
      {sp.err === "email" && <div className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">Enter a valid email.</div>}
      {sp.err === "last" && <div className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">You can't remove or demote the last admin.</div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="card overflow-x-auto">
          <table className="data">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead>
            <tbody>
              {owners.map((o) => (
                <tr key={o}><td className="font-semibold">Owner</td><td>{o}</td><td><span className="pill bg-brand-soft text-brand-dark">admin</span><div className="text-xs text-slate-400">set in ADMIN_EMAILS</div></td><td /></tr>
              ))}
              {members.map((m) => (
                <tr key={m.id} data-testid="team-row">
                  <td className="font-semibold">{m.name || "—"}</td>
                  <td>{m.email}</td>
                  <td>
                    <form action={setTeamRole} className="flex gap-1" key={`${m.id}-${m.role}`}>
                      <input type="hidden" name="id" value={m.id} />
                      <select name="role" defaultValue={m.role} className="input min-h-9 py-1 text-sm"><option value="recruiter">recruiter</option><option value="admin">admin</option></select>
                      <button className="btn-ghost btn-sm">Set</button>
                    </form>
                  </td>
                  <td><form action={removeTeamMember}><input type="hidden" name="id" value={m.id} /><button className="btn-sm text-slate-400 hover:text-red-600">Remove</button></form></td>
                </tr>
              ))}
              {members.length === 0 && owners.length === 0 && <tr><td colSpan={4} className="muted">No one yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <form action={addTeamMember} className="card space-y-2">
          <h2 className="h2">Add someone</h2>
          <input name="name" placeholder="Name" className="input" />
          <input name="email" type="email" required placeholder="Work email" className="input" />
          <select name="role" className="input" defaultValue="recruiter">
            <option value="recruiter">Recruiter — matching, screening, placements</option>
            <option value="admin">Admin — also billing, team, employers, settings</option>
          </select>
          <button className="btn-primary w-full">Add to team</button>
          <p className="text-xs text-slate-500">Employers aren't added here: create the company in Employers and their contact email can sign in.</p>
        </form>
      </div>
    </Shell>
  );
}
