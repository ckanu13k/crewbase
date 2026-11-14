import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Rows, Store, Table, TableName } from "./index";

const BUCKET = "credentials";

const snake = (s: string) => s.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
const camel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

function mapKeys(o: Record<string, unknown>, f: (k: string) => string) {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [f(k), v]));
}

export function createSupabaseStore(): Store {
  const client: SupabaseClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  function table<N extends TableName>(name: N): Table<Rows[N]> {
    const toRow = (r: Record<string, unknown>) => mapKeys(r, camel) as unknown as Rows[N];
    return {
      async list(where) {
        let q = client.from(name).select("*");
        for (const [k, v] of Object.entries(where ?? {})) q = q.eq(snake(k), v as string);
        const { data, error } = await q.limit(5000);
        if (error) throw new Error(`${name}.list: ${error.message}`);
        return (data ?? []).map(toRow);
      },
      async get(id) {
        const { data, error } = await client.from(name).select("*").eq("id", id).maybeSingle();
        if (error) throw new Error(`${name}.get: ${error.message}`);
        return data ? toRow(data) : null;
      },
      async upsert(row) {
        const { data, error } = await client
          .from(name)
          .upsert(mapKeys(row as unknown as Record<string, unknown>, snake))
          .select("*")
          .single();
        if (error) throw new Error(`${name}.upsert: ${error.message}`);
        return toRow(data);
      },
      async remove(id) {
        const { error } = await client.from(name).delete().eq("id", id);
        if (error) throw new Error(`${name}.remove: ${error.message}`);
      },
    };
  }

  return {
    kind: "supabase",
    table,
    async saveFile(path, bytes, contentType) {
      const { error } = await client.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
      if (error) throw new Error(`storage.upload: ${error.message}`);
      return path;
    },
    async readFile(path) {
      const { data, error } = await client.storage.from(BUCKET).download(path);
      if (error || !data) return null;
      return { bytes: new Uint8Array(await data.arrayBuffer()), contentType: data.type || "image/jpeg" };
    },
  };
}
