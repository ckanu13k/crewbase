"use server";
// Admin-only: team management.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, newId, nowISO } from "@/lib/db";
import { requireCap } from "@/lib/session";
import { envAdmins } from "@/lib/team";
import type { TeamMember } from "@/lib/types";
import { audit } from "@/lib/audit";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function addTeamMember(form: FormData) {
  const s = await requireCap("manageTeam");
  const store = await db();
  const email = str(form, "email").toLowerCase();
  const role = str(form, "role") === "admin" ? "admin" : "recruiter";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect("/admin/team?err=email");
  const existing = (await store.table("team_members").list()).find((m) => m.email.toLowerCase() === email);
  const row: TeamMember = existing
    ? { ...existing, role, name: str(form, "name") || existing.name }
    : { id: newId(), email, name: str(form, "name"), role, createdAt: nowISO() };
  await store.table("team_members").upsert(row);
  await audit(s, existing ? "team.updated" : "team.added", "team_member", row.id, `${existing ? "Updated" : "Added"} ${email} as ${role}`);
  revalidatePath("/admin/team");
  redirect("/admin/team?ok=1");
}

export async function setTeamRole(form: FormData) {
  const s = await requireCap("manageTeam");
  const store = await db();
  const m = await store.table("team_members").get(str(form, "id"));
  if (!m) return;
  const role = str(form, "role") === "admin" ? "admin" : "recruiter";
  const members = await store.table("team_members").list();
  // Never demote the last admin (owners in ADMIN_EMAILS always count).
  if (m.role === "admin" && role !== "admin" && envAdmins().length === 0 && members.filter((x) => x.role === "admin").length <= 1) redirect("/admin/team?err=last");
  await store.table("team_members").upsert({ ...m, role });
  await audit(s, "team.role", "team_member", m.id, `${m.email}: ${m.role} → ${role}`);
  revalidatePath("/admin/team");
}

export async function removeTeamMember(form: FormData) {
  const s = await requireCap("manageTeam");
  const store = await db();
  const m = await store.table("team_members").get(str(form, "id"));
  if (!m) return;
  const members = await store.table("team_members").list();
  if (m.role === "admin" && envAdmins().length === 0 && members.filter((x) => x.role === "admin").length <= 1) redirect("/admin/team?err=last");
  await store.table("team_members").remove(m.id);
  await audit(s, "team.removed", "team_member", m.id, `Removed ${m.email} (${m.role})`);
  revalidatePath("/admin/team");
}

// ---------------- Settings ----------------

export async function saveAppSettings(form: FormData) {
  const s = await requireCap("settings");
  const { SETTING_DEFS, saveSettings } = await import("@/lib/settings");
  const input: Record<string, number> = {};
  for (const k of Object.keys(SETTING_DEFS)) {
    const v = str(form, k);
    if (v !== "") input[k] = Number(v);
  }
  const changed = await saveSettings(input, s.actor);
  if (changed.length) await audit(s, "settings.changed", "settings", "app", changed.join("; "));
  revalidatePath("/admin/settings");
  redirect(`/admin/settings?saved=${changed.length}`);
}

// ---------------- Demo data ----------------

/** Fictional demo rows use short ids (w1, e1, j1…) or @example.com emails; real rows use UUIDs. */
export async function deleteDemoData(form: FormData) {
  const s = await requireCap("settings");
  if (str(form, "confirm") !== "DELETE DEMO DATA") redirect("/admin/settings?demo=confirm");
  const store = await db();
  const short = (prefix: string) => new RegExp(`^${prefix}\\d+$`);
  let n = 0;
  const wipe = async <T extends { id: string }>(name: Parameters<typeof store.table>[0], keep: (row: T) => boolean) => {
    const t = store.table(name) as unknown as { list(): Promise<T[]>; remove(id: string): Promise<void> };
    for (const row of await t.list()) if (!keep(row)) { await t.remove(row.id); n++; }
  };
  await wipe<{ id: string }>("screenings", (r) => !short("s").test(r.id));
  await wipe<{ id: string }>("placements", (r) => !short("p").test(r.id));
  await wipe<{ id: string }>("matches", (r) => !short("m").test(r.id));
  await wipe<{ id: string }>("credentials", (r) => !short("c").test(r.id));
  await wipe<{ id: string }>("tasks", (r) => !short("tk").test(r.id));
  await wipe<{ id: string }>("employer_users", (r) => !short("eu").test(r.id));
  await wipe<{ id: string }>("jobs", (r) => !short("j").test(r.id));
  await wipe<{ id: string }>("workers", (r) => !short("w").test(r.id));
  await wipe<{ id: string; sample?: boolean }>("training_programs", (r) => !(r.sample && short("t").test(r.id)));
  await wipe<{ id: string }>("providers", (r) => !short("pr").test(r.id));
  await wipe<{ id: string }>("employers", (r) => !short("e").test(r.id));
  await wipe<{ id: string; email?: string }>("team_members", (r) => !(short("tm").test(r.id) && /@example\.com$/i.test(r.email ?? "")));
  await audit(s, "demo.deleted", "settings", "demo", `Deleted ${n} fictional demo rows`);
  revalidatePath("/", "layout");
  redirect(`/admin/settings?demo=deleted&n=${n}`);
}
