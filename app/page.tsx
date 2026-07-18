import { redirect } from "next/navigation";

/**
 * The portal has no public home — signed-out visitors are bounced to /login
 * by middleware before this runs; signed-in users land on their dashboard
 * (role-specific redirects happen at sign-in; /dashboard is the shared
 * fallback since every role has practitioner pages).
 */
export default function Home() {
  redirect("/dashboard");
}
