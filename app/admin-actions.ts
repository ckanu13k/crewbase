"use server";
// Admin-only: team management.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, newId, nowISO } from "@/lib/db";
import { requireCap } from "@/lib/session";
import { envAdmins } from "@/lib/team";
import type { TeamMember } from "@/lib/types";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function addTeamMember(form: FormData) {
  await requireCap("manageTeam");
  const store = await db();
  const email = str(form, "email").toLowerCase();
  const role = str(form, "role") === "admin" ? "admin" : "recruiter";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect("/admin/team?err=email");
  const existing = (await store.table("team_members").list()).find((m) => m.email.toLowerCase() === email);
  const row: TeamMember = existing
    ? { ...existing, role, name: str(form, "name") || existing.name }
    : { id: newId(), email, name: str(form, "name"), role, createdAt: nowISO() };
  await store.table("team_members").upsert(row);
  revalidatePath("/admin/team");
  redirect("/admin/team?ok=1");
}

export async function setTeamRole(form: FormData) {
  await requireCap("manageTeam");
  const store = await db();
  const m = await store.table("team_members").get(str(form, "id"));
  if (!m) return;
  const role = str(form, "role") === "admin" ? "admin" : "recruiter";
  const members = await store.table("team_members").list();
  // Never demote the last admin (owners in ADMIN_EMAILS always count).
  if (m.role === "admin" && role !== "admin" && envAdmins().length === 0 && members.filter((x) => x.role === "admin").length <= 1) redirect("/admin/team?err=last");
  await store.table("team_members").upsert({ ...m, role });
  revalidatePath("/admin/team");
}

export async function removeTeamMember(form: FormData) {
  await requireCap("manageTeam");
  const store = await db();
  const m = await store.table("team_members").get(str(form, "id"));
  if (!m) return;
  const members = await store.table("team_members").list();
  if (m.role === "admin" && envAdmins().length === 0 && members.filter((x) => x.role === "admin").length <= 1) redirect("/admin/team?err=last");
  await store.table("team_members").remove(m.id);
  revalidatePath("/admin/team");
}
