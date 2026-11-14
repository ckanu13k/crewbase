// ZIP -> approximate centroid, and distance in miles.
//
// HOUSTON_ZIPS is a small built-in table of APPROXIMATE centroids (about ±1 mile) so the demo works
// offline. For production run `npm run import:zcta` with the Census Gazetteer ZCTA file; it fills
// data/zcta.json, which takes priority over this table.
import zcta from "@/data/zcta.json";

const HOUSTON_ZIPS: Record<string, [number, number]> = {
  "77002": [29.756, -95.365], "77003": [29.749, -95.346], "77004": [29.724, -95.363],
  "77007": [29.771, -95.411], "77008": [29.799, -95.411], "77012": [29.718, -95.276],
  "77015": [29.785, -95.185], "77017": [29.686, -95.255], "77029": [29.762, -95.259],
  "77036": [29.700, -95.535], "77040": [29.874, -95.528], "77057": [29.743, -95.488],
  "77060": [29.934, -95.398], "77072": [29.700, -95.585], "77084": [29.830, -95.660],
  "77092": [29.832, -95.474], "77381": [30.170, -95.495], "77429": [29.982, -95.664],
  "77449": [29.836, -95.735], "77450": [29.746, -95.738], "77479": [29.578, -95.630],
  "77493": [29.866, -95.830], "77494": [29.740, -95.825], "77502": [29.679, -95.199],
  "77506": [29.708, -95.200], "77520": [29.747, -94.965], "77530": [29.789, -95.117],
  "77536": [29.687, -95.115], "77546": [29.520, -95.190], "77571": [29.669, -95.040],
  "77573": [29.500, -95.090], "77581": [29.562, -95.270], "77587": [29.660, -95.226],
  "77590": [29.400, -94.920],
};

const TABLE = zcta as Record<string, [number, number]>;

export function zipToPoint(zip: string | null | undefined): [number, number] | null {
  if (!zip) return null;
  const z = zip.trim().slice(0, 5);
  return TABLE[z] ?? HOUSTON_ZIPS[z] ?? null;
}

export function knownZips(): string[] {
  return Object.keys({ ...HOUSTON_ZIPS, ...TABLE }).sort();
}

export function milesBetween(a: [number, number], b: [number, number]): number {
  const R = 3958.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function zipDistance(a: string | null, b: string | null): number | null {
  const pa = zipToPoint(a);
  const pb = zipToPoint(b);
  return pa && pb ? milesBetween(pa, pb) : null;
}
