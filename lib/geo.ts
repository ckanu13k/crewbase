// Locations: ZIP centroids, distances, nearest ZIP and named areas.
//
// data/zcta.json holds official U.S. Census 2024 Gazetteer ZCTA centroids for the 77xxx ZIPs
// (Greater Houston, Golden Triangle, Brazos Valley, Victoria). Run `npm run import:zcta` to add more.
// Exact coordinates (from a device's location, or a job site) take priority over ZIP centroids.
import zcta from "@/data/zcta.json";

export type Point = [number, number]; // [lat, lng]

const TABLE = zcta as unknown as Record<string, Point>;
const ZIPS = Object.keys(TABLE);

export function zipToPoint(zip: string | null | undefined): Point | null {
  if (!zip) return null;
  return TABLE[zip.trim().slice(0, 5)] ?? null;
}

export function knownZips(): string[] {
  return [...ZIPS].sort();
}

/** Exact point if present, else the ZIP centroid. */
export function pointOf(x: { lat?: number | null; lng?: number | null; zip?: string | null }): Point | null {
  if (typeof x.lat === "number" && typeof x.lng === "number" && Number.isFinite(x.lat) && Number.isFinite(x.lng)) return [x.lat, x.lng];
  return zipToPoint(x.zip ?? null);
}

export function milesBetween(a: Point, b: Point): number {
  const R = 3958.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function distanceMiles(a: Parameters<typeof pointOf>[0], b: Parameters<typeof pointOf>[0]): number | null {
  const pa = pointOf(a);
  const pb = pointOf(b);
  return pa && pb ? milesBetween(pa, pb) : null;
}

/** Kept for older callers. */
export function zipDistance(a: string | null, b: string | null): number | null {
  return distanceMiles({ zip: a }, { zip: b });
}

/** Closest known ZIP to a point, with its distance in miles. */
export function nearestZip(lat: number, lng: number): { zip: string; miles: number } | null {
  let best: { zip: string; miles: number } | null = null;
  for (const z of ZIPS) {
    const m = milesBetween([lat, lng], TABLE[z]);
    if (!best || m < best.miles) best = { zip: z, miles: m };
  }
  return best;
}

/** Named areas for people who'd rather pick a place than share their location. */
export const AREAS: { label: string; zip: string }[] = [
  { label: "Downtown Houston", zip: "77002" },
  { label: "Pasadena", zip: "77506" },
  { label: "Deer Park", zip: "77536" },
  { label: "La Porte", zip: "77571" },
  { label: "Baytown", zip: "77520" },
  { label: "Channelview", zip: "77530" },
  { label: "Galena Park", zip: "77547" },
  { label: "South Houston", zip: "77587" },
  { label: "Pearland", zip: "77581" },
  { label: "League City", zip: "77573" },
  { label: "Texas City", zip: "77590" },
  { label: "Alief", zip: "77072" },
  { label: "Katy", zip: "77449" },
  { label: "Cypress", zip: "77429" },
  { label: "Spring", zip: "77373" },
  { label: "The Woodlands", zip: "77381" },
  { label: "Humble", zip: "77338" },
  { label: "Conroe", zip: "77301" },
  { label: "Sugar Land", zip: "77479" },
  { label: "Missouri City", zip: "77489" },
  { label: "Freeport", zip: "77541" },
  { label: "Park Place", zip: "77017" },
  { label: "Jacinto City", zip: "77029" },
  { label: "Cloverleaf", zip: "77015" },
  { label: "Sharpstown", zip: "77036" },
  { label: "West Houston", zip: "77084" },
  { label: "Stafford", zip: "77477" },
  { label: "Beaumont", zip: "77701" },
  { label: "Port Arthur", zip: "77640" },
];

export function areaLabel(zip: string | null | undefined): string | null {
  return AREAS.find((a) => a.zip === zip)?.label ?? null;
}
