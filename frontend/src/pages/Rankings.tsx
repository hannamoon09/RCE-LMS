import { useAuth } from '@/auth/AuthContext';
import { useLMS } from '@/data/LMSContext';
import type { RankingEntry } from '@/api/rankings';
import { AnimatedList, EmptyState, Page, PageHeader } from '@/components/shared/Primitives';

const rankLabel = (entry: RankingEntry) => String(entry.rank).padStart(2, '0');
const scoreLabel = (entry: RankingEntry) => entry.totalScore.toLocaleString('ko-KR');
const averageLabel = (entry: RankingEntry) => entry.averageScore.toFixed(1);

export function RankingsPage() {
  const { rankings: entries } = useLMS();
  const { user } = useAuth();
  const reviewedMemberCount = entries.filter(entry => entry.reviewedCount > 0).length;
  const current = entries.find(entry => entry.isMe);
  if (!user) return null;
  const track = user.track;

  return <Page pageKey="rankings">
    <PageHeader eyebrow="05 / RANKING" title="분야 순위" description={`${track} · 검토 완료된 점수 기준`} />
    <p className="app-meta mb-8 text-muted-foreground">FIELD <span className="ml-3 text-foreground">{track}</span></p>
    {current && <section data-ranking-summary aria-label="내 순위 요약" className="mb-9 grid gap-6 border-b border-border-subtle pb-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <div><p className="app-meta mb-3">내 순위 · {track}</p><p className="app-number flex items-baseline gap-2"><span className="platinum-number text-4xl sm:text-5xl">{rankLabel(current)}</span><span className="text-lg text-muted-foreground">/ {entries.length}</span></p><p className="app-meta mt-3">{`활성 학생 ${entries.length}명 중`}</p></div>
      <dl className="grid grid-cols-3 gap-6 sm:gap-10">{[{ label: '총점', value: scoreLabel(current) }, { label: '평균', value: averageLabel(current) }, { label: '채점 완료', value: `${current.reviewedCount}개` }].map(stat => <div key={stat.label}><dt className="app-meta">{stat.label}</dt><dd className="app-number mt-2 text-xl sm:text-2xl">{stat.value}</dd></div>)}</dl>
    </section>}
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="app-section-title">{track}</h2><p role="status" className="app-meta">전체 {entries.length}명 · 채점 완료 {reviewedMemberCount}명</p></div>
    {entries.length > 0 && reviewedMemberCount === 0 && <p className="mb-5 text-sm text-muted-foreground">아직 채점된 과제가 없습니다.</p>}
    <AnimatedList listKey={track} itemSelector="[data-ranking-user]" empty={entries.length === 0 && <EmptyState title="등록된 학생이 없습니다" />}>
      <div className="hidden md:block"><table aria-label="분야 순위" className="data-table ranking-table"><caption className="sr-only">{track} 학생의 검토 완료된 과제 점수. 미채점 학생도 0점으로 순위에 포함합니다.</caption><colgroup><col className="w-[12%]" /><col className="w-[34%]" /><col className="w-[18%]" /><col className="w-[18%]" /><col className="w-[18%]" /></colgroup><thead><tr><th scope="col">순위</th><th scope="col">학생</th><th scope="col">총점</th><th scope="col">평균</th><th scope="col">채점 완료</th></tr></thead><tbody>{entries.map(entry => <tr key={entry.rank} data-ranking-user={entry.rank} data-rank={entry.rank} data-current-user={entry.isMe ? 'true' : undefined} className="ranking-row">
        <td><span className="app-number rank-position text-2xl">{rankLabel(entry)}</span></td><td><StudentLabel entry={entry} current={entry.isMe} /></td><td className="app-number text-xl">{scoreLabel(entry)}</td><td className="tabular-nums">{averageLabel(entry)}</td><td className="tabular-nums text-muted-foreground">{entry.reviewedCount}개</td>
      </tr>)}</tbody></table></div>
      <div className="md:hidden">{entries.map(entry => <article key={entry.rank} aria-label={`${entry.name} 순위`} data-ranking-user={entry.rank} data-rank={entry.rank} data-current-user={entry.isMe ? 'true' : undefined} className="ranking-row px-4 py-6">
        <div className="flex items-start gap-5"><span className="app-number rank-position w-10 shrink-0 text-3xl">{rankLabel(entry)}</span><div className="min-w-0 flex-1"><StudentLabel entry={entry} current={entry.isMe} /><dl className="mt-5 grid grid-cols-3 gap-3">{[{ label: '총점', value: scoreLabel(entry) }, { label: '평균', value: averageLabel(entry) }, { label: '채점 완료', value: `${entry.reviewedCount}개` }].map(stat => <div key={stat.label}><dt className="app-meta whitespace-nowrap">{stat.label}</dt><dd className="mt-2 text-sm font-medium tabular-nums">{stat.value}</dd></div>)}</dl></div></div>
      </article>)}</div>
    </AnimatedList>
    <details className="mt-8 border-t border-border-subtle pt-5 text-xs leading-6 text-muted-foreground"><summary className="w-fit cursor-pointer rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">순위 산정 기준</summary><p className="mt-3">과제별 최신 제출의 검토 완료 점수를 합산합니다. 재제출이 검토 대기 중이면 이전 점수는 보류합니다.</p><p>총점, 평균, 채점 완료 수가 높은 순으로 정렬하고, 모두 같으면 이름 순으로 정렬합니다. 미채점 활성 학생도 0점으로 포함하며, 모든 학생에게 순서대로 순위를 부여합니다.</p></details>
  </Page>;
}

function StudentLabel({ entry, current }: { entry: RankingEntry; current: boolean }) {
  return <div><p className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="font-medium [overflow-wrap:anywhere]">{entry.name}</span>{current && <span className="app-eyebrow border-l border-border-strong pl-3 text-muted-foreground">나</span>}</p>{entry.reviewedCount === 0 && <p className="app-meta mt-1">미채점</p>}</div>;
}
