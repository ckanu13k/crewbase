"use server";
// Training providers manage their own listings. New listings wait for an admin to approve them;
// edits to an approved listing (dates, cost, notes) go live right away and are logged.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, newId, todayISO } from "@/lib/db";
import { requireCap } from "@/lib/session";
import { audit } from "@/lib/audit";
import { CREDENTIAL_BY_ID, SKILLS, TRADE_BY_ID } from "@/lib/taxonomy";
import type { Funding, Lang, TrainingProgram } from "@/lib/types";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const FUNDING: Funding[] = ["wioa", "workforce_pell", "sdf", "employer", "apprenticeship", "self"];
const SKILL_IDS = new Set(SKILLS.map((s) => s.id));

export async function saveProviderProgram(form: FormData) {
  const s = await requireCap("manageOwnListings");
  const store = await db();
  const provider = s.providerId ? await store.table("providers").get(s.providerId) : null;
  if (!provider) redirect("/");
  const id = str(form, "id");
  const existing = id ? await store.table("training_programs").get(id) : null;
  if (existing && existing.providerId !== provider.id) return;
  const num = (k: string) => (str(form, k) === "" ? null : Math.max(0, Number(str(form, k))));
  const zip = str(form, "zip");
  const row: TrainingProgram = {
    id: existing?.id ?? newId(),
    provider: provider.name,
    providerId: provider.id,
    name: str(form, "name").slice(0, 120) || existing?.name || "Untitled class",
    trade: TRADE_BY_ID[str(form, "trade")] ? str(form, "trade") : null,
    coversCredentials: form.getAll("coversCredentials").map(String).filter((c) => CREDENTIAL_BY_ID[c]),
    coversSkills: form.getAll("coversSkills").map(String).filter((x) => SKILL_IDS.has(x)),
    nccerLevel: num("nccerLevel"),
    city: str(form, "city").slice(0, 60),
    zip: /^\d{5}$/.test(zip) ? zip : existing?.zip ?? "",
    nextStart: /^\d{4}-\d{2}-\d{2}$/.test(str(form, "nextStart")) ? str(form, "nextStart") : null,
    weeks: num("weeks"),
    clockHours: num("clockHours"),
    costUsd: num("costUsd"),
    funding: form.getAll("funding").map(String).filter((f): f is Funding => FUNDING.includes(f as Funding)),
    languages: form.getAll("languages").map(String).filter((l): l is Lang => l === "en" || l === "es"),
    url: /^https:\/\//.test(str(form, "url")) ? str(form, "url") : null,
    sample: existing?.sample ?? false,
    requirementNote: str(form, "requirementNote").slice(0, 500) || null,
    reviewedOn: todayISO(),
    status: existing?.status ?? "pending",
  };
  if (!row.languages.length) row.languages = ["en"];
  await store.table("training_programs").upsert(row);
  await audit(s, existing ? "training.provider_updated" : "training.provider_submitted", "training", row.id, `${provider.name} ${existing ? "updated" : "submitted"} "${row.name}"${row.nextStart ? `, next start ${row.nextStart}` : ""}`);
  revalidatePath("/provider");
  revalidatePath("/training");
  revalidatePath("/admin/training");
  redirect(existing ? "/provider?saved=1" : "/provider?submitted=1");
}

export async function deleteProviderProgram(form: FormData) {
  const s = await requireCap("manageOwnListings");
  const store = await db();
  const p = await store.table("training_programs").get(str(form, "id"));
  if (!p || !s.providerId || p.providerId !== s.providerId) return;
  await store.table("training_programs").remove(p.id);
  await audit(s, "training.provider_deleted", "training", p.id, `Provider removed "${p.name}"`);
  revalidatePath("/provider");
  revalidatePath("/training");
}

/** Admin: add a provider account (their contact email signs in) and approve listings. */
export async function createProvider(form: FormData) {
  const s = await requireCap("manageTraining");
  const store = await db();
  const email = str(form, "email").toLowerCase();
  if (!str(form, "name") || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect("/admin/training?perr=1");
  const id = newId();
  await store.table("providers").upsert({ id, name: str(form, "name"), contactEmail: email, website: /^https:\/\//.test(str(form, "website")) ? str(form, "website") : null, createdAt: new Date().toISOString() });
  await audit(s, "provider.created", "provider", id, `Added training provider ${str(form, "name")} (${email})`);
  revalidatePath("/admin/training");
}

export async function setProgramStatus(form: FormData) {
  const s = await requireCap("manageTraining");
  const store = await db();
  const p = await store.table("training_programs").get(str(form, "id"));
  if (!p) return;
  const status = str(form, "status") === "pending" ? "pending" : "published";
  await store.table("training_programs").upsert({ ...p, status });
  await audit(s, status === "published" ? "training.approved" : "training.unpublished", "training", p.id, `${status === "published" ? "Approved" : "Unpublished"} "${p.name}"`);
  revalidatePath("/admin/training");
  revalidatePath("/training");
  revalidatePath("/provider");
}
