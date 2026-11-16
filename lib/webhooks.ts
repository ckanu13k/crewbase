// Outgoing webhooks to an employer's applicant-tracking system (ATS).
// Every delivery is signed: header X-CrewPass-Signature = hex HMAC-SHA256 of "<timestamp>.<body>" with the
// employer's secret, and X-CrewPass-Timestamp = unix seconds. Payloads carry first name + last initial,
// trade and verified cards only — no phone, email, address or screening details.
//
// The URL is employer-supplied, so it is checked before every send: https only, no IP literals,
// no internal hostnames, and the DNS answer must not be a private or loopback address.

import { createHmac, randomBytes } from "node:crypto";

export type WebhookEvent = "candidate.sent" | "interview.booked" | "worker.hired" | "test";

const BLOCKED_HOSTS = /(^|\.)(localhost|local|internal|intranet|lan|home|corp)$/i;

export function isSafeWebhookUrl(raw: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "Not a valid URL." };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "Use an https:// address." };
  if (url.username || url.password) return { ok: false, reason: "Don't put a username or password in the URL." };
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (/^[\d.]+$/.test(host) || host.includes(":")) return { ok: false, reason: "Use a hostname, not an IP address." };
  if (!host.includes(".") || BLOCKED_HOSTS.test(host)) return { ok: false, reason: "That host isn't reachable from the internet." };
  if (url.port && !["443", "8443"].includes(url.port)) return { ok: false, reason: "Use the standard https port." };
  return { ok: true, url };
}

/** Loopback, private, link-local, CGNAT, multicast and other non-public addresses. */
export function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v.includes(":")) {
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("fe80") || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("ff")) return true;
    const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateIp(mapped[1]) : false;
  }
  const p = v.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

export function signPayload(secret: string, timestamp: number, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export const newWebhookSecret = () => "whsec_" + randomBytes(24).toString("hex");

export interface DeliveryResult {
  ok: boolean;
  status: number | null;
  error: string | null;
}

/** Send one event. Never throws. */
export async function deliverWebhook(urlRaw: string, secret: string, event: WebhookEvent, data: Record<string, unknown>): Promise<DeliveryResult> {
  const check = isSafeWebhookUrl(urlRaw);
  if (!check.ok) return { ok: false, status: null, error: check.reason };
  try {
    const { lookup } = await import("node:dns/promises");
    const addrs = await lookup(check.url.hostname, { all: true });
    if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) return { ok: false, status: null, error: "Host resolves to a private address." };
  } catch {
    return { ok: false, status: null, error: "Host not found." };
  }
  const body = JSON.stringify({ event, sentAt: new Date().toISOString(), data });
  const ts = Math.floor(Date.now() / 1000);
  try {
    const res = await fetch(check.url, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
      headers: { "content-type": "application/json", "user-agent": "CrewPass-Webhooks/1", "x-crewpass-event": event, "x-crewpass-timestamp": String(ts), "x-crewpass-signature": signPayload(secret, ts, body) },
      body,
    });
    return { ok: res.status >= 200 && res.status < 300, status: res.status, error: res.ok ? null : `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, status: null, error: e instanceof Error ? e.name : "Failed" };
  }
}

export function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  // Neutralize spreadsheet formulas in exported text.
  const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
