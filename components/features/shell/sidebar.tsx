"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth";
import { navGroupsForRoles } from "./nav";

/**
 * App-shell sidebar (Figma DB1 / OD1): role-grouped items, active item on
 * sidebar-accent, Sign out pinned at the bottom.
 */
export function Sidebar({
  roles,
  signOutAction,
}: {
  roles: Role[];
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const groups = navGroupsForRoles(roles);

  // Longest matching href wins so /admin/users doesn't also light Overview.
  const allHrefs = groups.flatMap((g) => g.items.map((i) => i.href));
  const activeHref = allHrefs
    .filter((h) => pathname === h || pathname.startsWith(h + "/"))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <aside className="flex w-[248px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {groups.map((group, gi) => (
          <div key={group.heading ?? "practitioner"} className="flex flex-col gap-1">
            {group.heading && (
              <p
                className={cn(
                  "px-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground",
                  gi > 0 && "pt-4"
                )}
              >
                {group.heading}
              </p>
            )}
            {group.items.map((item) => {
              const active = item.href === activeHref;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <form action={signOutAction} className="border-t border-sidebar-border p-3">
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden />
          Sign out
        </button>
      </form>
    </aside>
  );
}
