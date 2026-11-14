import { requireRole, getLang } from "@/lib/session";
import { db } from "@/lib/db";
import { Shell, staffNav } from "@/components/Shell";
import { createEmployer } from "@/app/actions";

export default async function Employers() {
  await requireRole("staff");
  const lang = await getLang();
  const store = await db();
  const [employers, jobs] = await Promise.all([store.table("employers").list(), store.table("jobs").list()]);
  return (
    <Shell lang={lang} nav={staffNav} back="/recruiter/employers" wide>
      <h1 className="h1 mb-3">Employers</h1>
      <div className="grid gap-4 md:grid-cols-[1fr_320px]">
        <div className="card overflow-x-auto">
          <table className="data">
            <thead><tr><th>Company</th><th>Contact</th><th>ZIP</th><th>Jobs</th></tr></thead>
            <tbody>
              {employers.map((e) => (
                <tr key={e.id}>
                  <td className="font-semibold">{e.name}</td>
                  <td>{e.contactName}<div className="muted">{e.email} · {e.phone}</div></td>
                  <td>{e.zip}</td>
                  <td>{jobs.filter((j) => j.employerId === e.id).length}</td>
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
          <button className="btn-primary w-full">Add</button>
        </form>
      </div>
    </Shell>
  );
}
