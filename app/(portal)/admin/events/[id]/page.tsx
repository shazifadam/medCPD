import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { getAdminEventDetail } from "@/lib/admin-events";
import { cn } from "@/lib/utils";
import { ManagePanel } from "@/components/features/admin-events/manage-panel";

export const metadata: Metadata = { title: "Manage event" };
export const dynamic = "force-dynamic";

const PILL: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "border-border bg-muted text-muted-foreground" },
  submitted: {
    label: "Submitted",
    className:
      "border-status-pending-border bg-status-pending-bg text-status-pending",
  },
  under_review: {
    label: "Under review",
    className:
      "border-status-under-review-border bg-status-under-review-bg text-status-under-review",
  },
  approved: {
    label: "Accredited",
    className:
      "border-status-approved-border bg-status-approved-bg text-status-approved",
  },
  rejected: {
    label: "Rejected",
    className:
      "border-status-rejected-border bg-status-rejected-bg text-status-rejected",
  },
  completed: {
    label: "Completed",
    className:
      "border-status-approved-border bg-status-approved-bg text-status-approved",
  },
  cancelled: {
    label: "Cancelled",
    className: "border-border bg-muted text-muted-foreground",
  },
};

/** EM5 — event manage page (Figma 287:12918). */
export default async function ManageEventPage({
  params,
}: {
  params: { id: string };
}) {
  const event = await getAdminEventDetail(params.id);
  if (!event) notFound();

  const pill = PILL[event.status] ?? PILL.draft;
  const starts = parseISO(event.startsAt);
  const ends = parseISO(event.endsAt);

  const tiles: { label: string; value: string; sub: string }[] = [
    {
      label: "Registered",
      value:
        event.capacity != null
          ? `${event.registeredCount} / ${event.capacity}`
          : String(event.registeredCount),
      sub:
        event.capacity != null
          ? `${Math.round((event.registeredCount / event.capacity) * 100)}% full`
          : "no capacity limit",
    },
    {
      label: "Checked in",
      value: event.checkedInCount > 0 ? String(event.checkedInCount) : "—",
      sub: event.checkedInCount > 0 ? "verified attendances" : "event upcoming",
    },
    {
      label: "Credits",
      value: event.credits != null ? event.credits.toFixed(1) : "—",
      sub: event.credits != null ? "per attendance" : "not accredited yet",
    },
    {
      label: "Sessions",
      value: String(event.sessionCount),
      sub: `over ${Math.max(1, Math.round((ends.getTime() - starts.getTime()) / 86_400_000))} day(s)`,
    },
  ];

  const details: [string, string][] = [
    ["Format", event.isVirtual ? "Virtual" : "In-person"],
    ["Venue", event.venueName ?? "—"],
    ["Category", event.categoryName ?? "—"],
    ["Activity type", event.activityTypeName],
    ["Capacity", event.capacity != null ? String(event.capacity) : "—"],
    [
      "Accredited on",
      event.accreditedOn
        ? format(parseISO(event.accreditedOn), "d MMM yyyy")
        : "—",
    ],
  ];

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <Link
        href="/admin/events"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Events
      </Link>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold text-foreground">
            {event.title}
          </h1>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-[9px] py-[3px] text-xs",
              pill.className
            )}
          >
            {pill.label}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {format(starts, "d MMM yyyy")}
          {event.credits != null ? ` · ${event.credits.toFixed(1)} credits` : ""}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-5"
          >
            <span className="text-xs tracking-[0.5px] text-muted-foreground">
              {t.label}
            </span>
            <span className="font-mono text-2xl font-medium text-foreground">
              {t.value}
            </span>
            <span className="text-xs text-muted-foreground">{t.sub}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_300px] items-start gap-6">
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">
            Event details
          </h2>
          {event.description && (
            <p className="text-sm leading-6 text-foreground">
              {event.description}
            </p>
          )}
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
            {details.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-sm text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Manage</h2>
          <ManagePanel eventId={event.id} status={event.status} />
        </div>
      </div>
    </div>
  );
}
