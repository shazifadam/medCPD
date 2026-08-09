"use server";

import { getIdentity } from "@/lib/auth/identity";
import { markAllRead } from "@/lib/notifications";

export async function markAllNotificationsReadAction(): Promise<void> {
  const identity = await getIdentity();
  if (!identity) return;
  await markAllRead(identity.user.id);
}
