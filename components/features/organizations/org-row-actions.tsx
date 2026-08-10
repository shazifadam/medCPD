"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  updateOrganizationAction,
  archiveOrganizationAction,
  restoreOrganizationAction,
} from "@/app/(portal)/organizations/actions";
import { ORG_TYPE_OPTIONS } from "@/lib/org-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Edit + archive/restore actions per organization row (admin + committee). */
export function OrgRowActions({
  org,
}: {
  org: { id: string; name: string; type: string; isActive: boolean };
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [name, setName] = useState(org.name);
  const [type, setType] = useState(org.type);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ status: string; error: string | null }>) {
    startTransition(async () => {
      const result = await action();
      if (result.status === "error") {
        setError(result.error);
        return;
      }
      setEditOpen(false);
      setArchiveOpen(false);
      setError(null);
      router.refresh();
    });
  }

  if (!org.isActive) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        aria-label={`Restore ${org.name}`}
        onClick={() => run(() => restoreOrganizationAction(org.id))}
      >
        Restore
      </Button>
    );
  }

  return (
    <div className="flex gap-2">
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" aria-label={`Edit ${org.name}`}>
            Edit
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit organization</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {error && (
              <p role="alert" className="text-sm text-status-rejected">
                {error}
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`edit-name-${org.id}`} className="text-sm font-medium">
                Name
              </label>
              <Input
                id={`edit-name-${org.id}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`edit-type-${org.id}`} className="text-sm font-medium">
                Type
              </label>
              <select
                id={`edit-type-${org.id}`}
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
              >
                {ORG_TYPE_OPTIONS.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
                {org.type === "polyclinic" && (
                  <option value="polyclinic">Polyclinic (legacy)</option>
                )}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={pending}
              aria-busy={pending}
              onClick={() =>
                run(() => updateOrganizationAction(org.id, { name, type }))
              }
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" aria-label={`Archive ${org.name}`}>
            Archive
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive {org.name}?</DialogTitle>
            <DialogDescription>
              Archiving removes this organization from every selection menu
              (event organizer, workplaces). Practitioners who already have it
              as a workplace, and events that reference it, keep it — nothing
              is deleted. You can restore it later from the archived list.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm text-status-rejected">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setArchiveOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              aria-busy={pending}
              onClick={() => run(() => archiveOrganizationAction(org.id))}
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Archiving…
                </>
              ) : (
                "Archive organization"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
