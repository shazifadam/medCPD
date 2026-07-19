import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowLeft, FileText } from "lucide-react";
import { sql } from "@/lib/db";
import { getReviewEntryDetail } from "@/lib/reviews";
import { getDownloadUrl } from "@/lib/storage";
import { StatusBadge } from "@/components/features/entries/status-badge";
import { EntryDecision } from "@/components/features/reviews/entry-decision";

export const metadata: Metadata = { title: "Entry review" };
export const dynamic = "force-dynamic";

/** IR2 — entry review detail (Figma 287:12861). */
export default async function EntryReviewDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const entry = await getReviewEntryDetail(params.id);
  if (!entry) notFound();

  const categories = await sql<{ id: string; name: string }[]>`
    select id, name from credit_categories order by display_order
  `;
  const attachments = await Promise.all(
    entry.attachments.map(async (a) => ({
      ...a,
      url: await getDownloadUrl(a.storageBucket, a.storagePath),
    }))
  );

  const initials = entry.practitioner.fullName
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const details: [string, string][] = [
    ["Activity type", entry.activityTypeName],
    ["Category claimed", entry.categoryName],
    ["Credits claimed", `${entry.credits.toFixed(1)} credits`],
    ...(entry.occurredOn
      ? [
          [
            "Date of activity",
            format(parseISO(entry.occurredOn), "d MMM yyyy"),
          ] as [string, string],
        ]
      : []),
    ["Source", entry.source === "self_reported" ? "Self-reported" : "Event check-in"],
    ...(entry.cycleName ? [["Cycle", entry.cycleName] as [string, string]] : []),
  ];

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <Link
        href="/committee/entries"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Entry reviews
      </Link>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold text-foreground">
            {entry.title}
          </h1>
          <StatusBadge status={entry.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          Submitted by {entry.practitioner.fullName}
          {entry.practitioner.mmdc ? ` · ${entry.practitioner.mmdc}` : ""} ·{" "}
          {format(parseISO(entry.submittedAt), "d MMM yyyy")}
        </p>
      </div>

      <div className="grid grid-cols-[1fr_340px] items-start gap-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">
              Entry details
            </h2>
            {entry.description && (
              <p className="text-sm leading-6 text-foreground">
                {entry.description}
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
            {entry.status === "rejected" && entry.reviewComments && (
              <p className="rounded-md bg-status-rejected-bg px-4 py-3 text-sm text-status-rejected">
                Rejected: {entry.reviewComments}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">Evidence</h2>
            {attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No evidence attached.
              </p>
            ) : (
              attachments.map((a) => (
                <a
                  key={a.id}
                  href={a.url}
                  download={a.filename}
                  className="flex items-center gap-3 rounded-md bg-muted px-4 py-2.5 hover:bg-accent"
                >
                  <FileText
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="flex-1 truncate font-mono text-[13px] text-foreground">
                    {a.filename}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatBytes(a.sizeBytes)}
                  </span>
                </a>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">
              Review decision
            </h2>
            {entry.status === "pending" ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Approve as claimed, adjust the awarded credits, or reject
                  with a reason.
                </p>
                <EntryDecision
                  entryId={entry.id}
                  entryTitle={entry.title}
                  practitionerName={entry.practitioner.fullName}
                  claimedCredits={entry.credits}
                  claimedCategoryName={entry.categoryName}
                  categoryId={entry.categoryId}
                  categories={categories}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                This entry has already been {entry.status}.
                {entry.reviewComments ? ` — ${entry.reviewComments}` : ""}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">
              Practitioner
            </h2>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-primary">
                {initials}
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">
                  {entry.practitioner.fullName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {entry.practitioner.specialty ?? "Practitioner"}
                </span>
              </div>
            </div>
            <dl className="flex flex-col gap-2.5 border-t border-border pt-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">MMDC number</dt>
                <dd className="font-mono text-[13px] text-foreground">
                  {entry.practitioner.mmdc ?? "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Current cycle</dt>
                <dd className="font-medium text-foreground">
                  {entry.practitioner.cycleApproved.toFixed(0)}
                  {entry.practitioner.cycleTarget != null
                    ? ` / ${entry.practitioner.cycleTarget.toFixed(0)} credits`
                    : " credits"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Entries this cycle</dt>
                <dd className="font-medium text-foreground">
                  {entry.practitioner.entriesThisCycle}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
