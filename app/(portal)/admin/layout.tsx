import { redirect } from "next/navigation";
import { getIdentity, hasRole } from "@/lib/auth/identity";

/** /admin/* is mma_admin-only — everyone else lands on their dashboard. */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await getIdentity();
  if (!hasRole(identity, "mma_admin")) redirect("/dashboard");

  return <>{children}</>;
}
