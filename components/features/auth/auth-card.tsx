import { cn } from "@/lib/utils";

/**
 * AU-flow card + heading primitives. The (auth) layout provides the gradient
 * shell (logo above, legal footer below); each page composes these. Headings
 * sit OUTSIDE the card per AU3/AU7/AU8.
 */

export function AuthCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "w-full max-w-[350px] rounded-lg border border-border bg-card p-6 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

export function AuthHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      {subtitle && (
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}
