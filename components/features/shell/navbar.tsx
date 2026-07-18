import Image from "next/image";
import Link from "next/link";
import { Bell, Menu, Settings } from "lucide-react";

/**
 * App-shell top bar (Figma DB1/OD1): hamburger + lockup left; bell,
 * settings, initials avatar right. Bell/settings are visual affordances
 * until notifications + settings land (P8).
 */
export function Navbar({ initials }: { initials: string }) {
  return (
    <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Toggle navigation"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <Link href="/dashboard" className="flex items-center">
          <Image
            src="/logo.svg"
            alt="Gradus CPD System"
            width={200}
            height={24}
            priority
          />
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Notifications"
          className="relative rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Bell className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Settings"
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Settings className="h-5 w-5" aria-hidden />
        </button>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-medium text-accent-foreground"
          aria-label="Account"
        >
          {initials}
        </div>
      </div>
    </header>
  );
}
