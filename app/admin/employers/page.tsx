import { requireCap, getLang } from "@/lib/session";
import { db } from "@/lib/db";
import { Shell, adminNav } from "@/components/Shell";
import { createEmployer } from "@/app/actions";
import { assignRecruiter } from "@/app/recruiter-actions";
import { money } from "@/lib/training";

export default async function Employers() {
  await requireCap("manageEmployers");
  const lang = await getLang();
  const store = await db();
  const [employers, jobs, placements, team] = await Promise.all([store.table("employers").list(), store.table("jobs").list(), store.table("placements").list(), store.table("team_members").list()]);
  const fees = (id: string) => placements.filter((p) => p.employerId === id && ["invoiced", "paid"].includes(p.status)).reduce((a, p) => a + p.fee, 0);
  return (
    <Shell lang={lang} nav={adminNav} back="/admin/employers" wide>
      <h1 className="h1">Employers</h1>
      <p className="muted mb-3">Employer accounts. The contact email is what lets that company sign in and see its own jobs, shortlists, hires and invoices.</p>
      <div className="grid gap-4 md:grid-cols-[1fr_320px]">
        <div className="card overflow-x-auto">
          <table className="data">
            <thead><tr><th>Company</th><th>Contact (signs in)</th><th>Recruiter</th><th>Open jobs</th><th>Hires</th><th>Billed</th></tr></thead>
            <tbody>
              {employers.map((e) => (
                <tr key={e.id}>
                  <td className="font-semibold">{e.name}</td>
                  <td>{e.contactName}<div className="muted">{e.email} · {e.phone}</div></td>
                  <td>
                    <form action={assignRecruiter} className="flex gap-1" key={`${e.id}-${e.recruiterId ?? ""}`}>
                      <input type="hidden" name="employerId" value={e.id} />
                      <select name="recruiterId" defaultValue={e.recruiterId ?? ""} className="input min-h-9 py-1 text-sm" aria-label="Recruiter">
                        <option value="">Unassigned</option>
                        {team.map((m) => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
                      </select>
                      <button className="btn-ghost btn-sm">Set</button>
                    </form>
                  </td>
                  <td>{jobs.filter((j) => j.employerId === e.id && j.status === "open").length}</td>
                  <td>{placements.filter((p) => p.employerId === e.id).length}</td>
                  <td>{money(fees(e.id))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form action={createEmployer} className="card space-y-2">
          <h2 className="h2">Add employer</h2>
          <p className="muted">Their contact email is what lets them sign in (live mode).</p>
          <input name="name" placeholder="Company name" className="input" required />
          <input name="contactName" placeholder="Contact name" className="input" />
          <input name="email" type="email" placeholder="Contact email" className="input" />
          <input name="phone" placeholder="Phone" className="input" />
          <input name="zip" placeholder="ZIP" className="input" />
          <select name="recruiterId" className="input" defaultValue=""><option value="">Assign a recruiter…</option>{team.map((m) => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}</select>
          <button className="btn-primary w-full">Add</button>
        </form>
      </div>
    </Shell>
  );
}
