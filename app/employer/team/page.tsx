import { requireEmployer, getLang } from "@/lib/session";
import { db, isDemo } from "@/lib/db";
import { PageHeader, Shell, employerNav } from "@/components/Shell";
import { employerFor } from "@/lib/team";
import { addEmployerUser, removeEmployerUser } from "@/app/employer-actions";
import type { EmployerUser } from "@/lib/types";

export default async function EmployerTeam({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const s = await requireEmployer();
  const sp = await searchParams;
  const lang = await getLang();
  const store = await db();
  const [employer, users] = await Promise.all([store.table("employers").get(s.employerId), store.table("employer_users").list({ employerId: s.employerId } as Partial<EmployerUser>)]);
  const isOwner = isDemo() || s.role === "admin" || (await employerFor(s.actor))?.role === "owner";
  const msg: Record<string, string> = { email: "Enter a valid email.", taken: "That email already has a CrewPass login.", owner: "Only the company contact can add or remove people." };

  return (
    <Shell lang={lang} nav={employerNav} back="/employer/team" wide>
      <PageHeader eyebrow={employer?.name} title="Your team" subtitle="Everyone here can sign in with their own email and see your jobs, shortlists, hires and invoices." />
      {sp.ok && <div className="mb-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">Added. We emailed them a sign-in link.</div>}
      {sp.err && <div className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">{msg[sp.err] ?? "Something went wrong."}</div>}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="card overflow-x-auto">
          <table className="data">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th /></tr></thead>
            <tbody>
              <tr><td className="font-semibold">{employer?.contactName || "Company contact"}</td><td>{employer?.email}</td><td>Owner</td><td /></tr>
              {users.map((u) => (
                <tr key={u.id} data-testid="employer-user">
                  <td className="font-semibold">{u.name || "—"}</td><td>{u.email}</td><td>Hiring manager</td>
                  <td>{isOwner && <form action={removeEmployerUser}><input type="hidden" name="id" value={u.id} /><button className="btn-sm text-slate-400 hover:text-red-600">Remove</button></form>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isOwner ? (
          <form action={addEmployerUser} className="card space-y-2">
            <h2 className="h2">Add a hiring manager</h2>
            <input name="name" placeholder="Name" className="input" />
            <input name="email" type="email" required placeholder="Work email" className="input" />
            <button className="btn-primary w-full">Add</button>
            <p className="text-xs text-slate-500">They can post and edit jobs and respond to shortlists. Only you can add or remove people.</p>
          </form>
        ) : <p className="card muted">Ask {employer?.email} to add or remove people.</p>}
      </div>
    </Shell>
  );
}
