import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getIdentity } from "@/lib/auth/identity";
import { getProfile, avatarPublicUrl } from "@/lib/profile";
import { listOrganizations } from "@/lib/orgs";
import { ProfileForm } from "@/components/features/profile/profile-form";

export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

/** PF1 / U1-PF1 — practitioner profile. */
export default async function ProfilePage() {
  const identity = await getIdentity();
  if (!identity) redirect("/login");
  const [profile, organizations] = await Promise.all([
    getProfile(identity.user.id),
    listOrganizations(),
  ]);
  if (!profile) redirect("/dashboard");

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-foreground">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Update your contact details, workplaces and photo. Registration
          credentials are managed by MMA.
        </p>
      </div>
      <ProfileForm
        profile={profile}
        avatarUrl={avatarPublicUrl(profile.avatarPath)}
        organizations={organizations}
      />
    </div>
  );
}
