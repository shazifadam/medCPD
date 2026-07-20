import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { getAdminEventDetail, getEventRoster } from "@/lib/admin-events";
import { RosterTable } from "@/components/features/admin-events/roster-table";

export const metadata: Metadata = { title: "Roster" };
export const dynamic = "force-dynamic";

/** EM6 — roster (Figma 287:12921). */
export default async function RosterPage({
  params,
}: {
  params: { id: string };
}) {
  const [event, roster] = await Promise.all([
    getAdminEventDetail(params.id),
    getEventRoster(params.id),
  ]);
  if (!event) notFound();

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <Link
        href={`/admin/events/${event.id}`}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {event.title}
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-foreground">Roster</h1>
        <p className="text-sm text-muted-foreground">
          {event.registeredCount}
          {event.capacity != null ? ` of ${event.capacity}` : ""} registered
          {event.registrationClosesAt
            ? ` · registration closes ${format(parseISO(event.registrationClosesAt), "d MMM yyyy")}`
            : ""}
        </p>
      </div>
      <RosterTable rows={roster} />
    </div>
  );
}
