"use server";
// Recruiter personal tasks and account assignment.
import { revalidatePath } from "next/cache";
import { db, newId, nowISO } from "@/lib/db";
import { requireCap, requireRole } from "@/lib/session";
import { audit } from "@/lib/audit";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function me() {
  const s = await requireRole("staff");
  if (!s.memberId) throw new Error("No team record");
  return { s, store: await db() };
}

export async function addTask(form: FormData) {
  const { s, store } = await me();
  const title = str(form, "title").slice(0, 200);
  if (!title) return;
  const due = str(form, "dueOn");
  await store.table("tasks").upsert({ id: newId(), ownerId: s.memberId!, title, dueOn: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null, link: str(form, "link") || null, done: false, createdAt: nowISO() });
  revalidatePath("/recruiter/todo");
}

export async function toggleTask(form: FormData) {
  const { s, store } = await me();
  const t = await store.table("tasks").get(str(form, "id"));
  if (!t || t.ownerId !== s.memberId) return;
  await store.table("tasks").upsert({ ...t, done: !t.done });
  revalidatePath("/recruiter/todo");
}

export async function deleteTask(form: FormData) {
  const { s, store } = await me();
  const t = await store.table("tasks").get(str(form, "id"));
  if (!t || t.ownerId !== s.memberId) return;
  await store.table("tasks").remove(t.id);
  revalidatePath("/recruiter/todo");
}

/** Admin: which recruiter owns an employer account. */
export async function assignRecruiter(form: FormData) {
  const s = await requireCap("manageEmployers");
  const store = await db();
  const e = await store.table("employers").get(str(form, "employerId"));
  if (!e) return;
  const recruiterId = str(form, "recruiterId") || null;
  if (recruiterId && !(await store.table("team_members").get(recruiterId))) return;
  await store.table("employers").upsert({ ...e, recruiterId });
  await audit(s, "employer.assigned", "employer", e.id, `${e.name} → ${recruiterId ?? "unassigned"}`);
  revalidatePath("/admin/employers");
  revalidatePath("/recruiter");
}
