import type { Metadata } from "next";
import { listEventReviews } from "@/lib/reviews";
import { EventQueue } from "@/components/features/reviews/event-queue";

export const metadata: Metadata = { title: "Event reviews" };
export const dynamic = "force-dynamic";

/** ER1/ER2 — accreditation request queue (Figma 287:12794/12797). */
export default async function EventReviewsPage() {
  const rows = await listEventReviews();

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-foreground">
          Event reviews
        </h1>
        <p className="text-sm text-muted-foreground">
          Accreditation requests awaiting CPD Committee review
        </p>
      </div>
      <EventQueue rows={rows} />
    </div>
  );
}
