import "server-only";
// Daily job alerts: new jobs (posted in the last 24 h) that a worker meets every requirement for.
// Email for workers who chose email; one text with the best new match for those who chose text.
import { db, todayISO } from "./db";
import { evaluateMatch } from "./matching";
import { sendEmail } from "./email";
import { sendSms } from "./messaging";
import { appUrl } from "./onboarding/runtime";
import type { Credential } from "./types";

export async function runJobAlerts(now = Date.now()) {
  const store = await db();
  const today = todayISO();
  const since = new Date(now - 24 * 3600 * 1000).toISOString();
  const [workers, creds, jobs] = await Promise.all([store.table("workers").list(), store.table("credentials").list(), store.table("jobs").list()]);
  const fresh = jobs.filter((j) => j.status === "open" && j.createdAt >= since);
  if (!fresh.length) return [];
  const byWorker: Record<string, Credential[]> = {};
  for (const c of creds) (byWorker[c.workerId] ??= []).push(c);
  const sent: { workerId: string; channel: string; jobs: number }[] = [];
  for (const w of workers) {
    if (!w.onboardingComplete || (w.alerts ?? "sms") === "none") continue;
    const fits = fresh
      .map((j) => ({ j, r: evaluateMatch(w, byWorker[w.id] ?? [], j, today) }))
      .filter((x) => x.r.eligible)
      .sort((a, b) => b.r.score - a.r.score);
    if (!fits.length) continue;
    const es = w.lang === "es";
    if (w.alerts === "email" && w.email) {
      const lines = fits.map(({ j }) => `• ${j.title} — $${j.payMin}-${j.payMax}/hr, ${es ? "empieza" : "starts"} ${j.startDate}: ${appUrl()}/me/jobs/${j.id}`).join("\n");
      await sendEmail(w.email, es ? `${fits.length} trabajo(s) nuevo(s) para ti` : `${fits.length} new job(s) that fit you`, `${lines}\n\n${es ? "Cambia tus alertas en tu perfil" : "Change alerts in your profile"}: ${appUrl()}/me/profile`);
      sent.push({ workerId: w.id, channel: "email", jobs: fits.length });
    } else if ((w.alerts ?? "sms") === "sms" && w.consentSms) {
      const { j } = fits[0];
      await sendSms(w.phone, es
        ? `CrewPass: Trabajo nuevo que te queda: ${j.title}, $${j.payMin}-${j.payMax}/hr. ${appUrl()}/me/jobs/${j.id}${fits.length > 1 ? ` (+${fits.length - 1} más)` : ""}. STOP para salir.`
        : `CrewPass: New job that fits you: ${j.title}, $${j.payMin}-${j.payMax}/hr. ${appUrl()}/me/jobs/${j.id}${fits.length > 1 ? ` (+${fits.length - 1} more)` : ""}. Reply STOP to opt out.`);
      sent.push({ workerId: w.id, channel: "sms", jobs: fits.length });
    }
  }
  return sent;
}
