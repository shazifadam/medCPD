import { redirect } from "next/navigation";
import { getIdentity, initialsFor } from "@/lib/auth/identity";
import { signOutAction } from "@/app/(auth)/actions";
import { Navbar } from "@/components/features/shell/navbar";
import { Sidebar } from "@/components/features/shell/sidebar";

/**
 * Portal shell + gate (Figma DB1/OD1). Everything under (portal) requires a
 * signed-in, approved user; middleware already blocks the signed-out.
 * Layout: fixed navbar over sidebar + scrolling main pane.
 */
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await getIdentity();

  if (!identity) redirect("/login");
  if (identity.registrationState !== "verified") redirect("/pending");

  return (
    <div className="flex h-screen flex-col">
      <Navbar initials={initialsFor(identity)} />
      <div className="flex min-h-0 flex-1">
        <Sidebar roles={identity.roles} signOutAction={signOutAction} />
        <main className="min-w-0 flex-1 overflow-y-auto bg-background px-8 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
