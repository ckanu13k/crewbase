"use client";
import { useActionState, useRef, useState } from "react";
import { addCredential, type AddCardState } from "@/app/actions";
import type { Lang } from "@/lib/types";

export function AddCardForm({ lang, options }: { lang: Lang; options: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState<AddCardState, FormData>(addCredential, { ok: false, message: "" });
  const [preview, setPreview] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const es = lang === "es";

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await action(fd);
        formRef.current?.reset();
        setPreview(null);
      }}
      className="space-y-3"
    >
      <div>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-blue-200 bg-brand-soft/60 px-4 py-6 text-center transition hover:border-brand hover:bg-brand-soft">
          {preview ? (
            <img src={preview} alt="" className="max-h-40 rounded-xl shadow-card" />
          ) : (
            <>
              <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-brand shadow-card">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
              </span>
              <span className="font-semibold text-brand-dark">{es ? "Toma o sube una foto" : "Take or upload a photo"}</span>
              <span className="text-xs text-slate-500">{es ? "Frente de la tarjeta, con buena luz" : "Front of the card, in good light"}</span>
            </>
          )}
          <input name="photo" type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setPreview(e.target.files?.[0] ? URL.createObjectURL(e.target.files[0]) : null)} />
        </label>
      </div>
      <details className="rounded-xl border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-brand-dark">{es ? "Escribir los datos (opcional)" : "Type the details (optional)"}</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">{es ? "Tipo de tarjeta" : "Card type"}</label>
            <select name="type" className="input" defaultValue="">
              <option value="">{es ? "Detectar de la foto" : "Detect from photo"}</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{es ? "Número" : "Number"}</label>
            <input name="number" className="input" />
          </div>
          <div>
            <label className="label">{es ? "Fecha de emisión" : "Issued"}</label>
            <input name="issuedOn" type="date" className="input" />
          </div>
          <div>
            <label className="label">{es ? "Fecha de vencimiento" : "Expires"}</label>
            <input name="expiresOn" type="date" className="input" />
          </div>
        </div>
      </details>
      <button className="btn-primary w-full" disabled={pending}>{pending ? (es ? "Leyendo tarjeta…" : "Reading card…") : es ? "Guardar tarjeta" : "Save card"}</button>
      {state.message && <p className={`text-sm font-semibold ${state.ok ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p>}
    </form>
  );
}
