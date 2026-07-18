"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ClipboardList, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { ActivityTypeOption } from "@/lib/activities";
import type { EntryRow } from "@/lib/entries";
import { LogActivityDialog } from "@/components/features/log-activity/log-activity-dialog";
import { StatusBadge, type EntryStatus } from "./status-badge";

type Tab = "all" | EntryStatus;

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All entries" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

/**
 * EN1–EN3 — the CPD entries ledger card: status tabs with count chips,
 * search, the entries table (rows link to the detail page), the EN2 active
 * filter chip, and the EN3 empty state.
 */
export function EntriesCard({
  entries,
  options,
}: {
  entries: EntryRow[];
  options: ActivityTypeOption[];
}) {
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const c: Record<Tab, number> = {
      all: entries.length,
      pending: 0,
      approved: 0,
      rejected: 0,
    };
    for (const e of entries) c[e.status] += 1;
    return c;
  }, [entries]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter(
      (e) =>
        (tab === "all" || e.status === tab) &&
        (q === "" || e.title.toLowerCase().includes(q))
    );
  }, [entries, tab, query]);

  const activeTab = TABS.find((t) => t.key === tab)!;

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card">
      <div className="flex items-start justify-between p-5 pb-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold text-foreground">
            CPD entries
          </h2>
          <p className="text-xs text-muted-foreground">
            {entries.length === 0
              ? "No logged activities yet"
              : counts.pending > 0
                ? `${counts.pending} pending ${counts.pending === 1 ? "entry" : "entries"}`
                : "All logged activities in this cycle"}
          </p>
        </div>
        <div className="relative w-60">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search entries…"
            aria-label="Search entries"
            className="pl-9"
          />
        </div>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Filter entries by status"
        className="flex items-center gap-1 border-b border-border px-5"
      >
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={cn(
                "-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm",
                active
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              <span
                className={cn(
                  "rounded-full px-2 py-px text-xs",
                  active
                    ? "bg-accent text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {counts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* EN2 — active filter chip */}
      {tab !== "all" && (
        <div className="px-5 pt-3">
          <button
            onClick={() => setTab("all")}
            className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs text-foreground hover:bg-accent"
          >
            Status: {activeTab.label}
            <X className="h-3 w-3" aria-hidden />
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        // EN3 — empty state
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <ClipboardList className="h-6 w-6" aria-hidden />
          </div>
          <p className="text-base font-semibold text-foreground">
            {entries.length === 0 ? "No CPD entries yet" : "No matching entries"}
          </p>
          <p className="text-sm text-muted-foreground">
            {entries.length === 0
              ? "Log your first activity to start earning credits"
              : "Try a different search or filter"}
          </p>
          {entries.length === 0 && <LogActivityDialog options={options} />}
        </div>
      ) : (
        <div className="mt-3 flex flex-col">
          <div className="flex gap-4 border-y border-border bg-muted px-6 py-2.5 text-[11px] tracking-[0.5px] text-muted-foreground">
            <span className="flex-1">ACTIVITY</span>
            <span className="w-40">CATEGORY</span>
            <span className="w-24">DATE</span>
            <span className="w-16 text-right">CREDITS</span>
            <span className="w-32">STATUS</span>
          </div>
          {visible.map((e) => (
            <Link
              key={e.id}
              href={`/my-cpd/${e.id}`}
              className="flex items-center gap-4 border-b border-border px-6 py-3.5 hover:bg-muted/50"
            >
              <span className="flex-1 text-sm text-foreground">{e.title}</span>
              <span className="w-40 text-sm text-muted-foreground">
                {e.categoryLabel}
              </span>
              <span className="w-24 font-mono text-[13px] text-muted-foreground">
                {format(parseISO(e.occurredOn), "dd MMM yy")}
              </span>
              <span className="w-16 text-right font-mono text-[13px] font-medium text-foreground">
                {e.credits.toFixed(1)}
              </span>
              <span className="w-32">
                <StatusBadge status={e.status} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
