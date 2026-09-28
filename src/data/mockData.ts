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

export const notices = [
  "RCE 2학기 활동 안내",
  "웹해킹 과제 제출 방식 변경",
  "이번 주 동아리 활동 시간 안내",
];

export const designOptions = [
  {
    id: "a",
    name: "Dashboard A",
    title: "Minimal SaaS",
    href: "/dashboard/a",
    description: "얇은 경계와 넓은 여백으로 과제 상태를 빠르게 읽는 정돈형 대시보드",
  },
  {
    id: "b",
    name: "Dashboard B",
    title: "Security Platform",
    href: "/dashboard/b",
    description: "보안 플랫폼처럼 밀도 있게 과제와 상태를 비교하는 컴팩트 레이아웃",
  },
  {
    id: "c",
    name: "Dashboard C",
    title: "Modern Bento",
    href: "/dashboard/c",
    description: "요약과 제출 현황을 크고 선명하게 보여주는 벤토 그리드",
  },
  {
    id: "d",
    name: "Dashboard D",
    title: "Brand Experimental",
    href: "/dashboard/d",
    description: "로고의 픽셀, 각도, 라인감을 간접적으로 녹인 브랜드 중심 레이아웃",
  },
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
