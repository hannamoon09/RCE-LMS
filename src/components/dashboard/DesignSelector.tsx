import { Link } from "react-router-dom";
import { ArrowRight, LayoutDashboard } from "lucide-react";
import { BrandMark } from "@/components/dashboard/BrandMark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { designOptions } from "@/data/mockData";

export function DesignSelector() {
  return (
    <main className="min-h-screen bg-background rce-grid px-5 py-8 text-foreground sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex items-center justify-between gap-4">
          <BrandMark />
          <div className="hidden rounded-md border border-border bg-card px-3 py-2 font-mono text-xs text-muted-foreground sm:block">
            RCE Dashboard Prototype
          </div>
        </div>
        <section className="mb-8 max-w-3xl">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <h1 className="text-3xl font-semibold tracking-normal sm:text-5xl">RCE LMS Dashboard</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
            공식 로고의 모듈형 픽셀, 낮은 채도, 날카로운 실루엣을 하나의 디자인 시스템으로 해석한
            네 가지 대시보드 방향입니다.
          </p>
        </section>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Design options">
          {designOptions.map((option) => (
            <Card key={option.id} className="rce-surface motion-panel flex min-h-64 flex-col p-5">
              <div className="mb-8 h-20 rounded-md border border-border bg-background/70 p-3">
                <div className="motion-line h-px w-4/5 bg-primary" />
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <span className="h-7 rounded-sm bg-secondary" />
                  <span className="h-7 rounded-sm bg-secondary" />
                  <span className="h-7 rounded-sm bg-accent/30" />
                </div>
              </div>
              <p className="font-mono text-xs text-muted-foreground">{option.name}</p>
              <h2 className="mt-2 text-xl font-semibold">{option.title}</h2>
              <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">{option.description}</p>
              <Button asChild className="mt-6 w-full">
                <Link to={option.href}>
                  Preview
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
