import { requireWorker, getLang } from "@/lib/session";
import { db, todayISO } from "@/lib/db";
import { Shell, workerNav } from "@/components/Shell";
import { ExpiryBadge, VerificationBadge } from "@/components/Badges";
import { AddCardForm } from "@/components/AddCardForm";
import { t } from "@/lib/i18n";
import { CREDENTIALS, CREDENTIAL_BY_ID, credLabel } from "@/lib/taxonomy";
import { deleteCredential } from "@/app/actions";
import type { Credential } from "@/lib/types";

export default async function Cards() {
  const s = await requireWorker();
  const lang = await getLang();
  const es = lang === "es";
  const store = await db();
  const today = todayISO();
  const [worker, creds] = await Promise.all([store.table("workers").get(s.workerId), store.table("credentials").list({ workerId: s.workerId } as Partial<Credential>)]);
  creds.sort((a, b) => (a.expiresOn ?? "9999").localeCompare(b.expiresOn ?? "9999"));

  return (
    <Shell lang={lang} nav={workerNav(lang)} back="/me/cards">
      <h1 className="h1">{t(lang, "wallet")}</h1>
      <p className="muted mb-4">
        {es
          ? "Muestra esta pantalla en la puerta. Te avisamos por texto 60, 30 y 7 días antes de que venza una tarjeta."
          : "Show this screen at the gate. We text you 60, 30 and 7 days before a card expires."}
      </p>

      {creds.length === 0 && <p className="card muted">{t(lang, "noCards")}</p>}
      <div className="space-y-2">
        {creds.map((c) => {
          const def = CREDENTIAL_BY_ID[c.type];
          return (
            <div key={c.id} className="card flex gap-3">
              {c.photoPath ? (
                <a href={`/api/files/${c.photoPath}`} target="_blank" rel="noreferrer" className="shrink-0">
                  <img src={`/api/files/${c.photoPath}`} alt="" className="h-16 w-24 rounded-md border border-stone-200 object-cover" />
                </a>
              ) : (
                <div className="grid h-16 w-24 shrink-0 place-items-center rounded-md border border-dashed border-stone-300 text-xs text-stone-400">{es ? "sin foto" : "no photo"}</div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-bold">{c.type === "unknown" ? (es ? "Tarjeta por identificar" : "Card to identify") : credLabel(c.type, lang)}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <VerificationBadge c={c} lang={lang} />
                  <ExpiryBadge c={c} lang={lang} today={today} />
                </div>
                {c.number && <div className="muted mt-1">#{c.number}</div>}
                {def?.note && <div className="mt-1 text-xs text-stone-500">{def.note[lang]}</div>}
              </div>
              <form action={deleteCredential}>
                <input type="hidden" name="id" value={c.id} />
                <button className="text-stone-400 hover:text-red-600" aria-label="Delete">✕</button>
              </form>
            </div>
          );
        })}
      </div>

      <div className="card mt-6">
        <h2 className="h2 mb-2">{t(lang, "addCard")}</h2>
        <AddCardForm lang={lang} options={CREDENTIALS.map((c) => ({ id: c.id, label: c.label[lang] }))} />
      </div>
      {worker && <p className="muted mt-4 text-center">{worker.name} · {worker.phone}</p>}
    </Shell>
  );
}
