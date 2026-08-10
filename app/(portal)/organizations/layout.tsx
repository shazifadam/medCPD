import { redirect } from "next/navigation";
import { getIdentity } from "@/lib/auth/identity";
import { canOperateFramework } from "@/lib/framework-admin";

/** Organizations (OG): mma_admin AND cpd_committee (Update 1 follow-up). */
export default async function OrganizationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await getIdentity();
  if (!identity || !canOperateFramework(identity)) redirect("/dashboard");
  return <>{children}</>;
}
