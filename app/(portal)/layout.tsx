import { redirect } from "next/navigation";
import { getIdentity, initialsFor } from "@/lib/auth/identity";
import { getNotifications } from "@/lib/notifications";
import { markAllNotificationsReadAction } from "@/app/(portal)/notifications-actions";
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

  const { items, unread } = await getNotifications(identity.user.id, 10);
  const bellItems = items.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    href: n.href,
    read: n.readAt !== null,
    createdAt: new Date(n.createdAt).toISOString(),
  }));

  return (
    <div className="flex h-screen flex-col">
      <Navbar
        initials={initialsFor(identity)}
        bellItems={bellItems}
        bellUnread={unread}
        markAllReadAction={markAllNotificationsReadAction}
      />
      <div className="flex min-h-0 flex-1">
        <Sidebar roles={identity.roles} signOutAction={signOutAction} />
        <main className="min-w-0 flex-1 overflow-y-auto bg-background px-8 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
