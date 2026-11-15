// Writes supabase/demo-data.sql from the demo seed: npm run demo:sql
import { seedData } from "../lib/db/seed.ts";
const s = seedData();
const snake = (k: string) => k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
const lit = (v: unknown): string => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) return v.length ? `array[${v.map(lit).join(",")}]::text[]` : "'{}'::text[]";
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
};
const ORDER = ["team_members", "employers", "providers", "workers", "credentials", "jobs", "matches", "placements", "training_programs", "screenings", "employer_users", "tasks", "audit_log"] as const;
const out: string[] = ["-- CrewPass demo data (all people and companies are fictional). Safe to re-run.", "begin;"];
for (const t of ORDER) {
  const rows = Object.values((s as any)[t]) as Record<string, unknown>[];
  for (const r of rows) {
    const keys = Object.keys(r).filter((k) => r[k] !== undefined);
    const cols = keys.map(snake);
    out.push(`insert into ${t} (${cols.join(",")}) values (${keys.map((k) => lit(r[k])).join(",")}) on conflict (id) do update set ${cols.filter((c) => c !== "id").map((c) => `${c}=excluded.${c}`).join(",")};`);
  }
}
out.push("commit;");
console.log(out.join("\n"));
