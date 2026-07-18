import { cn } from "@/lib/utils";

export type EntryStatus = "pending" | "approved" | "rejected";

const STYLES: Record<EntryStatus, { pill: string; dot: string; label: string }> = {
  pending: {
    pill: "border-status-pending-border bg-status-pending-bg text-status-pending",
    dot: "bg-status-pending-border",
    label: "Pending",
  },
  approved: {
    pill: "border-status-approved-border bg-status-approved-bg text-status-approved",
    dot: "bg-status-approved-border",
    label: "Approved",
  },
  rejected: {
    pill: "border-status-rejected-border bg-status-rejected-bg text-status-rejected",
    dot: "bg-status-rejected-border",
    label: "Rejected",
  },
};

/** The design-system Status pill (dot + label, rounded-full). */
export function StatusBadge({
  status,
  className,
}: {
  status: EntryStatus;
  className?: string;
}) {
  const s = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-[9px] py-[3px] text-xs",
        s.pill,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} aria-hidden />
      {s.label}
    </span>
  );
}
