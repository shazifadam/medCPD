import { TablePageSkeleton } from "@/components/features/shell/page-skeleton";

// Covers every /admin child segment (RA/OG/UM/CA/AL loading frames share
// this table-card pattern on the Enhancements page).
export default function AdminLoading() {
  return <TablePageSkeleton />;
}
