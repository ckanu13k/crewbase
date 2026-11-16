// Interview scheduling. Pure functions, tested in newfeatures.test.ts.
// Times are wall-clock in America/Chicago ("YYYY-MM-DDTHH:MM", the value a datetime-local input sends).

import type { Interview } from "./types";

export const MAX_SLOTS = 3;
const SLOT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Current wall-clock time in Chicago, same format. */
export function chicagoNow(d = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Keep well-formed, future, distinct slots, earliest first, at most MAX_SLOTS. */
export function cleanSlots(raw: string[], now: string): string[] {
  const ok = [...new Set(raw.map((s) => s.trim()).filter((s) => SLOT_RE.test(s) && s > now))].sort();
  return ok.slice(0, MAX_SLOTS);
}

export function slotLabel(slot: string, es = false): string {
  const d = new Date(slot + ":00Z");
  return d.toLocaleString(es ? "es-MX" : "en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const MODE = { in_person: { en: "In person", es: "En persona" }, phone: { en: "Phone", es: "Por teléfono" }, video: { en: "Video call", es: "Videollamada" } };
export const modeLabel = (m: Interview["mode"], es = false) => MODE[m][es ? "es" : "en"];

const icsEsc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const icsTime = (slot: string) => slot.replace(/[-:]/g, "") + "00";

/** A one-event calendar file for a booked interview (30 minutes). */
export function interviewIcs(i: Interview, title: string, stamp = new Date()): string {
  if (!i.chosenSlot) throw new Error("not booked");
  const start = i.chosenSlot;
  const endD = new Date(start + ":00Z");
  endD.setUTCMinutes(endD.getUTCMinutes() + 30);
  const end = endD.toISOString().slice(0, 16);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CrewPass//Interviews//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${i.id}@crewpass`,
    `DTSTAMP:${stamp.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART;TZID=America/Chicago:${icsTime(start)}`,
    `DTEND;TZID=America/Chicago:${icsTime(end)}`,
    `SUMMARY:${icsEsc(title)}`,
    `LOCATION:${icsEsc(i.location || modeLabel(i.mode))}`,
    `DESCRIPTION:${icsEsc(`${modeLabel(i.mode)} interview arranged through CrewPass.`)}`,
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
}
