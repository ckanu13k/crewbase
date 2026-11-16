import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Rows, Store, Table, TableName } from "./index";
import { seedData } from "./seed";

type Data = { [N in TableName]: Record<string, Rows[N]> };

// Serverless hosts (Vercel) only allow writes under /tmp. Demo data there is per-instance and temporary.
const DIR = process.env.VERCEL ? "/tmp/crewpass-demo" : path.join(process.cwd(), ".data");
const FILE = path.join(DIR, "demo.json");
const UPLOADS = path.join(DIR, "uploads");

const g = globalThis as unknown as { __crewpassData?: Data; __crewpassSaveTimer?: NodeJS.Timeout };

async function load(): Promise<Data> {
  if (g.__crewpassData) return g.__crewpassData;
  try {
    g.__crewpassData = JSON.parse(await fs.readFile(FILE, "utf8")) as Data;
  } catch {
    g.__crewpassData = seedData();
    await persist(g.__crewpassData);
  }
  return g.__crewpassData;
}

async function persist(data: Data) {
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(data, null, 1));
}

function schedulePersist(data: Data) {
  if (g.__crewpassSaveTimer) clearTimeout(g.__crewpassSaveTimer);
  g.__crewpassSaveTimer = setTimeout(() => void persist(data), 150);
}

export async function createMemoryStore(): Promise<Store> {
  await load();
  // Always read the live object: "Reset demo data" swaps it out, and the store itself may be cached.
  const current = () => g.__crewpassData!;

  function table<N extends TableName>(name: N): Table<Rows[N]> {
    const rows = () => (current()[name] ??= {} as Data[N]) as Record<string, Rows[N]>;
    return {
      async list(where) {
        const all = Object.values(rows());
        if (!where) return structuredClone(all);
        const entries = Object.entries(where) as [keyof Rows[N], unknown][];
        return structuredClone(all.filter((r) => entries.every(([k, v]) => r[k] === v)));
      },
      async get(id) {
        const r = rows()[id];
        return r ? structuredClone(r) : null;
      },
      async upsert(row) {
        rows()[row.id] = structuredClone(row);
        schedulePersist(current());
        return row;
      },
      async remove(id) {
        delete rows()[id];
        schedulePersist(current());
      },
    };
  }

  return {
    kind: "memory",
    table,
    async saveFile(p, bytes, contentType) {
      const full = path.join(UPLOADS, p);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, bytes);
      await fs.writeFile(full + ".type", contentType);
      return p;
    },
    async removeFile(p) {
      const full = path.join(UPLOADS, path.normalize(p).replace(/^(\.\.[/\\])+/, ""));
      await Promise.all([fs.rm(full, { force: true }), fs.rm(full + ".type", { force: true })]);
    },
    async readFile(p) {
      const full = path.join(UPLOADS, path.normalize(p).replace(/^(\.\.[/\\])+/, ""));
      try {
        const [bytes, contentType] = await Promise.all([fs.readFile(full), fs.readFile(full + ".type", "utf8")]);
        return { bytes: new Uint8Array(bytes), contentType };
      } catch {
        return null;
      }
    },
  };
}

/** Wipe demo data back to the seed (used by the "Reset demo" button). */
export async function resetMemoryStore() {
  if (g.__crewpassSaveTimer) clearTimeout(g.__crewpassSaveTimer); // don't let a pending save write the old data back
  g.__crewpassData = seedData();
  await persist(g.__crewpassData);
  await fs.rm(UPLOADS, { recursive: true, force: true });
}
