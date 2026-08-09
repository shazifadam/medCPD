import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  LayoutDashboard,
  User,
  Calendar,
  Award,
  CircleCheck,
  Globe,
  SlidersHorizontal,
  Users,
  ShieldCheck,
  ClipboardList,
} from "lucide-react";
import type { Role } from "@/lib/auth";

/**
 * Role-grouped sidebar nav — single source of truth (mirrors the Figma
 * master sidebars: multi-role users see their practitioner pages plus a
 * heading-separated group per elevated role; plain practitioners get the
 * simple 4-item list with no heading).
 */

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup {
  /** Group heading; null = the ungrouped practitioner list. */
  heading: string | null;
  items: NavItem[];
}

const PRACTITIONER_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Events", href: "/events", icon: Calendar },
  { label: "My CPD", href: "/my-cpd", icon: Award },
  { label: "Profile", href: "/profile", icon: User },
];

const ADMIN_ITEMS: NavItem[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Approvals", href: "/admin/approvals", icon: CircleCheck },
  {
    label: "Practitioner scores",
    href: "/admin/practitioner-scores",
    icon: BarChart3,
  },
  {
    label: "Committee approvals",
    href: "/committee/entries",
    icon: ClipboardList,
  },
  { label: "Organizations", href: "/admin/organizations", icon: Globe },
  { label: "Manage events", href: "/admin/events", icon: Calendar },
  { label: "Framework", href: "/framework", icon: SlidersHorizontal },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Certificates", href: "/admin/certificates", icon: Award },
  { label: "Audit log", href: "/admin/audit-log", icon: ShieldCheck },
];

// Matches the designed committee sidebar exactly — no Overview item.
const COMMITTEE_ITEMS: NavItem[] = [
  { label: "Event reviews", href: "/committee/events", icon: ClipboardList },
  { label: "Entry reviews", href: "/committee/entries", icon: Award },
  {
    label: "Audit & integrity",
    href: "/committee/audit",
    icon: ShieldCheck,
  },
  { label: "Framework", href: "/framework", icon: SlidersHorizontal },
];

export function navGroupsForRoles(roles: Role[]): NavGroup[] {
  const elevated = roles.includes("mma_admin") || roles.includes("cpd_committee");

  if (!elevated) {
    return [{ heading: null, items: PRACTITIONER_ITEMS }];
  }

  const groups: NavGroup[] = [
    { heading: "Practitioner", items: PRACTITIONER_ITEMS },
  ];
  if (roles.includes("cpd_committee")) {
    groups.push({ heading: "CPD Committee", items: COMMITTEE_ITEMS });
  }
  if (roles.includes("mma_admin")) {
    // The committee group is hidden from admins who aren't committee members,
    // which left the entry-review queue reachable only from the OD1 overview.
    // Drop the shortcut for anyone who already has the committee group.
    const items = roles.includes("cpd_committee")
      ? ADMIN_ITEMS.filter((i) => i.href !== "/committee/entries")
      : ADMIN_ITEMS;
    groups.push({ heading: "Administration", items });
  }
  return groups;
}
