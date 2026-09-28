import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { formatDate } from '@/data/lmsData';
import { useLearningData } from '@/data/useLearningData';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AnimatedList, EmptyState, ErrorState, FilterBar, Page, PageHeader, SearchInput } from '@/components/shared/Primitives';
export function NoticesPage() {
  const { notices: scopedNotices } = useLearningData();
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('all');
  const notices = scopedNotices.filter(n => (filter === 'all' || n.important) && `${n.title} ${n.author}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => Number(b.important) - Number(a.important));
  return <Page pageKey="notices"><PageHeader eyebrow="03 / NOTICES" title="공지사항" /><div className="mb-5"><SearchInput value={query} onChange={setQuery} label="공지 검색" placeholder="제목 또는 작성자 검색" /></div><FilterBar value={filter} onChange={setFilter} options={[{ value: 'all', label: '전체 공지' }, { value: 'important', label: '중요 공지' }]} /><AnimatedList listKey={`${query}-${filter}`} className="mt-3 divide-y divide-border" empty={notices.length === 0 && <EmptyState title="검색 결과가 없습니다" action={<Button variant="outline" onClick={() => { setQuery(''); setFilter('all'); }}>검색 초기화</Button>} />}>{notices.map(notice => <Link className="feed-row row-link rounded-none px-1 py-6 sm:px-3" key={notice.id} to={`/notices/${notice.id}`}><div className="min-w-0 flex-1"><div className="mb-3 flex items-center gap-2">{notice.important && <Badge variant="accent" className="gap-1">중요</Badge>}<span className="app-meta text-xs text-muted-foreground">{notice.category} · {notice.track === 'all' ? '공통' : notice.track}</span></div><h2 className="app-item-title text-base leading-7">{notice.title}</h2><p className="app-meta mt-3 text-xs text-muted-foreground">{notice.author} · {formatDate(notice.date)}</p></div><ArrowRight size={17} className="ml-3 shrink-0 text-muted-foreground" /></Link>)}</AnimatedList></Page>;
}
export function NoticeDetailPage() {
  const { id } = useParams(); const { notices } = useLearningData(); const notice = notices.find(n => n.id === id);
  if (!notice) return <Page pageKey="notice-missing"><ErrorState href="/notices" description="배정된 분야에서 확인할 수 없는 공지이거나 삭제된 공지입니다." /></Page>;
  const next = notices.length > 1 ? notices[(notices.indexOf(notice) + 1) % notices.length] : null;
  return <Page pageKey={notice.id}><div className="max-w-4xl"><PageHeader back={{ href: '/notices', label: '공지 목록' }} eyebrow="03 / NOTICES" title={notice.title} description={`${notice.author} · ${formatDate(notice.date, true)} · ${notice.track === 'all' ? '공통 공지' : notice.track}`} /><article className="max-w-3xl space-y-7 py-2">{notice.body.map((paragraph, i) => <p data-reveal key={i} className="detail-copy">{paragraph}</p>)}</article>{next && <Link to={`/notices/${next.id}`} className="row-link mt-14 flex items-center justify-between gap-5 border-y border-border py-6"><div><p className="app-meta mb-2 text-xs text-muted-foreground">다음 공지</p><p className="app-item-title text-sm">{next.title}</p></div><ArrowRight size={17} className="shrink-0" /></Link>}</div></Page>;
}
