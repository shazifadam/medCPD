import { redirect } from "next/navigation";

/** Framework moved to /framework (Update 1: committee operates it too). */
export default function AdminFrameworkRedirect() {
  redirect("/framework");
}
