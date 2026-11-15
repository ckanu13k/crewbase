"use server";
// Employer company logins: the contact (owner) adds or removes hiring managers.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, isDemo, newId, nowISO } from "@/lib/db";
import { requireEmployer } from "@/lib/session";
import { employerFor } from "@/lib/team";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/onboarding/runtime";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function owner() {
  const s = await requireEmployer();
  const isOwner = isDemo() || s.role === "admin" || (await employerFor(s.actor))?.role === "owner";
  if (!isOwner) redirect("/employer/team?err=owner");
  return { s, store: await db() };
}

export async function addEmployerUser(form: FormData) {
  const { s, store } = await owner();
  const email = str(form, "email").toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect("/employer/team?err=email");
  const taken = (await store.table("employer_users").list()).some((u) => u.email.toLowerCase() === email)
    || (await store.table("employers").list()).some((e) => e.email.toLowerCase() === email)
    || (await store.table("team_members").list()).some((m) => m.email.toLowerCase() === email);
  if (taken) redirect("/employer/team?err=taken");
  const id = newId();
  await store.table("employer_users").upsert({ id, employerId: s.employerId, email, name: str(form, "name"), role: "hiring_manager", createdAt: nowISO() });
  const employer = await store.table("employers").get(s.employerId);
  await sendEmail(email, `You've been added to ${employer?.name ?? "your company"} on CrewPass`, `Sign in with this email to see your company's jobs, shortlists and hires: ${appUrl()}/login`);
  await audit(s, "employer_user.added", "employer", s.employerId, `Added hiring manager ${email}`);
  revalidatePath("/employer/team");
  redirect("/employer/team?ok=1");
}

export async function removeEmployerUser(form: FormData) {
  const { s, store } = await owner();
  const u = await store.table("employer_users").get(str(form, "id"));
  if (!u || u.employerId !== s.employerId) return;
  await store.table("employer_users").remove(u.id);
  await audit(s, "employer_user.removed", "employer", s.employerId, `Removed hiring manager ${u.email}`);
  revalidatePath("/employer/team");
}
