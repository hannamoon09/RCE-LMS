import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { AssignmentList } from "@/components/dashboard/AssignmentList";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { FocusPanel } from "@/components/dashboard/FocusPanel";
import { NoticeActivity } from "@/components/dashboard/NoticeActivity";
import { RouteTabs } from "@/components/dashboard/RouteTabs";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLearningData } from '@/data/useLearningData';
import { deadlineLabel } from '@/data/lmsData';
import { useDashboardAnimation } from "@/hooks/useDashboardAnimation";

export function DashboardC() {
  const root = useRef<HTMLDivElement>(null);
  useDashboardAnimation(root, "dashboard-c");

  return (
    <AppShell density="airy">
      <div ref={root}>
        <DashboardHeader />
        <RouteTabs />
        <div className="grid gap-5 px-5 pb-8 sm:px-8 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="min-w-0 space-y-5">
            <HeroBento />
            <AssignmentList mode="compact" />
          </section>
          <section className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-1">
            <SummaryCards variant="bento" />
            <FocusPanel variant="bento" />
            <NoticeActivity compact />
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function HeroBento() {
  const { assignments } = useLearningData();
  const next = assignments.filter(a => a.status === 'missing').sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
  return (
    <Card className="motion-panel rce-surface relative overflow-hidden p-6">
      <div className="absolute right-0 top-0 h-44 w-44 bg-[radial-gradient(circle,hsl(var(--accent)/0.16),transparent_66%)]" />
      <div className="relative">
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-md bg-secondary">
          <Sparkles className="h-5 w-5 text-accent" />
        </div>
        <p className="text-sm text-muted-foreground">다음 과제</p>
        <h2 className="mt-2 max-w-xl font-display text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-5xl">
          {next ? `${next.title} · ${deadlineLabel(next.deadline)}` : assignments.length ? '모든 과제를 제출했습니다' : '아직 등록된 과제가 없습니다'}
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          {next ? '제출 마감을 확인하고 분석 결과를 정리해 보세요. 과제 안내에서 제출할 내용을 확인할 수 있습니다.' : '과제 목록과 내 제출물에서 등록된 과제 및 피드백을 확인하세요.'}
        </p>
        <Button asChild className="mt-6"><Link to={next ? `/assignments/${next.id}` : "/assignments"}>
          {next ? "과제 열기" : "과제 목록"}
          <ArrowUpRight className="h-4 w-4" />
        </Link></Button>
      </div>
    </Card>
  );
}
