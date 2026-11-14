// Imports the Texas Workforce Commission Statewide Eligible Training Provider List (ETPL) into training_programs.
// Get the CSV from https://catalog.data.gov/dataset/statewide-eligible-training-providers-list
// Usage: npm run import:etpl -- path/to/etpl.csv [scripts/etpl-mapping.json]
// Writes data/training_programs.json. If SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set, also upserts to Supabase.
// ETPL has no class start dates: recruiters fill next_start for programs they actually refer people to.
import fs from "node:fs";

const [file, mapFile = "scripts/etpl-mapping.json"] = process.argv.slice(2);
if (!file) {
  console.error("Usage: npm run import:etpl -- <etpl.csv> [mapping.json]");
  process.exit(1);
}
const map = JSON.parse(fs.readFileSync(mapFile, "utf8"));

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const TRADE_WORDS = {
  pipefitter: ["pipefit", "pipe fit", "pipefitting", "plumb"],
  welder: ["weld"],
  scaffold: ["scaffold"],
  rigger: ["rigg", "crane", "signal"],
  millwright: ["millwright", "industrial maintenance", "mechanical maintenance"],
  electrician: ["electric", "lineworker", "instrumentation"],
  hvac: ["hvac", "air conditioning", "refrigeration"],
  helper: ["construction trades", "construction laborer", "pre-apprentice"],
};
const CRED_WORDS = { osha10: ["osha 10"], osha30: ["osha 30"], epa608: ["epa 608", "section 608"], forklift_cert: ["forklift"], cpr_first_aid: ["cpr", "first aid"] };

const [header, ...rows] = parseCsv(fs.readFileSync(file, "utf8"));
const idx = (k) => (map[k] ? header.findIndex((h) => h.trim().toLowerCase() === String(map[k]).toLowerCase()) : -1);
const col = Object.fromEntries(["provider", "name", "city", "zip", "cost", "clockHours", "weeks", "url", "board"].map((k) => [k, idx(k)]));
for (const k of ["provider", "name"]) if (col[k] < 0) throw new Error(`Column for "${k}" not found. Header is: ${header.join(" | ")}`);

const num = (v) => { const n = Number(String(v ?? "").replace(/[$,]/g, "")); return Number.isFinite(n) && n > 0 ? n : null; };
const get = (r, k) => (col[k] >= 0 ? (r[col[k]] ?? "").trim() : "");

const programs = [];
for (const r of rows) {
  if (map.filterBoard && col.board >= 0 && !get(r, "board").toLowerCase().includes(map.filterBoard.toLowerCase())) continue;
  const name = get(r, "name");
  const lower = name.toLowerCase();
  const trade = Object.entries(TRADE_WORDS).find(([, ws]) => ws.some((w) => lower.includes(w)))?.[0] ?? null;
  if (!trade && !Object.values(CRED_WORDS).flat().some((w) => lower.includes(w))) continue; // keep the craft wedge only
  const hours = num(get(r, "clockHours"));
  const weeks = num(get(r, "weeks"));
  const funding = ["wioa"];
  if (hours && hours >= 150 && hours < 600 && weeks && weeks >= 8 && weeks < 15) funding.push("workforce_pell"); // eligible length only; confirm state approval
  programs.push({
    id: `etpl-${Buffer.from(get(r, "provider") + "|" + name).toString("base64url").slice(0, 40)}`,
    provider: get(r, "provider"), name, trade,
    covers_credentials: Object.entries(CRED_WORDS).filter(([, ws]) => ws.some((w) => lower.includes(w))).map(([k]) => k),
    covers_skills: [], nccer_level: null, city: get(r, "city"), zip: get(r, "zip").slice(0, 5),
    next_start: null, weeks, clock_hours: hours, cost_usd: num(get(r, "cost")), funding, languages: ["en"],
    url: get(r, "url") || null, sample: false,
  });
}
fs.mkdirSync("data", { recursive: true });
fs.writeFileSync("data/training_programs.json", JSON.stringify(programs, null, 1));
console.log(`Kept ${programs.length} craft programs of ${rows.length} rows -> data/training_programs.json`);

if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && programs.length) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/training_programs`, {
    method: "POST",
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(programs),
  });
  console.log(res.ok ? "Upserted to Supabase." : `Supabase upsert failed: ${res.status} ${await res.text()}`);
}
