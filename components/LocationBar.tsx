"use client";
// "Near: Pasadena (77506)" with two ways to change it: share this device's location, or pick an
// area / type a ZIP. Saves through /api/location, then refreshes the page so results re-sort.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed, MapPin } from "lucide-react";
import type { Lang } from "@/lib/types";

const ERR: Record<string, Record<Lang, string>> = {
  outside: { en: "That location is outside the area we cover yet (Houston and the Gulf Coast). Pick an area instead.", es: "Esa ubicación está fuera del área que cubrimos (Houston y la Costa del Golfo). Elige un área." },
  zip: { en: "Enter a 5-digit ZIP code.", es: "Escribe un código postal de 5 dígitos." },
  unknownZip: { en: "We don't have that ZIP on our map yet. Try a nearby one.", es: "Todavía no tenemos ese ZIP. Prueba uno cercano." },
  denied: { en: "Location is blocked for this site. Allow it in your browser settings, or pick an area.", es: "La ubicación está bloqueada. Permítela en tu navegador o elige un área." },
  unavailable: { en: "Couldn't get your location. Pick an area instead.", es: "No pudimos obtener tu ubicación. Elige un área." },
};

export function LocationBar({
  lang, label, areas, compact, onPicked,
}: {
  lang: Lang;
  label: string | null;
  areas: { label: string; zip: string }[];
  compact?: boolean;
  /** If set, called with the ZIP instead of refreshing (used by the signup chat). */
  onPicked?: (zip: string) => void;
}) {
  const es = lang === "es";
  const router = useRouter();
  const [open, setOpen] = useState(!label && !compact);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [zip, setZip] = useState("");

  async function save(body: object) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/location", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "unavailable");
      setOpen(false);
      if (onPicked) onPicked(data.zip);
      else router.refresh();
    } catch (e) {
      const k = (e as Error).message;
      setErr(ERR[k]?.[lang] ?? k);
    } finally {
      setBusy(false);
    }
  }

  function useDevice() {
    if (!("geolocation" in navigator)) return setErr(ERR.unavailable[lang]);
    setBusy(true);
    setErr(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => void save({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (e) => {
        setBusy(false);
        setErr((e.code === e.PERMISSION_DENIED ? ERR.denied : ERR.unavailable)[lang]);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }

  return (
    <div className={compact ? "" : "card mb-4"}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-dark"><MapPin size={16} /></span>
        <div className="min-w-0 flex-1 text-sm leading-snug">
          {label ? (
            <>
              <span className="muted">{es ? "Cerca de" : "Near"} </span>
              <b data-testid="loc-label">{label}</b>
            </>
          ) : (
            <span className="font-semibold">{es ? "¿Dónde buscas?" : "Where are you looking?"}</span>
          )}
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button type="button" className="btn-soft btn-sm flex-1 sm:flex-none" onClick={useDevice} disabled={busy}>
            <LocateFixed size={14} /> {es ? "Usar mi ubicación" : "Use my location"}
          </button>
          {!open && (
            <button type="button" className="btn-ghost btn-sm flex-1 sm:flex-none" onClick={() => setOpen(true)}>
              {es ? "Elegir área" : "Pick area"}
            </button>
          )}
        </div>
      </div>
      {open && (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <select className="input" defaultValue="" disabled={busy} onChange={(e) => e.target.value && void save({ zip: e.target.value })} aria-label={es ? "Área" : "Area"}>
            <option value="">{es ? "Elige un área…" : "Choose an area…"}</option>
            {areas.map((a) => <option key={a.zip} value={a.zip}>{a.label} ({a.zip})</option>)}
          </select>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void save({ zip }); }}>
            <input className="input w-28" inputMode="numeric" maxLength={5} placeholder="ZIP" value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))} aria-label="ZIP" />
            <button className="btn-primary btn-sm" disabled={busy || zip.length !== 5}>{es ? "Ir" : "Go"}</button>
          </form>
        </div>
      )}
      {err && <p className="mt-2 text-sm text-amber-700">{err}</p>}
      {!compact && (
        <p className="mt-2 text-xs text-slate-400">
          {es ? "Guardamos una ubicación aproximada (≈ 1 km). Los empleadores solo ven la distancia." : "We keep an approximate location (about half a mile). Employers only see the distance."}
        </p>
      )}
    </div>
  );
}
