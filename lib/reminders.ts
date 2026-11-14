import "server-only";
import { db, todayISO } from "./db";
import { credentialStatus, daysBetween } from "./matching";
import { sendSms } from "./messaging";
import { credLabel } from "./taxonomy";
import { programCovers, sortPrograms } from "./training";
import { appUrl } from "./onboarding/runtime";

/** Days-before-expiry on which we text the worker. Day 0 = the day it expires. */
export const REMINDER_DAYS = [60, 30, 7, 0];

export async function runExpiryReminders(today = todayISO()) {
  const store = await db();
  const [creds, workers, programs] = await Promise.all([
    store.table("credentials").list(),
    store.table("workers").list(),
    store.table("training_programs").list(),
  ]);
  const workerById = Object.fromEntries(workers.map((w) => [w.id, w]));
  const sent: { workerId: string; credential: string; daysLeft: number }[] = [];

  for (const c of creds) {
    if (!c.expiresOn || credentialStatus(c, today) === "expired" && daysBetween(today, c.expiresOn) !== 0) continue;
    const daysLeft = daysBetween(today, c.expiresOn);
    if (!REMINDER_DAYS.includes(daysLeft)) continue;
    const w = workerById[c.workerId];
    if (!w || !w.consentSms) continue;

    const es = w.lang === "es";
    const name = credLabel(c.type, w.lang);
    const renew = sortPrograms(programs.filter((p) => programCovers(p, { kind: "credential_expires_soon", blocking: false, credential: c.type })), today)[0];
    const when = daysLeft === 0 ? (es ? "vence hoy" : "expires today") : es ? `vence en ${daysLeft} días (${c.expiresOn})` : `expires in ${daysLeft} days (${c.expiresOn})`;
    const next = renew
      ? es
        ? ` Próxima clase: ${renew.name}, ${renew.nextStart ?? "fecha por confirmar"}.`
        : ` Next class: ${renew.name}, ${renew.nextStart ?? "date TBD"}.`
      : "";
    await sendSms(w.phone, `CrewPass: ${es ? "Tu" : "Your"} ${name} ${when}.${next} ${appUrl()}/me`);
    sent.push({ workerId: w.id, credential: c.type, daysLeft });
  }
  return sent;
}
