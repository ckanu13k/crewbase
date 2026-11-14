"use client";
import { useState } from "react";
import { createJob } from "@/app/actions";

interface Opt { id: string; label: string }
export function JobForm({ trades, credentials, skills, employers, defaultZip, defaultStart }: {
  trades: Opt[];
  credentials: Opt[];
  skills: (Opt & { trades: string[] })[];
  employers?: Opt[];
  defaultZip: string;
  defaultStart: string;
}) {
  const [trade, setTrade] = useState(trades[0]?.id ?? "");
  const tradeSkills = skills.filter((s) => s.trades.length === 0 || s.trades.includes(trade));

  return (
    <form action={createJob} className="card space-y-4">
      {employers && (
        <div>
          <label className="label">Employer</label>
          <select name="employerId" className="input">{employers.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</select>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Trade</label>
          <select name="trade" className="input" value={trade} onChange={(e) => setTrade(e.target.value)}>
            {trades.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Job title</label>
          <input name="title" className="input" placeholder="e.g. Turnaround pipefitter" />
        </div>
        <div>
          <label className="label">Pay ($/hr)</label>
          <div className="flex gap-2">
            <input name="payMin" type="number" min={0} step="0.5" className="input" placeholder="Min" required />
            <input name="payMax" type="number" min={0} step="0.5" className="input" placeholder="Max" required />
          </div>
        </div>
        <div>
          <label className="label">Shift</label>
          <select name="shift" className="input">
            <option value="day">Day</option><option value="night">Night</option><option value="rotating">Rotating</option><option value="turnaround">Turnaround / shutdown</option>
          </select>
        </div>
        <div>
          <label className="label">Job site ZIP</label>
          <input name="zip" className="input" defaultValue={defaultZip} pattern="\d{5}" required />
        </div>
        <div>
          <label className="label">Start date</label>
          <input name="startDate" type="date" className="input" defaultValue={defaultStart} required />
        </div>
        <div>
          <label className="label">Openings</label>
          <input name="headcount" type="number" min={1} className="input" defaultValue={1} />
        </div>
        <div>
          <label className="label">Min. years / NCCER level</label>
          <div className="flex gap-2">
            <input name="minYears" type="number" min={0} className="input" defaultValue={0} />
            <select name="minNccerLevel" className="input" defaultValue="0">{[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n === 0 ? "Any level" : `Level ${n}+`}</option>)}</select>
          </div>
        </div>
      </div>

      <fieldset>
        <legend className="label">Required cards (hard requirement)</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {credentials.map((c) => <label key={c.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="requiredCredentials" value={c.id} /> {c.label}</label>)}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">Nice-to-have cards</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {credentials.map((c) => <label key={c.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="preferredCredentials" value={c.id} /> {c.label}</label>)}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">Skills the job needs</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {tradeSkills.map((s) => <label key={s.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="requiredSkills" value={s.id} /> {s.label}</label>)}
        </div>
      </fieldset>
      <div>
        <label className="label">Notes for workers</label>
        <textarea name="description" className="input min-h-24" placeholder="Site, schedule, per diem, PPE provided…" />
      </div>
      <input type="hidden" name="placementFee" value="" />
      <button className="btn-primary w-full">Post job and find matches</button>
    </form>
  );
}
