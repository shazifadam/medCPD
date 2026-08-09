"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, X } from "lucide-react";
import type { ProfileData } from "@/lib/profile";
import {
  updateProfileAction,
  addWorkplaceAction,
  removeWorkplaceAction,
  type ProfileActionState,
} from "@/app/(portal)/profile/actions";
import { OrgCombobox, type OrgOption } from "@/components/patterns/org-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** U1-PF1 — profile edit: contact, primary workplace, chips, photo. */
export function ProfileForm({
  profile,
  avatarUrl,
  organizations,
}: {
  profile: ProfileData;
  avatarUrl: string | null;
  organizations: OrgOption[];
}) {
  const router = useRouter();
  const [state, setState] = useState<ProfileActionState>({
    status: "idle",
    error: null,
  });
  const [pending, startTransition] = useTransition();
  const [addingWorkplace, setAddingWorkplace] = useState(false);
  const addValue = useRef<string>("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateProfileAction({ status: "idle", error: null }, fd);
      setState(result);
      if (result.status === "success") router.refresh();
    });
  }

  const registration = profile.mmdcRegistration
    ? `${profile.mmdcRegistrationType ?? ""}${profile.mmdcRegistrationType ? "-" : ""}${profile.mmdcRegistration}`
    : "—";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {state.error && (
        <div
          role="alert"
          className="flex gap-2 rounded-md border border-status-rejected-border/40 bg-status-rejected-bg px-4 py-3 text-sm text-status-rejected"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {state.error}
        </div>
      )}
      {state.status === "success" && (
        <div className="rounded-md border border-status-approved-border bg-status-approved-bg px-4 py-3 text-sm text-status-approved">
          Profile updated.
        </div>
      )}

      {/* Photo */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">Profile photo</h2>
        <div className="mt-4 flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="h-14 w-14 rounded-full border border-border object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-lg font-medium text-accent-foreground">
              {profile.fullName
                .split(/\s+/)
                .slice(0, 2)
                .map((p) => p[0])
                .join("")}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pf-photo" className="text-sm font-medium">
              Upload photo
            </label>
            <Input
              id="pf-photo"
              name="photo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              JPG/PNG/WebP, square crop — shown on your navbar avatar
            </p>
          </div>
        </div>
      </section>

      {/* Contact + workplace */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">
          Contact &amp; workplace
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pf-phone" className="text-sm font-medium">
              Contact number
            </label>
            <Input
              id="pf-phone"
              name="phone"
              defaultValue={profile.phone ?? ""}
              placeholder="+960 7771234"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pf-workplace" className="text-sm font-medium">
              Primary workplace
            </label>
            <OrgCombobox
              triggerId="pf-workplace"
              fieldName="primaryWorkplace"
              options={organizations}
              defaultOption={profile.primaryWorkplace}
              placeholder="Search or select your workplace"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Other workplaces</span>
          {profile.otherWorkplaces.map((w) => (
            <span
              key={w.id}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground"
            >
              {w.name}
              <button
                type="button"
                aria-label={`Remove ${w.name}`}
                className="text-muted-foreground hover:text-foreground"
                onClick={() =>
                  startTransition(async () => {
                    await removeWorkplaceAction(w.id);
                    router.refresh();
                  })
                }
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
          {addingWorkplace ? (
            <span className="flex items-center gap-2">
              <span className="w-64">
                <OrgCombobox
                  fieldName="newWorkplaceDisplay"
                  options={organizations.filter(
                    (o) =>
                      o.id !== profile.primaryWorkplace?.id &&
                      !profile.otherWorkplaces.some((w) => w.id === o.id)
                  )}
                  placeholder="Add a clinic or hospital…"
                  onValueChange={(v) => {
                    addValue.current = v;
                  }}
                />
              </span>
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    if (!addValue.current) return;
                    const result = await addWorkplaceAction(addValue.current);
                    setState(result);
                    if (result.status === "success") {
                      setAddingWorkplace(false);
                      addValue.current = "";
                      router.refresh();
                    }
                  })
                }
              >
                Add
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setAddingWorkplace(false)}
              >
                Cancel
              </Button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setAddingWorkplace(true)}
              className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-primary hover:bg-accent/80"
            >
              + Add workplace
            </button>
          )}
        </div>
      </section>

      {/* Registration (locked) */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          Registration &amp; credentials
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These fields are managed by the MMA registry. Contact the registrar to
          request changes.
        </p>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Full name
            </dt>
            <dd className="mt-1 text-foreground">{profile.fullName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Registration
            </dt>
            <dd className="mt-1 font-mono text-foreground">{registration}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Specialty
            </dt>
            <dd className="mt-1 text-foreground">{profile.specialty ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </div>
    </form>
  );
}
