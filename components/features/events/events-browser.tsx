"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { EventCard as EventCardData } from "@/lib/events";
import { EventCard } from "./event-card";

type Tab = "all" | "registered" | "past";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All events" },
  { key: "registered", label: "Registered" },
  { key: "past", label: "Past" },
];

/**
 * EV1/EV2 — search + status tabs + two-column card grid. The designed
 * Category/Date/Credits selects are deferred (search + tabs cover the
 * v1 filtering need — noted deviation).
 */
export function EventsBrowser({ events }: { events: EventCardData[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(
    () => ({
      all: events.filter((e) => !e.isPast).length,
      registered: events.filter((e) => e.myRegistrationId && !e.isPast).length,
      past: events.filter((e) => e.isPast).length,
    }),
    [events]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (tab === "all" && e.isPast) return false;
      if (tab === "registered" && (!e.myRegistrationId || e.isPast)) return false;
      if (tab === "past" && !e.isPast) return false;
      if (q === "") return true;
      return [e.title, e.hostName, e.venueName ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [events, tab, query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search events by name, host, venue…"
          aria-label="Search events"
          className="pl-9"
        />
      </div>

      <div
        role="tablist"
        aria-label="Filter events"
        className="flex items-center gap-1 border-b border-border"
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

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card px-6 py-16 text-center">
          <p className="text-base font-semibold text-foreground">
            No events found
          </p>
          <p className="text-sm text-muted-foreground">
            {query
              ? "Try a different search."
              : "Accredited events will appear here."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {visible.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  );
}
