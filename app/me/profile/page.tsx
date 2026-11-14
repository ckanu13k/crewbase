import { requireWorker, getLang } from "@/lib/session";
import { db } from "@/lib/db";
import { Shell, workerNav } from "@/components/Shell";
import { TRADES, skillsForTrade } from "@/lib/taxonomy";
import { shiftLabel } from "@/lib/training";
import { updateProfile } from "@/app/actions";
import { AREAS, zipToPoint } from "@/lib/geo";
import { LocationBar } from "@/components/LocationBar";
import { getUserLocation } from "@/lib/location";

export default async function Profile() {
  const s = await requireWorker();
  const lang = await getLang();
  const es = lang === "es";
  const w = await (await db()).table("workers").get(s.workerId);
  if (!w) return null;
  const skills = skillsForTrade(w.trade);
  const loc = await getUserLocation(w);

  return (
    <Shell lang={lang} nav={workerNav(lang)} back="/me/profile">
      <h1 className="h1 mb-4">{es ? "Tu perfil" : "Your profile"}</h1>
      <LocationBar lang={lang} label={loc?.label ?? null} areas={AREAS} />
      <form action={updateProfile} className="card space-y-4">
        <div>
          <label className="label">{es ? "Nombre" : "Name"}</label>
          <input name="name" defaultValue={w.name} className="input" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">{es ? "Oficio" : "Trade"}</label>
            <select name="trade" defaultValue={w.trade ?? ""} className="input">
              {TRADES.map((t) => <option key={t.id} value={t.id}>{t.label[lang]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{es ? "Años de experiencia" : "Years of experience"}</label>
            <input name="years" type="number" min={0} max={60} defaultValue={w.yearsExperience ?? ""} className="input" />
          </div>
          <div>
            <label className="label">{es ? "Nivel NCCER" : "NCCER level"}</label>
            <select name="nccer" defaultValue={String(w.nccerLevel)} className="input">
              {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n === 0 ? (es ? "Ninguno" : "None") : n}</option>)}
            </select>
          </div>
          <div>
            <label className="label">ZIP</label>
            <input name="zip" defaultValue={w.zip ?? ""} inputMode="numeric" pattern="\d{5}" className="input" />
            {w.zip && !zipToPoint(w.zip) && <p className="mt-1 text-xs text-amber-700">{es ? "Todavía no tenemos ese ZIP en el mapa" : "That ZIP isn't on our map yet"}</p>}
          </div>
          <div>
            <label className="label">{es ? "Distancia máxima" : "Max distance"}</label>
            <select name="radius" defaultValue={String(w.radiusMiles)} className="input">
              {[10, 25, 30, 40, 50, 0].map((r) => <option key={r} value={r}>{r === 0 ? (es ? "Cualquiera" : "Any") : `${r} mi`}</option>)}
            </select>
          </div>
        </div>
        <fieldset>
          <legend className="label">{es ? "Turnos" : "Shifts"}</legend>
          <div className="flex flex-wrap gap-2">
            {(["day", "night", "rotating", "turnaround"] as const).map((x) => (
              <label key={x} className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2">
                <input type="checkbox" name="shifts" value={x} defaultChecked={w.shifts.includes(x)} /> {shiftLabel(x, lang)}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="label">{es ? "Habilidades" : "Skills"}</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {skills.map((sk) => (
              <label key={sk.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="skills" value={sk.id} defaultChecked={w.skills.includes(sk.id)} /> {sk.label[lang]}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">{es ? "Cambia tu oficio y guarda para ver sus habilidades." : "Change your trade and save to see its skills."}</p>
        </fieldset>
        <div>
          <label className="label">{es ? "Idioma" : "Language"}</label>
          <select name="lang" defaultValue={w.lang} className="input">
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </div>
        <button className="btn-primary w-full">{es ? "Guardar" : "Save"}</button>
      </form>
    </Shell>
  );
}
