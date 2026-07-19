import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { sql } from "@/lib/db";
import { getEventReviewDetail } from "@/lib/reviews";
import { cn } from "@/lib/utils";
import { EventDecision } from "@/components/features/reviews/event-decision";

export const metadata: Metadata = { title: "Event review" };
export const dynamic = "force-dynamic";

const PILL = {
  pending: {
    label: "Pending review",
    className:
      "border-status-pending-border bg-status-pending-bg text-status-pending",
  },
  revisions: {
    label: "Revisions requested",
    className:
      "border-status-under-review-border bg-status-under-review-bg text-status-under-review",
  },
  rejected: {
    label: "Rejected",
    className:
      "border-status-rejected-border bg-status-rejected-bg text-status-rejected",
  },
  approved: {
    label: "Approved",
    className:
      "border-status-approved-border bg-status-approved-bg text-status-approved",
  },
} as const;

/** ER3 — event review detail (Figma 287:12800). */
export default async function EventReviewDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const event = await getEventReviewDetail(params.id);
  if (!event) notFound();

  const categories = await sql<{ id: string; name: string }[]>`
    select id, name from credit_categories order by display_order
  `;

  const pill = PILL[event.state];
  const starts = parseISO(event.startsAt);
  const ends = parseISO(event.endsAt);
  const days = Math.max(
    1,
    Math.round((ends.getTime() - starts.getTime()) / 86_400_000)
  );

  const overview: [string, string][] = [
    ["Organizer", event.organizerName],
    [
      "Dates",
      `${format(starts, "d MMM")}–${format(ends, "d MMM yyyy")} (${days} day${days > 1 ? "s" : ""})`,
    ],
    ...(event.venueName
      ? [["Venue", event.venueName] as [string, string]]
      : []),
    ["Format", event.isVirtual ? "Virtual" : "In-person"],
    ...(event.capacity != null
      ? [["Expected attendees", String(event.capacity)] as [string, string]]
      : []),
    ["Target audience", "All practitioners"],
  ];

  const accreditation: [string, string][] = [
    [
      "Requested credits",
      event.suggestedCredits != null
        ? `${event.suggestedCredits.toFixed(0)} credits`
        : "—",
    ],
    ["Category", event.categoryName ?? "—"],
    ["Credit basis", "Per full attendance"],
    ["Cycle eligibility", event.cycleName ?? "Current cycle"],
  ];

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <Link
        href="/committee/events"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Event reviews
      </Link>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold text-foreground">
            {event.title}
          </h1>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-[9px] py-[3px] text-xs",
              pill.className
            )}
          >
            {pill.label}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Submitted by {event.organizerName}
          {event.submittedAt
            ? ` · ${format(parseISO(event.submittedAt), "d MMM yyyy")}`
            : ""}
        </p>
      </div>

      <div className="grid grid-cols-[1fr_340px] items-start gap-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">
              Event overview
            </h2>
            {event.description && (
              <p className="text-sm leading-6 text-foreground">
                {event.description}
              </p>
            )}
            <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
              {overview.map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-sm text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
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
                    <span className="w-24 shrink-0 font-mono text-[13px] text-muted-foreground">
                      {format(parseISO(s.startsAt), "d MMM · HH:mm")}
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

          <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">
              Requested accreditation
            </h2>
            <dl className="flex flex-col">
              {accreditation.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between border-b border-border/60 py-2.5 last:border-0"
                >
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="text-sm font-medium text-foreground">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">
              Accreditation decision
            </h2>
            {event.state === "pending" ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Review the request and choose an outcome. Approving lets you
                  set per-category credit allocations.
                </p>
                <EventDecision
                  eventId={event.id}
                  eventTitle={event.title}
                  organizerName={event.organizerName}
                  suggestedCredits={event.suggestedCredits}
                  categoryId={event.categoryId}
                  categoryName={event.categoryName}
                  cycleName={event.cycleName}
                  categories={categories}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                This request is {pill.label.toLowerCase()}.
                {event.lastReviewComments
                  ? ` — ${event.lastReviewComments}`
                  : ""}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">
              Submission
            </h2>
            <dl className="flex flex-col gap-2.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Submitted by</dt>
                <dd className="font-medium text-foreground">
                  {event.organizerName}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Submitted on</dt>
                <dd className="font-medium text-foreground">
                  {event.submittedAt
                    ? format(parseISO(event.submittedAt), "d MMM yyyy")
                    : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Assigned to</dt>
                <dd className="font-medium text-foreground">You</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
