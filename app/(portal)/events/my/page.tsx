import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getIdentity } from "@/lib/auth/identity";
import { getMyEvents } from "@/lib/events";
import { MyEventsList } from "@/components/features/events/my-events-list";

export const metadata: Metadata = { title: "My Events" };
export const dynamic = "force-dynamic";

/** AT1 — my registered events (Figma 287:12969). */
export default async function MyEventsPage() {
  const identity = await getIdentity();
  if (!identity) redirect("/login");

  const rows = await getMyEvents(identity.user.id);

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <Link
        href="/events"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Events
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-foreground">My Events</h1>
        <p className="text-sm text-muted-foreground">
          Events you&apos;ve registered for — check in on the day to earn
          credits
        </p>
      </div>
      <MyEventsList rows={rows} />
    </div>
  );
}
