"use client";
import { useState } from "react";
import { createJob, updateJob } from "@/app/actions";
import { SECTORS, TRADE_BY_ID } from "@/lib/taxonomy";
import type { Job, Sector } from "@/lib/types";

interface Opt { id: string; label: string }
export function JobForm({ trades, credentials, skills, employers, defaultZip, defaultStart, job, defaultSector, markupPct = 45 }: {
  trades: Opt[];
  credentials: Opt[];
  skills: (Opt & { trades: string[] })[];
  employers?: Opt[];
  defaultZip: string;
  defaultStart: string;
  /** Editing an existing job. */
  job?: Job;
  defaultSector?: Sector;
  markupPct?: number;
}) {
  const [sector, setSector] = useState<Sector>(job?.sector ?? defaultSector ?? "industrial");
  const sectorTrades = trades.filter((t) => TRADE_BY_ID[t.id]?.sectors.includes(sector));
  const [trade, setTrade] = useState(job?.trade ?? sectorTrades[0]?.id ?? trades[0]?.id ?? "");
  const [hireType, setHireType] = useState(job?.hireType ?? "direct");
  const [pay, setPay] = useState<number>(job?.payMin ?? 0);
  const tradeSkills = skills.filter((s) => s.trades.length === 0 || s.trades.includes(trade));
  const pickSector = (x: Sector) => {
    setSector(x);
    const list = trades.filter((t) => TRADE_BY_ID[t.id]?.sectors.includes(x));
    if (!list.some((t) => t.id === trade)) setTrade(list[0]?.id ?? "");
  };

  return (
    <form action={job ? updateJob : createJob} className="card space-y-4">
      <fieldset>
        <legend className="label">Kind of work</legend>
        <input type="hidden" name="sector" value={sector} />
        <div className="flex flex-wrap gap-2" data-testid="sector-picker">
          {SECTORS.map((x) => (
            <button type="button" key={x.id} onClick={() => pickSector(x.id)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${sector === x.id ? "bg-brand text-white ring-brand" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"}`}>{x.label.en}</button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">How you want to hire</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${hireType === "direct" ? "border-brand bg-brand-soft" : "border-slate-200"}`}>
            <input type="radio" name="hireType" value="direct" checked={hireType === "direct"} onChange={() => setHireType("direct")} className="mt-1" />
            <span><b>Direct hire</b><span className="block text-slate-500">They join your payroll. One flat fee after day 30.</span></span>
          </label>
          <label className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${hireType === "temp" ? "border-brand bg-brand-soft" : "border-slate-200"}`}>
            <input type="radio" name="hireType" value="temp" checked={hireType === "temp"} onChange={() => setHireType("temp")} className="mt-1" data-testid="hire-temp" />
            <span><b>Temp crew</b><span className="block text-slate-500">We employ and pay them. You approve hours and get one invoice a week.</span></span>
          </label>
        </div>
      </fieldset>
      {job && <input type="hidden" name="id" value={job.id} />}
      {employers && !job && (
        <div>
          <label className="label">Employer</label>
          <select name="employerId" className="input">{employers.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</select>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Trade</label>
          <select name="trade" className="input" value={trade} onChange={(e) => setTrade(e.target.value)}>
            {(sectorTrades.length ? sectorTrades : trades).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Job title</label>
          <input name="title" className="input" placeholder="e.g. Turnaround pipefitter" defaultValue={job?.title} />
        </div>
        <div>
          <label className="label">{hireType === "temp" ? "Worker pay ($/hr)" : "Pay ($/hr)"}</label>
          <div className="flex gap-2">
            <input name="payMin" type="number" min={0} step="0.25" className="input" placeholder="Min" required defaultValue={job?.payMin} onChange={(e) => setPay(Number(e.target.value))} />
            <input name="payMax" type="number" min={0} step="0.25" className="input" placeholder="Max" defaultValue={job?.payMax} />
          </div>
          {hireType === "temp" && <p className="mt-1 text-xs text-slate-500" data-testid="bill-rate">You're billed {pay > 0 ? <b>${(Math.round(pay * (1 + markupPct / 100) * 100) / 100).toFixed(2)}/hr</b> : `pay + ${markupPct}%`} (covers payroll taxes, workers' comp and our fee). Overtime over 40 h/week is billed at 1.5×.</p>}
        </div>
        {hireType === "temp" && (
          <>
            <div>
              <label className="label">Per diem ($/day worked, optional)</label>
              <input name="perDiem" type="number" min={0} max={500} step="1" className="input" defaultValue={job?.perDiem ?? ""} placeholder="e.g. 75" />
            </div>
            <div>
              <label className="label">Last day (optional)</label>
              <input name="endDate" type="date" className="input" defaultValue={job?.endDate ?? ""} />
            </div>
          </>
        )}
        <div>
          <label className="label">PO / work-order number (optional)</label>
          <input name="workOrder" className="input" maxLength={60} defaultValue={job?.workOrder ?? ""} placeholder="Printed on invoices" />
        </div>
        <div>
          <label className="label">Shift</label>
          <select name="shift" className="input" defaultValue={job?.shift ?? "day"}>
            <option value="day">Day</option><option value="night">Night</option><option value="rotating">Rotating</option><option value="turnaround">Turnaround / shutdown</option>
          </select>
        </div>
        <div>
          <label className="label">Job site ZIP</label>
          <input name="zip" className="input" defaultValue={job?.zip ?? defaultZip} pattern="\d{5}" required />
        </div>
        <div>
          <label className="label">Start date</label>
          <input name="startDate" type="date" className="input" defaultValue={job?.startDate ?? defaultStart} required />
        </div>
        <div>
          <label className="label">Openings</label>
          <input name="headcount" type="number" min={1} className="input" defaultValue={job?.headcount ?? 1} />
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="label">Before day one</legend>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"><input type="checkbox" name="requiresBackground" defaultChecked={job?.requiresBackground} /> Background check</label>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"><input type="checkbox" name="requiresDrug" defaultChecked={job?.requiresDrug} /> Drug screen</label>
          </div>
          <p className="mt-1 text-xs text-slate-500">We order these once you want to hire someone, with the worker's written authorization. You see only the outcome, billed at cost plus a handling fee.</p>
        </fieldset>
        <div>
          <label className="label">Min. years / NCCER level</label>
          <div className="flex gap-2">
            <input name="minYears" type="number" min={0} className="input" defaultValue={job?.minYears ?? 0} />
            <select name="minNccerLevel" className="input" defaultValue={String(job?.minNccerLevel ?? 0)}>{[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n === 0 ? "Any level" : `Level ${n}+`}</option>)}</select>
          </div>
        </div>
      </div>

      <fieldset>
        <legend className="label">Required cards (hard requirement)</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {credentials.map((c) => <label key={c.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="requiredCredentials" value={c.id} defaultChecked={job?.requiredCredentials.includes(c.id)} /> {c.label}</label>)}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">Nice-to-have cards</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {credentials.map((c) => <label key={c.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="preferredCredentials" value={c.id} defaultChecked={job?.preferredCredentials.includes(c.id)} /> {c.label}</label>)}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">Skills the job needs</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {tradeSkills.map((s) => <label key={s.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="requiredSkills" value={s.id} defaultChecked={job?.requiredSkills.includes(s.id)} /> {s.label}</label>)}
        </div>
      </fieldset>
      <div>
        <label className="label">Notes for workers</label>
        <textarea name="description" className="input min-h-24" placeholder="Site, schedule, per diem, PPE provided…" defaultValue={job?.description} />
      </div>
      {!job && <input type="hidden" name="placementFee" value="" />}
      {hireType === "direct" && !job && <p className="text-xs text-slate-500">Direct hire: flat placement fee by job level, due after the worker's day 30, with a free replacement if they leave within the guarantee period.</p>}
      <button className="btn-primary w-full">{job ? "Save changes" : "Post job and find matches"}</button>
    </form>
  );
}
