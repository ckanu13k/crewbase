import "server-only";
// Activity log: who did what, when. Summaries never include report contents or card numbers.
import { db, newId, nowISO } from "./db";
import type { Session } from "./session";

export async function audit(s: Pick<Session, "role" | "actor"> | null, action: string, entityType: string, entityId: string, summary: string) {
  try {
    await (await db()).table("audit_log").upsert({
      id: newId(), at: nowISO(), actorRole: s?.role ?? "system", actor: s?.actor ?? "system", action, entityType, entityId, summary: summary.slice(0, 500),
    });
  } catch (e) {
    // Logging must never block the action itself.
    console.error("[audit] failed:", e instanceof Error ? e.message : e);
  }
}
