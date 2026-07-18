"use client";

import Link from "next/link";
import { format, isToday, parseISO } from "date-fns";
import { Building2, MapPin, Award, Users } from "lucide-react";
import type { EventCard as EventCardData } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { RegisterDialog } from "./register-dialog";

function dateLine(e: EventCardData): string {
  const starts = parseISO(e.startsAt);
  const ends = parseISO(e.endsAt);
  const day = isToday(starts) ? "Today" : format(starts, "EEEE, d MMM yyyy");
  return `${day} · ${format(starts, "HH:mm")} – ${format(ends, "HH:mm")}`;
}

/** EV1 — one browse-events card (inner summary card + meta + actions). */
export function EventCard({ event }: { event: EventCardData }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <Link
        href={`/events/${event.id}`}
        className="flex flex-col gap-1.5 rounded-md border border-border bg-background p-5 shadow-sm hover:border-primary/40"
      >
        <p className="text-sm font-medium text-primary">{dateLine(event)}</p>
        <p className="text-xl font-semibold text-foreground">{event.title}</p>
        {event.venueName && (
          <p className="text-sm text-muted-foreground">{event.venueName}</p>
        )}
        <p className="mt-2 flex items-center gap-2 text-sm text-foreground">
          <Users className="h-4 w-4 text-muted-foreground" aria-hidden />+
          {event.registeredCount} attending
        </p>
      </Link>

      <div className="flex flex-col gap-2 px-1 text-sm">
        <p className="flex items-center gap-2.5">
          <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="text-muted-foreground">Event by</span>
          <span className="font-medium text-foreground">{event.hostName}</span>
        </p>
        {event.venueName && (
          <p className="flex items-center gap-2.5 text-foreground">
            <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden />
            {event.venueName}
          </p>
        )}
        <p className="flex items-center gap-2.5 text-foreground">
          <Award className="h-4 w-4 text-muted-foreground" aria-hidden />
          {event.preRegRequired
            ? "Pre-registered practitioners"
            : "Open to all practitioners"}
          {event.credits != null && ` · ${event.credits.toFixed(1)} credits`}
          {event.categoryLabel && ` · ${event.categoryLabel}`}
        </p>
      </div>

      {event.description && (
        <p className="px-1 text-sm leading-6 text-foreground">
          {event.description}
        </p>
      )}

      <div className="flex items-center gap-2 border-t border-border px-1 pt-3">
        {event.myRegistrationId && !event.isPast && (
          <Button asChild variant="outline">
            <Link href={`/events/${event.id}`}>Registered ✓</Link>
          </Button>
        )}
        {!event.myRegistrationId && !event.isPast && (
          <RegisterDialog event={event} />
        )}
        <Button asChild variant="outline">
          <Link href={`/events/${event.id}`}>View details</Link>
        </Button>
      </div>
    </div>
  );
}
