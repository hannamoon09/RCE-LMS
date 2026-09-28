import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useLMS } from '@/data/LMSContext';
import { isTrack, tracks } from '@/data/lmsData';
import { calculateLeaderboard, type LeaderboardEntry } from '@/data/ranking';
import { AnimatedList, EmptyState, FilterBar, Page, PageHeader } from '@/components/shared/Primitives';

const rankLabel = (entry: LeaderboardEntry) => entry.rank === null ? '—' : String(entry.rank).padStart(2, '0');
const scoreLabel = (entry: LeaderboardEntry) => entry.reviewedCount ? entry.totalScore.toLocaleString('ko-KR') : '—';
const averageLabel = (entry: LeaderboardEntry) => entry.averageScore === null ? '—' : entry.averageScore.toFixed(1);

export function RankingsPage() {
  const { state } = useLMS();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const requestedTrack = params.get('track');
  // A query string never expands a learner's field of view.
  const track = user?.role === 'staff' && isTrack(requestedTrack) ? requestedTrack : user?.track ?? tracks[0];
  const entries = useMemo(() => calculateLeaderboard(state, track), [state, track]);
  const rankedCount = entries.filter(entry => entry.rank !== null).length;
  const current = entries.find(entry => entry.userId === user?.id);
  if (!user) return null;

  const selectTrack = (value: string) => {
    if (user.role !== 'staff' || !isTrack(value)) return;
    const next = new URLSearchParams(params);
    next.set('track', value);
    setParams(next, { replace: true });
  };

  return <Page pageKey="rankings">
    <PageHeader eyebrow="05 / RANKING" title="분야 순위" description={`${track} · 검토 완료된 점수 기준`} />
    {user.role === 'staff' && <div className="ranking-track-filter mb-8"><FilterBar label="순위 분야" value={track} onChange={selectTrack} options={tracks.map(value => ({ value, label: value }))} /></div>}
    {current && <section data-ranking-summary aria-label="내 순위 요약" className="mb-9 grid gap-6 border-b border-border-subtle pb-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <div><p className="app-meta mb-3">내 순위 · {track}</p><p className="app-number flex items-baseline gap-2"><span className="platinum-number text-4xl sm:text-5xl">{rankLabel(current)}</span>{current.rank !== null ? <span className="text-lg text-muted-foreground">/ {rankedCount}</span> : <span className="text-sm font-sans text-muted-foreground">미채점</span>}</p><p className="app-meta mt-3">{current.rank === null ? '채점 완료 후 순위에 반영됩니다.' : `채점된 ${rankedCount}명 중`}</p></div>
      <dl className="grid grid-cols-3 gap-6 sm:gap-10">{[{ label: '총점', value: scoreLabel(current) }, { label: '평균', value: averageLabel(current) }, { label: '채점 완료', value: `${current.reviewedCount}개` }].map(stat => <div key={stat.label}><dt className="app-meta">{stat.label}</dt><dd className="app-number mt-2 text-xl sm:text-2xl">{stat.value}</dd></div>)}</dl>
    </section>}
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="app-section-title">{track}</h2><p role="status" className="app-meta">전체 {entries.length}명 · 채점 완료 {rankedCount}명</p></div>
    {entries.length > 0 && rankedCount === 0 && <p className="mb-5 text-sm text-muted-foreground">아직 채점된 과제가 없습니다.</p>}
    <AnimatedList listKey={track} itemSelector="[data-ranking-user]" empty={entries.length === 0 && <EmptyState title="등록된 학생이 없습니다" />}>
      <div className="hidden md:block"><table aria-label="분야 순위" className="data-table ranking-table"><caption className="sr-only">{track} 학생의 검토 완료된 과제 점수. 미채점 학생은 순위 없이 표시합니다.</caption><colgroup><col className="w-[12%]" /><col className="w-[34%]" /><col className="w-[18%]" /><col className="w-[18%]" /><col className="w-[18%]" /></colgroup><thead><tr><th scope="col">순위</th><th scope="col">학생</th><th scope="col">총점</th><th scope="col">평균</th><th scope="col">채점 완료</th></tr></thead><tbody>{entries.map(entry => <tr key={entry.userId} data-ranking-user={entry.userId} data-rank={entry.rank ?? undefined} data-current-user={entry.userId === user.id ? 'true' : undefined} className="ranking-row">
        <td><span className="app-number rank-position text-2xl">{rankLabel(entry)}</span></td><td><StudentLabel entry={entry} current={entry.userId === user.id} /></td><td className="app-number text-xl">{scoreLabel(entry)}</td><td className="tabular-nums">{averageLabel(entry)}</td><td className="tabular-nums text-muted-foreground">{entry.reviewedCount}개</td>
      </tr>)}</tbody></table></div>
      <div className="md:hidden">{entries.map(entry => <article key={entry.userId} aria-label={`${entry.name} 순위`} data-ranking-user={entry.userId} data-rank={entry.rank ?? undefined} data-current-user={entry.userId === user.id ? 'true' : undefined} className="ranking-row px-4 py-6">
        <div className="flex items-start gap-5"><span className="app-number rank-position w-10 shrink-0 text-3xl">{rankLabel(entry)}</span><div className="min-w-0 flex-1"><StudentLabel entry={entry} current={entry.userId === user.id} /><dl className="mt-5 grid grid-cols-3 gap-3">{[{ label: '총점', value: scoreLabel(entry) }, { label: '평균', value: averageLabel(entry) }, { label: '채점 완료', value: `${entry.reviewedCount}개` }].map(stat => <div key={stat.label}><dt className="app-meta whitespace-nowrap">{stat.label}</dt><dd className="mt-2 text-sm font-medium tabular-nums">{stat.value}</dd></div>)}</dl></div></div>
      </article>)}</div>
    </AnimatedList>
    <details className="mt-8 border-t border-border-subtle pt-5 text-xs leading-6 text-muted-foreground"><summary className="w-fit cursor-pointer rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">순위 산정 기준</summary><p className="mt-3">과제별 최신 제출의 검토 완료 점수를 합산합니다. 재제출이 검토 대기 중이면 이전 점수는 보류합니다.</p><p>총점, 평균, 채점 완료 수가 높은 순으로 정렬하고, 모두 같으면 이름 순으로 정렬합니다. 미채점 학생은 순위에 포함하지 않습니다.</p></details>
  </Page>;
}

function StudentLabel({ entry, current }: { entry: LeaderboardEntry; current: boolean }) {
  return <div><p className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="font-medium [overflow-wrap:anywhere]">{entry.name}</span>{current && <span className="app-eyebrow border-l border-border-strong pl-3 text-muted-foreground">나</span>}</p>{entry.rank === null && <p className="app-meta mt-1">미채점</p>}</div>;
}
