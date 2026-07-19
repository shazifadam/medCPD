import type { Metadata } from "next";
import { listEntryReviews } from "@/lib/reviews";
import { EntryQueue } from "@/components/features/reviews/entry-queue";

export const metadata: Metadata = { title: "Entry reviews" };
export const dynamic = "force-dynamic";

/** IR1 — entry review queue (Figma 287:12858). Committee layout guards. */
export default async function EntryReviewsPage() {
  const rows = await listEntryReviews();

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-foreground">
          Entry reviews
        </h1>
        <p className="text-sm text-muted-foreground">
          Self-reported CPD entries awaiting committee review
        </p>
      </div>
      <EntryQueue rows={rows} />
    </div>
  );
}
