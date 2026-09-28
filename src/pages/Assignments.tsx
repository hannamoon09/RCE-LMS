import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, CalendarDays, CheckCircle2, LoaderCircle } from 'lucide-react';
import { useLMS } from '@/data/LMSContext';
import { useLearningData } from '@/data/useLearningData';
import { deadlineLabel, formatDate } from '@/data/lmsData';
import { deleteFiles, persistSelectedFiles, type SelectedFile } from '@/data/fileStore';
import { Button } from '@/components/ui/button';
import { AssignmentRow } from '@/components/shared/AssignmentRow';
import { FilePicker } from '@/components/shared/FilePicker';
import { FileList } from '@/components/shared/FileList';
import { AnimatedList, EmptyState, ErrorState, FilterBar, FormMessage, Page, PageHeader, ReviewBadge, SearchInput, SectionHeading, StatusBadge } from '@/components/shared/Primitives';
import { Modal } from '@/components/shared/Modal';

export function AssignmentsPage() {
  const { assignments } = useLearningData();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';
  const requestedStatus = params.get('status');
  const status = requestedStatus === 'missing' || requestedStatus === 'submitted' ? requestedStatus : 'all';
  const update = (name: string, value: string) => {
    const next = new URLSearchParams(window.location.search);
    next.delete('category'); next.delete('track');
    if (!value || value === 'all') next.delete(name); else next.set(name, value);
    setParams(next, { replace: true });
  };
  const filtered = assignments.filter(assignment => (status === 'all' || assignment.status === status) && `${assignment.title} ${assignment.description}`.toLowerCase().includes(query.toLowerCase()));
  return <Page pageKey="assignments"><PageHeader eyebrow="02 / ASSIGNMENTS" title="과제" /><div className="mb-5"><SearchInput value={query} onChange={value => update('q', value)} label="과제 검색" placeholder="과제명 또는 내용 검색" /></div><FilterBar value={status} onChange={value => update('status', value)} options={[{ value: 'all', label: '전체', count: assignments.length }, { value: 'missing', label: '미제출' }, { value: 'submitted', label: '제출 완료' }]} /><p role="status" className="app-meta my-5 text-xs text-muted-foreground">{filtered.length}개의 과제</p><AnimatedList listKey={`${query}-${status}`} className="border-t border-border" empty={filtered.length === 0 && <EmptyState title="조건에 맞는 과제가 없습니다" description="검색어나 필터를 변경해 보세요." action={<Button variant="outline" onClick={() => setParams({})}>필터 초기화</Button>} />}>{filtered.map(assignment => <AssignmentRow key={assignment.id} assignment={assignment} />)}</AnimatedList></Page>;
}

export function AssignmentDetailPage() {
  const { id } = useParams();
  const { assignments, submissions } = useLearningData();
  const location = useLocation();
  const assignment = assignments.find(item => item.id === id);
  const submission = submissions.find(item => item.assignmentId === id);
  if (!assignment) return <Page pageKey="missing-assignment"><ErrorState href="/assignments" /></Page>;
  const closed = new Date(assignment.deadline).getTime() < Date.now();
  return <Page pageKey={assignment.id}><PageHeader back={{ href: '/assignments', label: '과제 목록' }} eyebrow="02 / ASSIGNMENTS" title={assignment.title} description={`난이도 ${assignment.difficulty} · 작성자 ${assignment.author}`} />{location.state?.submitted && <div role="status" className="mb-7 flex items-center gap-3 rounded-md border border-accent/30 bg-accent/5 p-4 text-sm"><CheckCircle2 size={18} className="shrink-0 text-accent" />과제가 제출되었습니다. 검토 상태는 내 제출물에서 확인하세요.</div>}
    <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_18rem]"><div className="min-w-0"><section data-reveal className="mb-9"><SectionHeading title="과제 안내" /><p className="detail-copy whitespace-pre-wrap break-words">{assignment.description}</p></section><section data-reveal className="border-t border-border py-8"><SectionHeading title="첨부파일" /><FileList files={assignment.attachments} emptyLabel="첨부 파일 없음" /></section>
      {submission && <section data-reveal className="border-t border-border py-8"><SectionHeading title="내 제출 내용" /><div className="mb-5 flex flex-wrap items-center gap-3"><ReviewBadge status={submission.status} /><span className="app-meta text-xs text-muted-foreground">{formatDate(submission.submittedAt, true)} 제출</span></div><h3 className="app-item-title mb-3 text-sm">제출 파일</h3><FileList files={submission.files} emptyLabel="제출한 파일이 없습니다." /><h3 className="app-item-title mb-3 mt-7 text-sm">메모 및 질문</h3><p className="detail-copy whitespace-pre-wrap break-words">{submission.text || '등록된 메모 및 질문이 없습니다.'}</p>{(submission.feedback || submission.score !== null) && <div className="mt-7 border-l-2 border-accent pl-5"><h3 className="app-item-title text-sm">운영진 피드백 {submission.score !== null && <span className="ml-3 font-medium tabular-nums text-accent">{submission.score} / 100</span>}</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{submission.feedback}</p></div>}</section>}
    </div><aside className="order-first border-l-0 border-border xl:sticky xl:top-8 xl:order-last xl:border-l xl:pl-7"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">과제 상태</p><StatusBadge status={assignment.status} /></div><div className="my-6 border-y border-border py-5"><p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays size={15} />제출 마감</p><p className="app-number text-xl">{deadlineLabel(assignment.deadline)}</p><p className="mt-2 text-sm text-muted-foreground">{formatDate(assignment.deadline, true)}</p></div>{closed ? <Button disabled className="w-full">제출 기간이 종료되었습니다</Button> : <Button asChild className="w-full"><Link to={`/assignments/${id}/submit`}>{submission ? '다시 제출하기' : '과제 제출하기'}<ArrowRight size={16} /></Link></Button>}<p className="mt-3 text-xs leading-6 text-muted-foreground">{submission ? '마감 전 다시 제출하면 이전 내용이 새 제출 내용으로 교체됩니다.' : '파일을 제출하고 궁금한 점은 선택 메모로 남겨 주세요.'}</p></aside></div>
  </Page>;
}

export function AssignmentSubmitPage() {
  const { id } = useParams();
  const { submit } = useLMS();
  const { assignments, submissions } = useLearningData();
  const navigate = useNavigate();
  const assignment = assignments.find(item => item.id === id);
  const existing = submissions.find(item => item.assignmentId === id);
  const [text, setText] = useState(existing?.text || '');
  const [files, setFiles] = useState<SelectedFile[]>(existing?.files || []);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; pending.current?.abort(); }; }, []);
  if (!assignment) return <Page pageKey="missing-submit"><ErrorState href="/assignments" /></Page>;
  const closed = new Date(assignment.deadline).getTime() < Date.now();
  const closeConfirmation = () => { pending.current?.abort(); setConfirm(false); };
  const save = async () => {
    if (pending.current || saving) return;
    if (new Date(assignment.deadline).getTime() < Date.now()) { setConfirm(false); setError('제출 기간이 종료되었습니다.'); return; }
    const controller = new AbortController();
    const startedPath = window.location.pathname;
    pending.current = controller;
    setSaving(true);
    const oldIds = new Set(files.flatMap(file => file.id ? [file.id] : []));
    let createdIds: string[] = [];
    try {
      const saved = await persistSelectedFiles(files, controller.signal);
      createdIds = saved.flatMap(file => file.id && !oldIds.has(file.id) ? [file.id] : []);
      // The transition keeps the previous page mounted while its exit runs.
      if (controller.signal.aborted || !mounted.current || window.location.pathname !== startedPath) { await deleteFiles(createdIds); return; }
      if (!submit(assignment.id, text.trim(), saved)) throw new Error('현재 제출할 수 없습니다. 과제 마감과 계정 상태를 확인해 주세요.');
      const keepIds = new Set(saved.flatMap(file => file.id ? [file.id] : []));
      const removedIds = (existing?.files || []).flatMap(file => file.id && !keepIds.has(file.id) ? [file.id] : []);
      void deleteFiles(removedIds).catch(() => undefined);
      pending.current = null;
      setConfirm(false);
      navigate(`/assignments/${id}`, { replace: true, state: { submitted: true } });
    } catch (failure) {
      if (createdIds.length) await deleteFiles(createdIds).catch(() => undefined);
      if (!controller.signal.aborted && mounted.current) { setConfirm(false); setError(failure instanceof Error ? failure.message : '제출하지 못했습니다. 다시 시도해 주세요.'); }
    } finally {
      if (pending.current === controller) pending.current = null;
      if (mounted.current) setSaving(false);
    }
  };
  return <Page pageKey={`submit-${id}`}><PageHeader back={{ href: `/assignments/${id}`, label: '과제 상세' }} eyebrow="02 / SUBMIT" title="과제 제출" description={assignment.title} /><div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_18rem]"><form aria-busy={saving} onSubmit={event => { event.preventDefault(); if (closed || saving) return; if (!text.trim() && files.length === 0) { setError('파일을 추가하거나 메모 및 질문을 작성해 주세요.'); return; } setError(''); setConfirm(true); }}>
      <section><SectionHeading title="제출 파일" /><FilePicker files={files} onChange={next => { setFiles(next); setError(''); }} disabled={closed || saving} label="제출 파일 선택" /></section><section className="mt-8 border-t border-border pt-7"><label htmlFor="submission-text" className="field-label">메모 및 질문 (선택)</label><p id="submission-text-help" className="mb-4 text-sm leading-6 text-muted-foreground">파일만 제출해도 괜찮습니다. 배운 내용, 어려웠던 부분이나 질문을 자유롭게 남겨 주세요.</p><textarea id="submission-text" aria-describedby="submission-text-help" value={text} onChange={event => setText(event.target.value)} rows={6} maxLength={20000} disabled={closed || saving} className="field resize-y" placeholder="배운 내용, 이해되지 않은 부분, 추가로 배우고 싶은 내용이나 피드백 받고 싶은 점이 있나요?" /><p className="app-meta mt-2 text-right font-mono text-xs text-muted-foreground">{text.length.toLocaleString()} / 20,000</p></section>{error && <FormMessage error>{error}</FormMessage>}<div className="mt-8 flex items-center justify-end gap-3 border-t border-border pt-6"><Button asChild variant="outline"><Link to={`/assignments/${id}`}>취소</Link></Button><Button type="submit" disabled={closed || saving}>{closed ? '제출 마감' : saving ? '저장 중' : existing ? '다시 제출' : '제출하기'}<ArrowRight size={16} /></Button></div>
    </form><aside className="order-first border-b border-border pb-6 xl:order-last xl:border-b-0 xl:border-l xl:pl-7"><p className="app-meta text-xs text-muted-foreground">제출할 과제</p><h2 className="app-item-title mt-3 break-words text-lg">{assignment.title}</h2><p className="mt-4 text-sm text-muted-foreground">마감 {formatDate(assignment.deadline, true)}</p><p className="mt-2 font-medium tabular-nums text-accent">{deadlineLabel(assignment.deadline)}</p><div className="mt-5"><StatusBadge status={assignment.status} /></div>{existing && <p className="mt-4 text-xs leading-6 text-muted-foreground">다시 제출하면 기존 파일과 메모가 교체되고 검토 대기 상태로 변경됩니다.</p>}</aside></div>
    <Modal open={confirm} onClose={closeConfirmation} title={existing ? '과제를 다시 제출할까요?' : '과제를 제출할까요?'}><p className="break-words text-sm leading-7 text-muted-foreground">{assignment.title}<br />첨부파일 {files.length}개 · {text.trim() ? `메모 ${text.trim().length.toLocaleString()}자` : '메모 없음'}</p>{existing && <p className="mt-3 text-sm leading-6 text-muted-foreground">기존 제출 내용과 피드백이 새 제출로 교체됩니다.</p>}<div className="mt-7 flex justify-end gap-3"><Button variant="outline" onClick={closeConfirmation}>{saving ? '저장 취소' : '계속 작성'}</Button><Button disabled={saving} onClick={() => void save()}>{saving ? <><LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" />저장 중</> : '제출 확정'}</Button></div></Modal>
  </Page>;
}
