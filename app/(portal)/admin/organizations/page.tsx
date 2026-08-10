import { redirect } from "next/navigation";

/** Organizations moved to /organizations (committee operates it too). */
export default function AdminOrganizationsRedirect() {
  redirect("/organizations");
}
