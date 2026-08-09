import { redirect } from "next/navigation";
import { getIdentity } from "@/lib/auth/identity";
import { canOperateFramework } from "@/lib/framework-admin";

/** Framework area (FM2/FM5/FM6): mma_admin AND cpd_committee both operate it. */
export default async function FrameworkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await getIdentity();
  if (!identity || !canOperateFramework(identity)) redirect("/dashboard");
  return <>{children}</>;
}
