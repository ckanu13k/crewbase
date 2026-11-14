import "server-only";
import { cookies } from "next/headers";
import { AREAS, areaLabel, nearestZip, pointOf, zipToPoint, type Point } from "./geo";
import type { Worker } from "./types";

export const LOC_COOKIE = "cp_loc";

export interface UserLocation {
  point: Point;
  zip: string | null;
  label: string; // "Pasadena (77506)" or "near 77506"
  source: "device" | "zip";
}

/** Rounded to 2 decimals (about half a mile): precise enough for matching, not a home address. */
export const roundCoord = (x: number) => Math.round(x * 100) / 100;

export function describe(zip: string | null, source: UserLocation["source"]): string {
  if (!zip) return source === "device" ? "your location" : "—";
  const area = areaLabel(zip);
  return area ? `${area} (${zip})` : zip;
}

function fromParts(lat: number | null | undefined, lng: number | null | undefined, zip: string | null | undefined): UserLocation | null {
  const point = pointOf({ lat, lng, zip });
  if (!point) return null;
  const exact = typeof lat === "number" && typeof lng === "number";
  return { point, zip: zip ?? null, label: describe(zip ?? null, exact ? "device" : "zip"), source: exact ? "device" : "zip" };
}

/** Where to search from: the worker's saved location, else what this browser picked. */
export async function getUserLocation(worker?: Worker | null): Promise<UserLocation | null> {
  if (worker) {
    const loc = fromParts(worker.lat, worker.lng, worker.zip);
    if (loc) return loc;
  }
  const raw = (await cookies()).get(LOC_COOKIE)?.value;
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { lat?: number; lng?: number; zip?: string };
    return fromParts(v.lat ?? null, v.lng ?? null, v.zip ?? null);
  } catch {
    return null;
  }
}

/** Validate a picker request into {lat, lng, zip}. */
export function resolvePick(input: { lat?: unknown; lng?: unknown; zip?: unknown }): { lat: number | null; lng: number | null; zip: string } | { error: string } {
  if (typeof input.lat === "number" && typeof input.lng === "number") {
    const { lat, lng } = input;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return { error: "Bad coordinates" };
    const near = nearestZip(lat, lng);
    if (!near || near.miles > 40) return { error: "outside" };
    return { lat: roundCoord(lat), lng: roundCoord(lng), zip: near.zip };
  }
  const zip = String(input.zip ?? "").trim();
  if (!/^\d{5}$/.test(zip)) return { error: "zip" };
  if (!zipToPoint(zip)) return { error: "unknownZip" };
  return { lat: null, lng: null, zip };
}

export { AREAS };
