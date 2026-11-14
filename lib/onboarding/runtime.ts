import "server-only";
import { db, newId, nowISO, todayISO } from "../db";
import { extractProfile } from "../ai/extract";
import { readCardPhoto } from "../ai/credential";
import type { EngineDeps } from "./engine";

export function appUrl(fallbackOrigin?: string): string {
  return (process.env.APP_URL || fallbackOrigin || "http://localhost:3000").replace(/\/$/, "");
}

/** Twilio media URLs need the account's basic auth. */
async function fetchMedia(url: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const res = await fetch(url, { headers: sid && token ? { Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64") } : {} });
  if (!res.ok) throw new Error(`media fetch ${res.status}`);
  return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "image/jpeg" };
}

export async function engineDeps(origin?: string): Promise<EngineDeps> {
  return {
    store: await db(),
    extract: extractProfile,
    readCard: readCardPhoto,
    fetchMedia,
    appUrl: appUrl(origin),
    today: todayISO(),
    newId,
    now: nowISO,
  };
}
