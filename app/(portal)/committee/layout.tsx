import { redirect } from "next/navigation";
import { getIdentity, hasRole } from "@/lib/auth/identity";

/** /committee/* is cpd_committee-only (admin passes too — full oversight). */
export default async function CommitteeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await getIdentity();
  if (!hasRole(identity, "cpd_committee") && !hasRole(identity, "mma_admin")) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
