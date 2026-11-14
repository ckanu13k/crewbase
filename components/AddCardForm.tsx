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
        <label className="label">{es ? "Foto del frente de la tarjeta" : "Photo of the front of the card"}</label>
        <input name="photo" type="file" accept="image/*" capture="environment" className="input" onChange={(e) => setPreview(e.target.files?.[0] ? URL.createObjectURL(e.target.files[0]) : null)} />
        {preview && <img src={preview} alt="" className="mt-2 max-h-40 rounded-lg border" />}
        <p className="mt-1 text-xs text-stone-500">{es ? "Leemos el tipo, número y fechas automáticamente. Puedes corregirlos abajo." : "We read the type, number and dates automatically. You can correct them below."}</p>
      </div>
      <details className="rounded-lg border border-stone-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold">{es ? "Escribir los datos (opcional)" : "Type the details (optional)"}</summary>
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
