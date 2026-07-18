import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { getIdentity } from "@/lib/auth/identity";
import { listEvents } from "@/lib/events";
import { EventsBrowser } from "@/components/features/events/events-browser";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "CPD Events" };
export const dynamic = "force-dynamic";

/** EV1/EV2 — browse accredited events (Figma 287:12931/12934). */
export default async function EventsPage() {
  const identity = await getIdentity();
  if (!identity) redirect("/login");

  const events = await listEvents(identity.user.id);

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold text-foreground">CPD Events</h1>
          <p className="text-sm text-muted-foreground">
            Accredited activities you can attend to earn credits
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/events/my">
            <CalendarCheck className="mr-1.5 h-4 w-4" aria-hidden />
            My events
          </Link>
        </Button>
      </div>
      <EventsBrowser events={events} />
    </div>
  );
}
