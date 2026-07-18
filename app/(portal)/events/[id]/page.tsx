import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  Award,
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  Users,
} from "lucide-react";
import { getIdentity } from "@/lib/auth/identity";
import { getEventDetail } from "@/lib/events";
import { RegisterDialog } from "@/components/features/events/register-dialog";
import { CancelRegistrationButton } from "@/components/features/events/cancel-registration";

export const metadata: Metadata = { title: "Event" };
export const dynamic = "force-dynamic";

/** EV3/EV5 — event detail with registration panel (Figma 287:12937/12943). */
export default async function EventDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const identity = await getIdentity();
  if (!identity) redirect("/login");

  const event = await getEventDetail(identity.user.id, params.id);
  if (!event) notFound();

  const registered = event.myRegistrationId != null;
  const starts = parseISO(event.startsAt);
  const ends = parseISO(event.endsAt);

  const infoRows: { icon: typeof CalendarDays; label: string; value: string }[] = [
    { icon: CalendarDays, label: "Date", value: format(starts, "d MMM yyyy") },
    {
      icon: Clock,
      label: "Time",
      value: `${format(starts, "HH:mm")} – ${format(ends, "HH:mm")} MVT`,
    },
    ...(event.venueName
      ? [{ icon: MapPin, label: "Venue", value: event.venueName }]
      : []),
    ...(event.capacity != null
      ? [
          {
            icon: Users,
            label: "Capacity",
            value: `${event.registeredCount} / ${event.capacity} registered`,
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <Link
        href="/events"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Events
      </Link>

      {registered && (
        <div
          role="status"
          className="flex gap-3 rounded-md border border-status-approved-border bg-status-approved-bg p-4 text-sm text-status-approved"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="font-medium">You&apos;re registered</p>
            <p>We&apos;ll remind you before it starts.</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-foreground">{event.title}</h1>
        <p className="text-sm text-muted-foreground">
          {[event.hostName, format(starts, "d MMM yyyy"), event.venueAddress]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <div className="grid grid-cols-[1fr_340px] items-start gap-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">
              About this activity
            </h2>
            <p className="text-sm leading-6 text-foreground">
              {event.description ?? "Details to follow."}
            </p>
          </div>

          {event.sessions.length > 0 && (
            <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground">Agenda</h2>
              <div className="flex flex-col">
                {event.sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex gap-6 border-b border-border/60 py-3 last:border-0"
                  >
                    <span className="w-14 shrink-0 font-mono text-[13px] text-muted-foreground">
                      {format(parseISO(s.startsAt), "HH:mm")}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm text-foreground">{s.title}</span>
                      {s.room && (
                        <span className="text-xs text-muted-foreground">
                          {s.room}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {event.credits != null && (
            <div className="flex gap-3 rounded-lg border border-primary/40 bg-accent p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Award className="h-[18px] w-[18px]" aria-hidden />
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold text-foreground">
                  {event.credits.toFixed(1)} credits
                  {event.categoryName ? ` · ${event.categoryName}` : ""}
                </p>
                <p className="text-xs text-primary">
                  Auto-logged on check-in; verified by MMA within 7 days.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Registration panel */}
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Registration
            </h2>
            {registered && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-status-approved-border bg-status-approved-bg px-[9px] py-[3px] text-xs text-status-approved">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-status-approved-border"
                  aria-hidden
                />
                Registered
              </span>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {infoRows.map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <row.icon className="h-4 w-4" aria-hidden />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">
                    {row.label}
                  </span>
                  <span className="text-sm text-foreground">{row.value}</span>
                </div>
              </div>
            ))}
          </div>

          {registered ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-full rounded-md border border-status-approved-border bg-status-approved-bg py-2 text-center text-sm font-medium text-status-approved">
                Registered ✓
              </div>
              <CancelRegistrationButton eventId={event.id} />
            </div>
          ) : event.isPast ? (
            <p className="text-sm text-muted-foreground">
              This event has ended.
            </p>
          ) : (
            <RegisterDialog event={event} />
          )}

          <div className="flex gap-3 rounded-md bg-muted p-3.5">
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <div className="flex flex-col gap-0.5 text-xs">
              <p className="font-medium text-foreground">
                {registered ? "Check in on the day" : "Reserve your place"}
              </p>
              <p className="text-muted-foreground">
                {registered
                  ? "Check in at the venue on the day to earn your credits."
                  : `Register to reserve your place${
                      event.credits != null
                        ? ` and earn ${event.credits.toFixed(1)} credits${
                            event.categoryLabel ? ` (${event.categoryLabel})` : ""
                          } on check-in`
                        : ""
                    }.`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
