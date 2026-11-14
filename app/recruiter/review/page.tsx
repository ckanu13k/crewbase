import { requireRole, getLang } from "@/lib/session";
import { db, todayISO } from "@/lib/db";
import { Shell, staffNav } from "@/components/Shell";
import { ExpiryBadge, VerificationBadge } from "@/components/Badges";
import { CREDENTIALS, CREDENTIAL_BY_ID } from "@/lib/taxonomy";
import { reviewCredential } from "@/app/actions";

export default async function Review() {
  await requireRole("staff");
  const lang = await getLang();
  const store = await db();
  const today = todayISO();
  const [creds, workers] = await Promise.all([store.table("credentials").list(), store.table("workers").list()]);
  const wById = Object.fromEntries(workers.map((w) => [w.id, w]));
  const queue = creds
    .filter((c) => c.needsReview || c.verification === "document")
    .sort((a, b) => Number(b.needsReview) - Number(a.needsReview) || (a.extractionConfidence ?? 0) - (b.extractionConfidence ?? 0));

  return (
    <Shell lang={lang} nav={staffNav} back="/recruiter/review" wide>
      <h1 className="h1">Card review</h1>
      <p className="muted mb-4">
        Photos the AI wasn't sure about come first. Check each card against its issuer, correct any field, then mark it verified.
        Only verified cards get the green badge employers see.
      </p>
      {queue.length === 0 && <p className="card muted">Queue is empty.</p>}
      <div className="space-y-3">
        {queue.map((c) => {
          const w = wById[c.workerId];
          const def = CREDENTIAL_BY_ID[c.type];
          return (
            <form key={c.id} action={reviewCredential} className="card grid gap-4 md:grid-cols-[220px_1fr]">
              <input type="hidden" name="id" value={c.id} />
              <div>
                {c.photoPath ? (
                  <a href={`/api/files/${c.photoPath}`} target="_blank" rel="noreferrer"><img src={`/api/files/${c.photoPath}`} alt="" className="w-full rounded-lg border object-contain" /></a>
                ) : (
                  <div className="grid h-32 place-items-center rounded-lg border border-dashed text-sm text-slate-400">No photo (self-reported)</div>
                )}
                <div className="mt-2 text-sm font-semibold">{w?.name}</div>
                <div className="muted">{w?.phone}</div>
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <VerificationBadge c={c} lang="en" />
                  <ExpiryBadge c={c} lang="en" today={today} />
                  {c.extractionConfidence !== null && <span className="pill bg-slate-100">AI confidence {Math.round(c.extractionConfidence * 100)}%</span>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="sm:col-span-2">
                    <label className="label">Card type</label>
                    <select name="type" defaultValue={def ? c.type : ""} className="input" required>
                      <option value="" disabled>Pick the card type…</option>
                      {CREDENTIALS.map((x) => <option key={x.id} value={x.id}>{x.label.en}</option>)}
                    </select>
                  </div>
                  <div><label className="label">Number</label><input name="number" defaultValue={c.number ?? ""} className="input" /></div>
                  <div><label className="label">Holder</label><input disabled defaultValue={c.holderName ?? ""} className="input" /></div>
                  <div><label className="label">Issued</label><input name="issuedOn" type="date" defaultValue={c.issuedOn ?? ""} className="input" /></div>
                  <div><label className="label">Expires</label><input name="expiresOn" type="date" defaultValue={c.expiresOn ?? ""} className="input" /></div>
                  <div className="sm:col-span-2"><label className="label">How you verified it</label><input name="method" placeholder={def?.verifyHow ?? "e.g. issuer lookup"} className="input" /></div>
                </div>
                {def && <p className="text-xs text-slate-500"><b>How to verify:</b> {def.verifyHow}</p>}
                <div className="flex flex-wrap gap-2">
                  <button name="decision" value="verify" className="btn-primary btn-sm">✔ Verified</button>
                  <button name="decision" value="save" className="btn-ghost btn-sm">Save fields only</button>
                  <button name="decision" value="reject" className="btn-ghost btn-sm text-red-700" formNoValidate>Reject photo</button>
                </div>
              </div>
            </form>
          );
        })}
      </div>
    </Shell>
  );
}
