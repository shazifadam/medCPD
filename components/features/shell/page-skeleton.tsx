import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Route-transition skeletons (loading.tsx boundaries). Visual language
 * follows the Enhancements loading frames (e.g. RA · Loading 536:13049):
 * page chrome stays, content renders as a bordered card with soft bars.
 */

export function PageHeaderSkeleton({
  title,
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      {title ? (
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      ) : (
        <Skeleton className="h-8 w-64" />
      )}
      {subtitle ? (
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      ) : (
        <Skeleton className="h-4 w-80" />
      )}
    </div>
  );
}

const ROW_WIDTHS = ["w-36", "w-24", "w-20", "w-16", "w-16"];

export function TableCardSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-16 border-b border-border bg-muted/60 px-4 py-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-14" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center gap-10 px-4 py-4",
            i < rows - 1 && "border-b border-border"
          )}
        >
          {ROW_WIDTHS.map((w, j) => (
            <Skeleton key={j} className={cn("h-3.5", w)} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatTilesSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5"
        >
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

/** Generic list/table page: header + table card. */
export function TablePageSkeleton(props: { title?: string; subtitle?: string }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton {...props} />
      <TableCardSkeleton />
    </div>
  );
}

/** Dashboard-shaped page: header + stat tiles + progress + two panels. */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <StatTilesSkeleton count={3} />
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-full" />
        <div className="flex gap-6">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <TableCardSkeleton rows={4} />
        <TableCardSkeleton rows={4} />
      </div>
    </div>
  );
}
