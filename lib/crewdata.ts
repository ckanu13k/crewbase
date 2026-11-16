import "server-only";
// Shared reads for reliability, ratings and test results across many workers.
import { db } from "./db";
import { reliability, type Reliability } from "./reliability";
import { bestResults } from "./assessments";

export async function crewSignals(workerIds?: string[]) {
  const store = await db();
  const [timesheets, ratings, attempts] = await Promise.all([store.table("timesheets").list(), store.table("ratings").list(), store.table("assessment_attempts").list()]);
  const ids = workerIds ?? [...new Set([...timesheets.map((t) => t.workerId), ...ratings.map((r) => r.workerId), ...attempts.map((a) => a.workerId)])];
  const rel: Record<string, Reliability> = {};
  const tests: Record<string, ReturnType<typeof bestResults>> = {};
  for (const id of ids) {
    rel[id] = reliability(timesheets.filter((t) => t.workerId === id), ratings.filter((r) => r.workerId === id));
    tests[id] = bestResults(attempts.filter((a) => a.workerId === id));
  }
  const empty = reliability([], []);
  return { rel: (id: string) => rel[id] ?? empty, tests: (id: string) => tests[id] ?? {}, ratings, timesheets };
}
