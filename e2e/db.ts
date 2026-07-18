import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";

/** Service DB connection for spec setup/teardown (mirrors global-setup). */
export function connectDb() {
  const file = fs.readFileSync(
    path.resolve(__dirname, "..", ".env.local"),
    "utf8"
  );
  const url = file
    .split("\n")
    .find((l) => l.startsWith("DATABASE_URL="))
    ?.slice("DATABASE_URL=".length);
  if (!url) throw new Error("DATABASE_URL missing from .env.local");
  return postgres(url, { prepare: false, ssl: "require" });
}
