// Writes supabase/demo-data.sql from the demo seed: npm run demo:sql
import { seedData } from "../lib/db/seed";
const s = seedData();
const snake = (k: string) => k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
// Columns stored as jsonb even though the value is an array.
const JSONB = new Set(["lines", "invoices"]);
const lit = (v: unknown, col = ""): string => {
  if (JSONB.has(col)) return `'${JSON.stringify(v ?? []).replace(/'/g, "''")}'::jsonb`;
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) {
    const type = v.length && v.every((x) => typeof x === "number") ? "int[]" : "text[]";
    return v.length ? `array[${v.map((x) => lit(x)).join(",")}]::${type}` : `'{}'::${type}`;
  }
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
};
const ORDER = ["team_members", "employers", "providers", "workers", "credentials", "jobs", "matches", "placements", "training_programs", "screenings", "employer_users", "tasks", "audit_log",
  "assignments", "timesheets", "pay_runs", "payouts", "ratings", "crew_roster", "assessment_attempts", "benefit_plans", "interviews", "pay_reports"] as const;
const out: string[] = ["-- CrewPass demo data (all people and companies are fictional). Safe to re-run.", "begin;"];
for (const t of ORDER) {
  const rows = Object.values((s as any)[t]) as Record<string, unknown>[];
  for (const r of rows) {
    const keys = Object.keys(r).filter((k) => r[k] !== undefined);
    const cols = keys.map(snake);
    out.push(`insert into ${t} (${cols.join(",")}) values (${keys.map((k) => lit(r[k], snake(k))).join(",")}) on conflict (id) do update set ${cols.filter((c) => c !== "id").map((c) => `${c}=excluded.${c}`).join(",")};`);
  }
}
out.push("commit;");
console.log(out.join("\n"));
