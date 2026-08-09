"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/** Serializable projection of NotificationRow for the client. */
export interface BellItem {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
}

/**
 * Navbar bell + dropdown (U1-NT / D-NT1): unread dot on the bell, panel
 * with the latest notifications, "Mark all read". Items link to their
 * href when present.
 */
export function NotificationsBell({
  items,
  unread,
  markAllReadAction,
}: {
  items: BellItem[];
  unread: number;
  markAllReadAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            unread > 0 ? `Notifications (${unread} unread)` : "Notifications"
          }
          className="relative rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Bell className="h-5 w-5" aria-hidden />
          {unread > 0 && (
            <span
              aria-hidden
              className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive"
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label="Notifications" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-medium">Notifications</p>
          {unread > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await markAllReadAction();
                  router.refresh();
                })
              }
              className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
            >
              Mark all read
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No notifications yet.
          </p>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {items.map((n) => {
              const inner = (
                <div className="flex gap-2.5">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                      n.read ? "bg-border" : "bg-primary"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {n.title}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDistanceToNowStrict(new Date(n.createdAt))}
                      </span>
                    </div>
                    {n.body && (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {n.body}
                      </p>
                    )}
                  </div>
                </div>
              );
              return (
                <li
                  key={n.id}
                  className={cn(
                    "border-b border-border last:border-b-0",
                    !n.read && "bg-accent/60"
                  )}
                >
                  {n.href ? (
                    <button
                      type="button"
                      className="w-full px-4 py-3 text-left hover:bg-accent"
                      onClick={() => {
                        setOpen(false);
                        router.push(n.href!);
                      }}
                    >
                      {inner}
                    </button>
                  ) : (
                    <div className="px-4 py-3">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
