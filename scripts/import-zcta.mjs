// Builds data/zcta.json (ZIP -> [lat, lng]) from the Census Gazetteer ZCTA file.
// Download "ZIP Code Tabulation Areas" from https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html
// Usage: npm run import:zcta -- path/to/2024_Gaz_zcta_national.txt [prefixes]
//   prefixes defaults to Texas ZIPs: 75,76,77,78,79,885
import fs from "node:fs";

const [file, prefixArg = "75,76,77,78,79,885"] = process.argv.slice(2);
if (!file) {
  console.error("Usage: npm run import:zcta -- <gazetteer.txt> [prefixes]");
  process.exit(1);
}
const prefixes = prefixArg.split(",").map((s) => s.trim()).filter(Boolean);
const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
const header = lines[0].split("\t").map((h) => h.trim().toUpperCase());
const iZip = header.indexOf("GEOID");
const iLat = header.indexOf("INTPTLAT");
const iLng = header.indexOf("INTPTLONG");
if (iZip < 0 || iLat < 0 || iLng < 0) throw new Error(`Unexpected header: ${header.join(", ")}`);

const out = {};
for (const line of lines.slice(1)) {
  const cols = line.split("\t").map((c) => c.trim());
  const zip = cols[iZip];
  if (!prefixes.some((p) => zip.startsWith(p))) continue;
  out[zip] = [Number(Number(cols[iLat]).toFixed(4)), Number(Number(cols[iLng]).toFixed(4))];
}
fs.writeFileSync(new URL("../data/zcta.json", import.meta.url), JSON.stringify(out));
console.log(`Wrote ${Object.keys(out).length} ZIP centroids to data/zcta.json. Rebuild the app to use them.`);
