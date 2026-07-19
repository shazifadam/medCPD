import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Calendar,
  Award,
  User,
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
  { label: "Organizations", href: "/admin/organizations", icon: Globe },
  { label: "Manage events", href: "/admin/events", icon: Calendar },
  { label: "Framework", href: "/admin/framework", icon: SlidersHorizontal },
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
    groups.push({ heading: "Administration", items: ADMIN_ITEMS });
  }
  return groups;
}
