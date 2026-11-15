import "server-only";
// Screening providers.
//   manual : staff order in the provider's own portal (e.g. a DISA or lab account) and record the
//            outcome here. The worker authorizes inside CrewPass.
//   checkr : set CHECKR_API_KEY (+ package slugs). The worker authorizes on Checkr's hosted page
//            (it shows Checkr's FCRA disclosure), and results arrive by webhook.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { ScreeningKind, ScreeningProvider } from "../types";

export const activeProvider = (): ScreeningProvider => (process.env.CHECKR_API_KEY ? "checkr" : "manual");

const CHECKR_BASE = process.env.CHECKR_API_BASE || "https://api.checkr.com/v1";

export function checkrPackage(kind: ScreeningKind): string | undefined {
  return kind === "background" ? process.env.CHECKR_PACKAGE_BACKGROUND : process.env.CHECKR_PACKAGE_DRUG;
}

export function kindForPackage(pkg: string | undefined): ScreeningKind | null {
  if (!pkg) return null;
  if (pkg === process.env.CHECKR_PACKAGE_BACKGROUND) return "background";
  if (pkg === process.env.CHECKR_PACKAGE_DRUG) return "drug";
  return null;
}

async function checkr<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(CHECKR_BASE + path, {
    method: "POST",
    headers: {
      authorization: "Basic " + Buffer.from(`${process.env.CHECKR_API_KEY}:`).toString("base64"),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(`Checkr ${path}: ${res.status} ${data?.error ?? ""}`.trim());
  return data;
}

/** Creates the candidate and one hosted invitation per kind. Returns the candidate id and invitation links. */
export async function checkrInvite(opts: {
  firstName: string;
  lastName: string;
  email: string;
  kinds: ScreeningKind[];
  city: string;
}): Promise<{ candidateId: string; invitations: { kind: ScreeningKind; url: string }[] }> {
  const work_locations = [{ country: "US", state: "TX", city: opts.city }];
  const candidate = await checkr<{ id: string }>("/candidates", {
    first_name: opts.firstName,
    last_name: opts.lastName,
    email: opts.email,
    work_locations,
  });
  const invitations: { kind: ScreeningKind; url: string }[] = [];
  for (const kind of opts.kinds) {
    const pkg = checkrPackage(kind);
    if (!pkg) throw new Error(`Set CHECKR_PACKAGE_${kind === "background" ? "BACKGROUND" : "DRUG"} to order a ${kind}.`);
    const inv = await checkr<{ invitation_url: string }>("/invitations", { candidate_id: candidate.id, package: pkg, work_locations });
    invitations.push({ kind, url: inv.invitation_url });
  }
  return { candidateId: candidate.id, invitations };
}

/** Checkr signs the raw body with HMAC-SHA256 (hex) in X-Checkr-Signature. */
export function verifyCheckrSignature(rawBody: string, header: string | null): boolean {
  const key = process.env.CHECKR_WEBHOOK_SECRET || process.env.CHECKR_API_KEY;
  if (!key || !header) return false;
  const expected = createHmac("sha256", key).update(rawBody).digest("hex");
  const got = header.trim().replace(/^sha256=/i, "").toLowerCase();
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] || "Worker", lastName: "-" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}
