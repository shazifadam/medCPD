import postgres from "postgres";

/**
 * Provider-agnostic database access (Stack discipline #3).
 * All queries go through postgres-js against DATABASE_URL — never the
 * Supabase JS client. Leaving Supabase means re-pointing the connection
 * string, not rewriting queries.
 *
 * Server-only: import this from API routes / server components only.
 */

declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return postgres(url, {
    // Supabase pooler (transaction mode) doesn't support prepared statements
    prepare: false,
    ssl: "require",
    // Server-rendered pages fan out several queries each; the default of 10
    // connections queues up under parallel e2e load (the pooler multiplexes
    // these, so a higher client-side cap is safe).
    max: 20,
  });
}

// Reuse the connection across HMR reloads in dev
export const sql = globalThis.__sql ?? createClient();
if (process.env.NODE_ENV !== "production") globalThis.__sql = sql;
