import {
  Bell,
  ClipboardList,
  FileCheck2,
  Gauge,
  LucideIcon,
  Settings,
  ListOrdered,
  ShieldCheck,
  UserRound,
} from "lucide-react";

export type AssignmentStatus = "missing" | "submitted";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  admin?: boolean;
};

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: Gauge },
  { label: "과제", href: "/assignments", icon: ClipboardList },
  { label: "공지사항", href: "/notices", icon: Bell },
  { label: "내 제출물", href: "/submissions", icon: FileCheck2 },
  { label: "순위", href: "/rankings", icon: ListOrdered },
  { label: "프로필", href: "/profile", icon: UserRound },
  { label: "설정", href: "/settings", icon: Settings },
  { label: "운영진", href: "/admin", icon: ShieldCheck, admin: true },
];

export const statusLabel: Record<AssignmentStatus, string> = {
  missing: "미제출",
  submitted: "제출 완료",
};

export const todayLabel = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  weekday: "long",
}).format(new Date());
