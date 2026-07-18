/**
 * Auth seam — application code imports from "@/lib/auth" only.
 * The active implementation is Supabase Auth; the fallback stack
 * (Auth.js / Lucia) swaps the re-export below, nothing else.
 */
export { auth } from "./supabase";
export type {
  AuthProvider,
  AuthUser,
  Session,
  Role,
  SignUpMetadata,
} from "./types";
