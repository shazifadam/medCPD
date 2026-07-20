import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getActivityTypeOptions } from "@/lib/activities";
import { CreateEventForm } from "@/components/features/admin-events/create-event-form";

export const metadata: Metadata = { title: "Create event" };
export const dynamic = "force-dynamic";

/** EM1–EM4 — create event (Figma 287:12906…12915, wizard compressed). */
export default async function CreateEventPage() {
  const activityTypes = await getActivityTypeOptions();

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-6">
      <Link
        href="/admin/events"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Manage events
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-foreground">Create event</h1>
        <p className="text-sm text-muted-foreground">
          Set up an accredited event on behalf of an organizer
        </p>
      </div>
      <CreateEventForm activityTypes={activityTypes} />
    </div>
  );
}
