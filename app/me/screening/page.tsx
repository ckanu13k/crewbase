import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { requireWorker, getLang } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader, Shell, workerNav } from "@/components/Shell";
import { ADVERSE_WAIT_BUSINESS_DAYS, FCRA_RIGHTS_URL, KIND_LABEL, workerLabel } from "@/lib/screening/policy";
import { consentToScreenings, startCheckrAuthorization } from "@/app/screening-actions";
import type { Screening } from "@/lib/types";

export default async function MyScreening({ searchParams }: { searchParams: Promise<{ err?: string; ok?: string }> }) {
  const s = await requireWorker();
  const sp = await searchParams;
  const lang = await getLang();
  const es = lang === "es";
  const store = await db();
  const worker = await store.table("workers").get(s.workerId);
  if (!worker) redirect("/onboard");
  const [rows, jobs, employers] = await Promise.all([
    store.table("screenings").list({ workerId: s.workerId } as Partial<Screening>),
    store.table("jobs").list(),
    store.table("employers").list(),
  ]);
  const J = Object.fromEntries(jobs.map((j) => [j.id, j]));
  const E = Object.fromEntries(employers.map((e) => [e.id, e]));
  const list = rows.filter((r) => r.status !== "canceled").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const manual = list.filter((r) => r.status === "awaiting_consent" && r.provider === "manual");
  const checkrNew = list.filter((r) => r.status === "awaiting_consent" && r.provider === "checkr" && !r.consentUrl);
  const checkrLinks = list.filter((r) => r.status === "awaiting_consent" && r.provider === "checkr" && r.consentUrl);
  const empNames = [...new Set(manual.map((r) => E[r.employerId]?.name).filter(Boolean))].join(", ");
  const kinds = [...new Set(manual.map((r) => KIND_LABEL[r.kind][lang].toLowerCase()))].join(es ? " y " : " and ");

  return (
    <Shell lang={lang} nav={workerNav(lang)} back="/me/screening">
      <PageHeader eyebrow={es ? "Antes del primer día" : "Before day one"} title={es ? "Antecedentes y prueba de drogas" : "Background check and drug screen"} />
      {sp.ok && <div className="mb-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">{es ? "Gracias. Lo autorizaste; te avisamos cuando haya resultado." : "Thanks — authorized. We'll text you when there's a result."}</div>}
      {sp.err === "sign" && <div className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">{es ? "Marca la casilla y escribe tu nombre completo." : "Tick the box and type your full name."}</div>}
      {sp.err === "email" && <div className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">{es ? "Escribe un correo válido." : "Enter a valid email."}</div>}

      {manual.length > 0 && (
        <>
          {/* FCRA: the disclosure is a standalone document — nothing else in this box. */}
          <section className="card mb-3" data-testid="disclosure">
            <h2 className="h2 mb-2">{es ? "Aviso de revisión para empleo" : "Disclosure regarding background investigation"}</h2>
            <p className="text-sm leading-relaxed text-slate-700">
              {es
                ? `CrewPass, en nombre de ${empNames}, puede obtener un reporte de consumidor sobre ti para fines de empleo, por medio de una agencia de reportes de consumidores. Puede incluir: ${kinds}. Se usa solo para decidir sobre el trabajo para el que te recomendamos.`
                : `CrewPass, on behalf of ${empNames}, may obtain a consumer report about you for employment purposes from a consumer reporting agency. It may include: ${kinds}. It is used only to decide on the job we put you forward for.`}
            </p>
          </section>
          <form action={consentToScreenings} className="card mb-6 space-y-3">
            {manual.map((r) => <input key={r.id} type="hidden" name="id" value={r.id} />)}
            <h2 className="h2">{es ? "Autorización" : "Authorization"}</h2>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="agree" value="yes" className="mt-1" required />
              <span>{es ? "Autorizo que se obtenga el reporte descrito arriba." : "I authorize the report described above to be obtained."}</span>
            </label>
            <div>
              <label className="label">{es ? "Escribe tu nombre completo como firma" : "Type your full name as your signature"}</label>
              <input name="signature" className="input" required minLength={3} defaultValue="" autoComplete="name" />
            </div>
            <button className="btn-primary w-full">{es ? "Autorizar" : "Authorize"}</button>
            <p className="text-xs text-slate-500">
              {es ? "Tus derechos: " : "Your rights: "}<a href={FCRA_RIGHTS_URL} className="underline" target="_blank" rel="noreferrer">{es ? "Resumen de tus derechos (FCRA)" : "A Summary of Your Rights Under the FCRA"}</a>
            </p>
          </form>
        </>
      )}

      {checkrNew.length > 0 && (
        <form action={startCheckrAuthorization} className="card mb-6 space-y-3">
          <h2 className="h2">{es ? "Autoriza con Checkr" : "Authorize with Checkr"}</h2>
          <p className="text-sm text-slate-600">{es ? "Checkr te mostrará el aviso y te pedirá autorización. Necesita tu correo para enviarte el reporte." : "Checkr will show you the disclosure and ask for your authorization. It needs your email to send you your report."}</p>
          <input name="email" type="email" required className="input" placeholder="you@example.com" />
          <button className="btn-primary w-full">{es ? "Continuar a Checkr" : "Continue to Checkr"}</button>
        </form>
      )}
      {checkrLinks.map((r) => (
        <a key={r.id} href={r.consentUrl!} className="btn-primary mb-3 w-full">{es ? "Terminar en Checkr" : "Finish on Checkr"}: {KIND_LABEL[r.kind][lang]}</a>
      ))}

      <h2 className="h2 mb-2">{es ? "Tus revisiones" : "Your screenings"}</h2>
      <div className="space-y-2">
        {list.map((r) => (
          <div key={r.id} className="card" data-testid="my-screening">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-dark"><ShieldCheck size={18} /></span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{KIND_LABEL[r.kind][lang]} · {J[r.jobId]?.title}</div>
                <div className="muted">{E[r.employerId]?.name}</div>
                <div className="mt-1 text-sm"><b>{workerLabel(r, lang)}</b>{r.status === "clear" && r.expiresOn ? (es ? ` · válida hasta ${r.expiresOn}` : ` · good through ${r.expiresOn}`) : ""}</div>
                {(r.status === "pre_adverse" || r.status === "not_cleared") && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    {es
                      ? `Te enviamos una copia del reporte. Si algo está mal, dispútalo con la empresa que hizo el reporte${r.status === "pre_adverse" ? ` dentro de ${ADVERSE_WAIT_BUSINESS_DAYS} días hábiles y avísanos` : ""}. `
                      : `We sent you a copy of the report. If anything is wrong, dispute it with the screening company${r.status === "pre_adverse" ? ` within ${ADVERSE_WAIT_BUSINESS_DAYS} business days and tell us` : ""}. `}
                    <a href={FCRA_RIGHTS_URL} className="underline" target="_blank" rel="noreferrer">{es ? "Tus derechos" : "Your rights"}</a>
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="card muted">{es ? "Nada por ahora. Se piden solo cuando un empleador quiere contratarte." : "Nothing yet. These are only requested when an employer wants to hire you."}</p>}
      </div>
    </Shell>
  );
}
