import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { formatDate, type Notice } from '@/data/lmsData';
import { useLearningData } from '@/data/useLearningData';
import { useLMS } from '@/data/LMSContext';
import { useAuth } from '@/auth/AuthContext';
import type { NoticeInput } from '@/api/notices';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/shared/Modal';
import { AnimatedList, EmptyState, ErrorState, FilterBar, FormMessage, Page, PageHeader, SearchInput } from '@/components/shared/Primitives';

function NoticeEditor({ notice, onClose }: { notice?: Notice; onClose: () => void }) {
  const { saveNotice } = useLMS();
  const { user } = useAuth();
  const [title, setTitle] = useState(notice?.title || '');
  const [body, setBody] = useState(notice?.body.join('\n\n') || '');
  const [category, setCategory] = useState(notice?.category || '운영 안내');
  const [important, setImportant] = useState(notice?.important || false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  return <form className="space-y-5" aria-busy={saving} onSubmit={async event => {
    event.preventDefault();
    if (request.current) return;
    if (!title.trim() || !body.trim() || !category.trim()) { setError('제목, 분류와 본문을 입력해 주세요.'); return; }
    const controller = new AbortController();
    request.current = controller;
    setSaving(true); setError('');
    const input: NoticeInput = { title: title.trim(), body: body.trim(), category: category.trim(), important };
    try {
      if (!await saveNotice(input, notice?.id, controller.signal)) throw new Error('공지를 저장하지 못했습니다. 다시 시도해 주세요.');
      if (!controller.signal.aborted) onClose();
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '공지를 저장하지 못했습니다.');
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }}>
    <p className="app-meta text-xs text-muted-foreground">{user?.track} 공지</p>
    <div><label htmlFor="notice-title" className="field-label">제목</label><input id="notice-title" autoFocus required maxLength={120} className="field" value={title} disabled={saving} onChange={event => setTitle(event.target.value)} /></div>
    <div><label htmlFor="notice-category" className="field-label">분류</label><input id="notice-category" required maxLength={50} className="field" value={category} disabled={saving} onChange={event => setCategory(event.target.value)} /></div>
    <div><label htmlFor="notice-body" className="field-label">본문</label><textarea id="notice-body" required maxLength={20000} rows={9} className="field" value={body} disabled={saving} onChange={event => setBody(event.target.value)} /></div>
    <label className="flex w-fit items-center gap-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-accent" checked={important} disabled={saving} onChange={event => setImportant(event.target.checked)} />중요 공지</label>
    {error && <FormMessage error>{error}</FormMessage>}
    <div className="flex justify-end gap-3 border-t border-border pt-5"><Button type="button" variant="outline" onClick={onClose}>취소</Button><Button type="submit" disabled={saving}>{saving ? '저장 중' : notice ? '변경 사항 저장' : '공지 등록'}</Button></div>
  </form>;
}

export function NoticesPage() {
  const { notices: scopedNotices } = useLearningData();
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('all');
  const notices = scopedNotices.filter(n => (filter === 'all' || n.important) && `${n.title} ${n.author}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => Number(b.important) - Number(a.important));
  return <Page pageKey="notices"><PageHeader eyebrow="03 / NOTICES" title="공지사항" action={user?.role === 'staff' && <Button onClick={() => setCreating(true)}><Plus size={16} />공지 작성</Button>} /><div className="mb-5"><SearchInput value={query} onChange={setQuery} label="공지 검색" placeholder="제목 또는 작성자 검색" /></div><FilterBar value={filter} onChange={setFilter} options={[{ value: 'all', label: '전체 공지' }, { value: 'important', label: '중요 공지' }]} /><AnimatedList listKey={`${query}-${filter}`} className="mt-3 divide-y divide-border" empty={notices.length === 0 && <EmptyState title={scopedNotices.length ? "검색 결과가 없습니다" : "아직 공지가 없습니다"} description={scopedNotices.length ? "검색어나 필터를 변경해 보세요." : user?.role === "staff" ? "공지 작성 버튼으로 분야 소식을 등록해 주세요." : "새 공지가 등록되면 이곳에서 확인할 수 있습니다."} action={scopedNotices.length > 0 && <Button variant="outline" onClick={() => { setQuery(''); setFilter('all'); }}>검색 초기화</Button>} />}>{notices.map(notice => <Link className="feed-row row-link rounded-none px-1 py-6 sm:px-3" key={notice.id} to={`/notices/${notice.id}`}><div className="min-w-0 flex-1"><div className="mb-3 flex items-center gap-2">{notice.important && <Badge variant="accent" className="gap-1">중요</Badge>}<span className="app-meta text-xs text-muted-foreground">{notice.category} · {notice.track === 'all' ? '공통' : notice.track}</span></div><h2 className="app-item-title text-base leading-7">{notice.title}</h2><p className="app-meta mt-3 text-xs text-muted-foreground">{notice.author} · {formatDate(notice.date)}</p></div><ArrowRight size={17} className="ml-3 shrink-0 text-muted-foreground" /></Link>)}</AnimatedList><Modal open={creating} onClose={() => setCreating(false)} title="새 공지 작성">{creating && <NoticeEditor onClose={() => setCreating(false)} />}</Modal></Page>;
}
export function NoticeDetailPage() {
  const { id } = useParams(); const { notices } = useLearningData(); const notice = notices.find(n => n.id === id);
  const { user } = useAuth();
  const { deleteNotice } = useLMS();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!notice) return <Page pageKey="notice-missing"><ErrorState href="/notices" description="배정된 분야에서 확인할 수 없는 공지이거나 삭제된 공지입니다." /></Page>;
  const next = notices.length > 1 ? notices[(notices.indexOf(notice) + 1) % notices.length] : null;
  const editable = user?.role === 'staff' && notice.track === user.track;
  const remove = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (!await deleteNotice(notice.id)) throw new Error('공지를 삭제하지 못했습니다. 다시 시도해 주세요.');
      navigate('/notices', { replace: true });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '공지를 삭제하지 못했습니다.');
    } finally { setBusy(false); }
  };
  return <Page pageKey={notice.id}><div className="max-w-4xl"><PageHeader back={{ href: '/notices', label: '공지 목록' }} eyebrow="03 / NOTICES" title={notice.title} description={`${notice.author} · ${formatDate(notice.date, true)} · ${notice.track === 'all' ? '공통 공지' : notice.track}`} action={editable && <div className="flex gap-2"><Button variant="outline" onClick={() => setEditing(true)}><Pencil size={15} />공지 수정</Button><Button variant="outline" onClick={() => { setError(''); setDeleting(true); }}><Trash2 size={15} />공지 삭제</Button></div>} /><article className="max-w-3xl space-y-7 py-2">{notice.body.map((paragraph, i) => <p data-reveal key={i} className="detail-copy whitespace-pre-wrap break-words">{paragraph}</p>)}</article>{next && <Link to={`/notices/${next.id}`} className="row-link mt-14 flex items-center justify-between gap-5 border-y border-border py-6"><div><p className="app-meta mb-2 text-xs text-muted-foreground">다음 공지</p><p className="app-item-title text-sm">{next.title}</p></div><ArrowRight size={17} className="shrink-0" /></Link>}</div><Modal open={editing} onClose={() => setEditing(false)} title="공지 수정">{editing && <NoticeEditor key={notice.id} notice={notice} onClose={() => setEditing(false)} />}</Modal><Modal open={deleting} onClose={() => { if (!busy) setDeleting(false); }} title="공지를 삭제할까요?"><p className="break-words text-sm leading-7 text-muted-foreground">{notice.title}<br />삭제한 공지는 복구할 수 없습니다.</p>{error && <FormMessage error>{error}</FormMessage>}<div className="mt-7 flex justify-end gap-3"><Button variant="outline" disabled={busy} onClick={() => setDeleting(false)}>취소</Button><Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={busy} onClick={() => void remove()}>{busy ? '삭제 중' : '삭제'}</Button></div></Modal></Page>;
}
