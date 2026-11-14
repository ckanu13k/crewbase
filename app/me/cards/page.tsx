import { IdCard, Trash2, BellRing } from "lucide-react";
import { requireWorker, getLang } from "@/lib/session";
import { db, todayISO } from "@/lib/db";
import { PageHeader, Shell, workerNav } from "@/components/Shell";
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
      <PageHeader
        eyebrow={worker?.name}
        title={t(lang, "wallet")}
        subtitle={es ? "Muestra esta pantalla en la puerta." : "Show this screen at the gate."}
      />
      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-brand-soft px-4 py-3 text-sm text-blue-900 ring-1 ring-blue-200">
        <BellRing size={18} className="shrink-0 text-brand" />
        {es ? "Te avisamos por texto 60, 30 y 7 días antes de que venza una tarjeta." : "We text you 60, 30 and 7 days before a card expires."}
      </div>

      {creds.length === 0 && <p className="card text-center text-slate-600">{t(lang, "noCards")}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {creds.map((c) => {
          const def = CREDENTIAL_BY_ID[c.type];
          return (
            <div key={c.id} className="card relative flex flex-col gap-3 overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 to-blue-700" />
              <div className="flex items-start gap-3">
                {c.photoPath ? (
                  <a href={`/api/files/${c.photoPath}`} target="_blank" rel="noreferrer" className="shrink-0">
                    <img src={`/api/files/${c.photoPath}`} alt="" className="h-14 w-20 rounded-lg object-cover ring-1 ring-slate-200" />
                  </a>
                ) : (
                  <div className="grid h-14 w-20 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-300 ring-1 ring-slate-200"><IdCard size={24} /></div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold leading-snug">{c.type === "unknown" ? (es ? "Tarjeta por identificar" : "Card to identify") : credLabel(c.type, lang)}</div>
                  {c.number && <div className="mt-0.5 font-mono text-xs text-slate-500">#{c.number}</div>}
                </div>
                <form action={deleteCredential}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-600" aria-label="Delete"><Trash2 size={16} /></button>
                </form>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <VerificationBadge c={c} lang={lang} />
                <ExpiryBadge c={c} lang={lang} today={today} />
              </div>
              {def?.note && <div className="text-xs text-slate-500">{def.note[lang]}</div>}
            </div>
          );
        })}
      </div>

      <div className="card mt-6">
        <h2 className="h2 mb-1">{t(lang, "addCard")}</h2>
        <p className="muted mb-4">{es ? "Leemos el tipo, número y fechas de la foto." : "We read the type, number and dates from the photo."}</p>
        <AddCardForm lang={lang} options={CREDENTIALS.map((c) => ({ id: c.id, label: c.label[lang] }))} />
      </div>
      {worker && <p className="muted mt-4 text-center">{worker.name} · {worker.phone}</p>}
    </Shell>
  );
}
