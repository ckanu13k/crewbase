// Serves credential photos to the worker who owns them and to staff. Never public.
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { getSession } from "@/lib/session";

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const p = path.join("/");
  const s = await getSession();
  const ownerId = path[0];
  if (path.some((seg) => seg === ".." || seg === "." || seg.includes("\\"))) return new Response("Not found", { status: 404 });
  if (!s || (!can(s.role, "viewAllCards") && s.workerId !== ownerId)) return new Response("Not found", { status: 404 });
  const file = await (await db()).readFile(p);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(file.bytes), { headers: { "Content-Type": file.contentType, "Cache-Control": "private, max-age=300" } });
}
