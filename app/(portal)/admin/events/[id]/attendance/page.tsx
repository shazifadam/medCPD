import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAdminEventDetail, getEventRoster } from "@/lib/admin-events";
import { AttendanceForm } from "@/components/features/admin-events/attendance-form";

export const metadata: Metadata = { title: "Verify attendance" };
export const dynamic = "force-dynamic";

/** EM7 — verify attendance & award credits (Figma 287:12924). */
export default async function AttendancePage({
  params,
}: {
  params: { id: string };
}) {
  const [event, roster] = await Promise.all([
    getAdminEventDetail(params.id),
    getEventRoster(params.id),
  ]);
  if (!event) notFound();

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <Link
        href={`/admin/events/${event.id}`}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {event.title}
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-foreground">
          Verify attendance
        </h1>
        <p className="text-sm text-muted-foreground">
          Confirm who attended, then award CPD credits. Self check-ins are
          pre-ticked.
        </p>
      </div>
      <AttendanceForm eventId={event.id} rows={roster} />
    </div>
  );
}
