import { useRef, useState } from 'react';
import { Link, NavLink, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useLMS } from '@/data/LMSContext';
import { currentUserId, formatDate, deadlineLabel, roleLabels, type LMSAssignment, type Submission, type Role, tracks, type Track, isTrack } from '@/data/lmsData';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AnimatedList, EmptyState, FilterBar, FormMessage, Page, PageHeader, ReviewBadge, SearchInput, SectionHeading } from '@/components/shared/Primitives';
import { Modal } from '@/components/shared/Modal';
import { FileList } from '@/components/shared/FileList';
import { deleteFiles } from '@/data/fileStore';
import { AssignmentEditor } from '@/components/admin/AssignmentEditor';
import { cn } from '@/lib/utils';
function AdminNav() { return <nav aria-label="운영진 메뉴" className="filter-bar mb-7">{[{ href: '/admin', label: '운영 개요' }, { href: '/admin/assignments', label: '과제 관리' }, { href: '/admin/submissions', label: '제출 검토' }, { href: '/admin/users', label: '학생 관리' }].map(item => <NavLink end key={item.href} to={item.href} className={({ isActive }) => cn('filter-button', isActive && 'is-selected')}>{item.label}</NavLink>)}</nav>; }
export function AdminPage() {
  const { state } = useLMS();
  const openAssignments = state.assignments.filter(assignment => new Date(assignment.deadline).getTime() > Date.now());
  const pending = state.submissions.filter(submission => submission.status === 'pending');
  const stats = [
    { label: '전체 학생', value: state.users.length, href: '/admin/users' },
    { label: '접수 중 과제', value: openAssignments.length, href: '/admin/assignments' },
    { label: '전체 과제', value: state.assignments.length, href: '/admin/assignments' },
  ];
  return <Page pageKey="admin">
    <PageHeader eyebrow="08 / ADMIN" title="운영 개요" action={<Button asChild><Link to="/admin/assignments?create=1"><Plus size={16} />과제 생성</Link></Button>} />
    <AdminNav />
    <section aria-label="운영 현황" className="flex flex-col gap-8 border-b border-border-subtle py-7 sm:flex-row sm:items-end sm:justify-between sm:gap-10 sm:pb-10">
      <Link to="/admin/submissions?status=pending" className="group w-fit">
        <p className="text-sm text-muted-foreground transition-colors group-hover:text-foreground">검토 대기 제출</p>
        <p className="app-number mt-3 text-6xl sm:text-7xl">{String(pending.length).padStart(2, '0')}</p>
      </Link>
      <dl className="flex flex-wrap gap-x-8 gap-y-5 sm:pb-1 sm:gap-x-10">
        {stats.map(stat => <div key={stat.label}>
          <dt className="app-meta text-xs text-muted-foreground">{stat.label}</dt>
          <dd className="mt-2"><Link to={stat.href} aria-label={`${stat.label} ${stat.value}`} className="app-number text-2xl text-muted-foreground transition-colors hover:text-foreground">{stat.value}</Link></dd>
        </div>)}
      </dl>
    </section>
    <div className="mt-14 grid gap-12 xl:grid-cols-[minmax(0,1fr)_15rem] xl:gap-14">
      <section>
        <SectionHeading title="검토를 기다리는 제출" meta={`${pending.length}`} href="/admin/submissions" />
        <div className="divide-y divide-border-subtle">
          {pending.slice(0, 5).map(submission => <Link key={submission.id} to={`/admin/submissions?submission=${submission.id}`} className="feed-row -mx-3 py-5">
            <div className="min-w-0 flex-1">
              <p className="app-item-title text-base">{state.assignments.find(assignment => assignment.id === submission.assignmentId)?.title}</p>
              <p className="app-meta mt-2 text-xs text-muted-foreground">{state.users.find(user => user.id === submission.userId)?.name} · {formatDate(submission.submittedAt, true)}</p>
            </div>
          </Link>)}
        </div>
        {pending.length === 0 && <EmptyState title="모든 제출물 검토를 마쳤습니다" />}
      </section>
      <section>
        <SectionHeading title="가까운 마감" />
        <div className="divide-y divide-border-subtle">
          {[...openAssignments].sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 3).map(assignment => <Link key={assignment.id} className="block py-5 first:pt-0" to={`/admin/assignments?q=${encodeURIComponent(assignment.title)}`}>
            <p className="mb-2 text-sm font-medium tabular-nums text-muted-foreground">{deadlineLabel(assignment.deadline)}</p>
            <p className="app-item-title text-sm">{assignment.title}</p>
            <p className="app-meta mt-2 text-xs text-muted-foreground">{formatDate(assignment.deadline, true)}</p>
          </Link>)}
        </div>
        {openAssignments.length === 0 && <p className="text-sm text-muted-foreground">접수 중인 과제가 없습니다.</p>}
      </section>
    </div>
  </Page>;
}
export function AdminAssignmentsPage() {
  const { state, saveAssignment, deleteAssignment } = useLMS(); const [params, setParams] = useSearchParams(); const [query, setQuery] = useState(params.get('q') || ''); const [editor, setEditor] = useState<LMSAssignment | 'new' | null>(params.get('create') ? 'new' : null); const [deleting, setDeleting] = useState<LMSAssignment | null>(null); const [message, setMessage] = useState('');
  const saveRequest = useRef<AbortController | null>(null);
  const assignments = state.assignments.filter(a => a.title.toLowerCase().includes(query.toLowerCase())); 
  const closeEditor = () => { saveRequest.current?.abort(); setEditor(null); if (params.has('create')) { const next = new URLSearchParams(params); next.delete('create'); setParams(next, { replace: true }); } };
  const actions = (a: LMSAssignment) => <div className="flex shrink-0 items-center gap-1"><Button variant="ghost" size="icon" aria-label={`${a.title} 수정`} onClick={() => setEditor(a)}><Pencil size={15} /></Button><Button variant="ghost" size="icon" aria-label={`${a.title} 삭제`} onClick={() => setDeleting(a)}><Trash2 size={15} className="text-muted-foreground" /></Button></div>;
  const removeAssignment = () => {
    if (!deleting) return;
    const candidates = [...deleting.attachments, ...state.submissions.filter(item => item.assignmentId === deleting.id).flatMap(item => item.files)];
    const retained = new Set([
      ...state.assignments.filter(item => item.id !== deleting.id).flatMap(item => item.attachments),
      ...state.submissions.filter(item => item.assignmentId !== deleting.id).flatMap(item => item.files),
      ...state.users.flatMap(user => user.profileImage ? [user.profileImage] : []),
    ].flatMap(file => file.id ? [file.id] : []));
    if (!deleteAssignment(deleting.id)) { setMessage('과제를 삭제하지 못했습니다. 다시 시도해 주세요.'); setDeleting(null); return; }
    void deleteFiles(candidates.flatMap(file => file.id && !retained.has(file.id) ? [file.id] : [])).catch(() => undefined);
    setMessage('과제가 삭제되었습니다.'); setDeleting(null);
  };
  const count = (a: LMSAssignment) => new Set(state.submissions.filter(s => s.assignmentId === a.id).map(s => s.userId)).size;
  return <Page pageKey="admin-assignments"><PageHeader eyebrow="08.1 / ASSIGNMENTS" title="과제 관리" action={<Button onClick={() => setEditor('new')}><Plus size={16} />과제 생성</Button>} /><AdminNav /><SearchInput value={query} onChange={setQuery} label="운영진 과제 검색" placeholder="과제명 검색" />{message && <FormMessage>{message}</FormMessage>}<AnimatedList listKey={query} itemSelector="[data-list-item]" empty={assignments.length === 0 && <EmptyState title="표시할 과제가 없습니다" action={<Button variant="outline" onClick={() => { setQuery(''); setParams({}, { replace: true }); }}>검색 초기화</Button>} />}><div className="mt-5 hidden md:block"><table className="data-table"><thead><tr><th>과제</th><th>마감</th><th>제출 현황</th><th>관리</th></tr></thead><tbody>{assignments.map(a => <tr key={a.id} data-list-item><td><button type="button" className="app-item-title text-left [overflow-wrap:anywhere] hover:text-accent" onClick={() => setEditor(a)}>{a.title}</button><p className="app-meta mt-2 text-xs text-muted-foreground">첨부 {a.attachments.length}개 · {a.author}</p></td><td><p className="font-medium tabular-nums">{deadlineLabel(a.deadline)}</p><p className="app-meta mt-2 text-xs text-muted-foreground">{formatDate(a.deadline, true)}</p></td><td><Link className="inline-flex items-center gap-2 hover:text-accent" to={`/admin/submissions?assignment=${a.id}`}><span className="tabular-nums">{count(a)}명 제출</span><ArrowUpRight size={14} /></Link></td><td>{actions(a)}</td></tr>)}</tbody></table></div><div className="mt-5 divide-y divide-border md:hidden">{assignments.map(a => <article key={a.id} data-list-item className="py-5"><div className="flex items-start justify-between gap-3"><button type="button" className="min-w-0 flex-1 pt-2 app-item-title text-left text-base [overflow-wrap:anywhere]" onClick={() => setEditor(a)}>{a.title}</button>{actions(a)}</div><p className="app-meta mt-2 text-xs text-muted-foreground">첨부 {a.attachments.length}개 · {a.author}</p><div className="mt-4 flex justify-between gap-3 text-sm"><span>{deadlineLabel(a.deadline)} · {formatDate(a.deadline)}</span><Link className="text-accent" to={`/admin/submissions?assignment=${a.id}`}>{count(a)}명 제출</Link></div></article>)}</div></AnimatedList><Modal open={editor !== null} onClose={closeEditor} title={editor === 'new' ? '새 과제 생성' : '과제 수정'}>{editor && <AssignmentEditor saveRequest={saveRequest} key={editor === 'new' ? 'new' : editor.id} assignment={editor === 'new' ? undefined : editor} onCancel={closeEditor} onSave={a => { if (!saveAssignment(a)) return false; setMessage(editor === 'new' ? '새 과제가 생성되었습니다.' : '과제가 수정되었습니다.'); closeEditor(); return true; }} />}</Modal><Modal open={deleting !== null} onClose={() => setDeleting(null)} title="과제를 삭제할까요?"><p className="text-sm leading-7 text-muted-foreground">{deleting?.title}<br />관련 제출물 {state.submissions.filter(s => s.assignmentId === deleting?.id).length}개와 활동 기록도 함께 삭제됩니다.</p><div className="mt-7 flex justify-end gap-3"><Button variant="outline" onClick={() => setDeleting(null)}>취소</Button><Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={removeAssignment}>삭제</Button></div></Modal></Page>;
}
function ReviewEditor({ submission, onSave }: { submission: Submission; onSave: (patch: Pick<Submission, 'status' | 'score' | 'feedback'>) => boolean }) {
  const [score, setScore] = useState(submission.score?.toString() || '');
  const [feedback, setFeedback] = useState(submission.feedback);
  const [error, setError] = useState('');
  return <form onSubmit={event => {
    event.preventDefault();
    if (score === '' || !Number.isInteger(Number(score)) || Number(score) < 0 || Number(score) > 100) { setError('점수는 0부터 100까지의 정수로 입력해 주세요.'); return; }
    if (!feedback.trim()) { setError('학생에게 전달할 피드백을 작성해 주세요.'); return; }
    if (!onSave({ status: 'reviewed', score: Number(score), feedback: feedback.trim() })) setError('검토를 저장하지 못했습니다. 다시 시도해 주세요.');
  }}>
    <div className="mb-6 border-b border-border pb-6"><p className="app-meta mb-3 text-xs text-muted-foreground">학생 메모 및 질문 · {formatDate(submission.submittedAt, true)}</p><p className="whitespace-pre-wrap break-words text-sm leading-7">{submission.text || '작성한 메모가 없습니다.'}</p><div className="mt-5"><FileList files={submission.files} emptyLabel="첨부 파일 없음" /></div></div>
    <div><label htmlFor="review-score" className="field-label">점수 / 100</label><input id="review-score" type="number" min={0} max={100} step={1} required value={score} onChange={event => setScore(event.target.value)} className="field" /></div>
    <div className="mt-5"><label htmlFor="review-feedback" className="field-label">피드백</label><textarea id="review-feedback" required rows={5} className="field" value={feedback} onChange={event => setFeedback(event.target.value)} /></div>
    <p className="app-meta mt-3 text-xs text-muted-foreground">저장하면 검토 완료 상태로 변경됩니다.</p>
    {error && <FormMessage error>{error}</FormMessage>}
    <div className="mt-6 flex justify-end"><Button type="submit">검토 저장</Button></div>
  </form>;
}
export function AdminSubmissionsPage() {
  const { state, review } = useLMS();
  const [params, setParams] = useSearchParams();
  const [message, setMessage] = useState('');
  const query = params.get('q') || '';
  const requestedStatus = params.get('status');
  const status = requestedStatus === 'pending' || requestedStatus === 'reviewed' ? requestedStatus : 'all';
  const requestedTrack = params.get('track');
  const track = isTrack(requestedTrack) ? requestedTrack : 'all';
  const assignment = params.get('assignment') || 'all';
  const selected = state.submissions.find(submission => submission.id === params.get('submission')) || null;
  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(window.location.search);
    if (!value || value === 'all') next.delete(key); else next.set(key, value);
    setParams(next, { replace: true });
  };
  const setSelected = (value: Submission | null) => updateParam('submission', value?.id || '');
  const submissions = state.submissions.filter(submission => {
    const student = state.users.find(user => user.id === submission.userId);
    const task = state.assignments.find(item => item.id === submission.assignmentId);
    return (status === 'all' || submission.status === status)
      && (assignment === 'all' || submission.assignmentId === assignment)
      && (track === 'all' || student?.track === track)
      && `${student?.name || ''} ${task?.title || ''}`.toLowerCase().includes(query.toLowerCase());
  }).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const taskTitle = (submission: Submission) => state.assignments.find(task => task.id === submission.assignmentId)?.title || '삭제된 과제';
  const studentName = (submission: Submission) => state.users.find(user => user.id === submission.userId)?.name || '알 수 없는 학생';
  const studentTrack = (submission: Submission) => state.users.find(user => user.id === submission.userId)?.track;
  return <Page pageKey="admin-submissions">
    <PageHeader eyebrow="08.2 / REVIEWS" title="제출 검토" />
    <AdminNav />
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_11rem_16rem]">
      <SearchInput value={query} onChange={value => updateParam('q', value)} label="제출물 검색" placeholder="제출자 또는 과제 검색" />
      <select aria-label="제출물 분야 필터" className="field min-w-0 max-w-full" value={track} onChange={event => updateParam('track', event.target.value)}><option value="all">전체 분야</option>{tracks.map(value => <option key={value} value={value}>{value}</option>)}</select>
      <select aria-label="과제별 제출물" className="field min-w-0 max-w-full sm:col-span-2 xl:col-span-1" value={assignment} onChange={event => updateParam('assignment', event.target.value)}><option value="all">모든 과제</option>{state.assignments.map(task => <option value={task.id} key={task.id}>{task.title}</option>)}</select>
    </div>
    <FilterBar value={status} onChange={value => updateParam('status', value)} options={[{ value: 'all', label: '전체' }, { value: 'pending', label: '검토 대기' }, { value: 'reviewed', label: '검토 완료' }]} />
    {message && <FormMessage>{message}</FormMessage>}
    <AnimatedList listKey={`${query}-${status}-${assignment}-${track}`} itemSelector="[data-list-item]" empty={submissions.length === 0 && <EmptyState title="조건에 맞는 제출물이 없습니다" action={<Button variant="outline" onClick={() => setParams({}, { replace: true })}>필터 초기화</Button>} />}>
      <div className="hidden md:block"><table className="data-table"><thead><tr><th>제출자 / 과제</th><th>제출 시간</th><th>상태</th><th>점수</th><th>피드백</th></tr></thead><tbody>{submissions.map(submission => <tr key={submission.id} data-list-item>
        <td><p className="font-medium [overflow-wrap:anywhere]">{studentName(submission)}</p><p className="app-meta mt-1 text-xs text-muted-foreground">{studentTrack(submission)}</p><p className="app-meta mt-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">{taskTitle(submission)}</p></td>
        <td className="app-meta text-xs">{formatDate(submission.submittedAt, true)}</td><td><ReviewBadge status={submission.status} /></td><td className="font-medium tabular-nums">{submission.score ?? '—'}</td>
        <td><Button variant="outline" size="sm" onClick={() => setSelected(submission)}>{submission.status === 'pending' ? '검토하기' : '피드백 수정'}</Button></td>
      </tr>)}</tbody></table></div>
      <div className="divide-y divide-border md:hidden">{submissions.map(submission => <article key={submission.id} data-list-item className="py-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium [overflow-wrap:anywhere]">{studentName(submission)}</p><p className="app-meta mt-1 text-xs text-muted-foreground">{studentTrack(submission)}</p></div><ReviewBadge status={submission.status} /></div><h2 className="app-item-title mt-3 text-base [overflow-wrap:anywhere]">{taskTitle(submission)}</h2><p className="app-meta mt-2 text-xs text-muted-foreground">{formatDate(submission.submittedAt, true)} · {submission.score === null ? '미채점' : `${submission.score}점`}</p><Button className="mt-4" variant="outline" size="sm" onClick={() => setSelected(submission)}>{submission.status === 'pending' ? '검토하기' : '피드백 수정'}</Button></article>)}</div>
    </AnimatedList>
    <Modal open={selected !== null} onClose={() => setSelected(null)} title={`${selected ? studentName(selected) : ''} · 제출 검토`}>{selected && <><p className="app-item-title mb-5 text-sm [overflow-wrap:anywhere]">{taskTitle(selected)}</p><ReviewEditor key={selected.id} submission={selected} onSave={patch => { if (!review(selected.id, patch)) return false; setSelected(null); setMessage('점수와 피드백이 저장되었습니다.'); return true; }} /></>}</Modal>
  </Page>;
}
export function AdminUsersPage() {
  const { state, setRole, setTrack } = useLMS();
  const [params, setParams] = useSearchParams();
  const [message, setMessage] = useState('');
  const query = params.get('q') || '';
  const requestedTrack = params.get('track');
  const track = isTrack(requestedTrack) ? requestedTrack : 'all';
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(window.location.search);
    next.delete('status');
    if (!value || value === 'all') next.delete(key); else next.set(key, value);
    setParams(next, { replace: true });
  };
  const users = state.users.filter(user => (track === 'all' || user.track === track) && `${user.name} ${user.studentId} ${user.track}`.toLowerCase().includes(query.toLowerCase()));
  const roleSelector = (id: string, role: Role, name: string) => <select aria-label={`${name} 역할`} className="field w-28" value={role} disabled={id === currentUserId} onChange={event => { setMessage(setRole(id, event.target.value as Role) ? `${name}님의 역할이 ${roleLabels[event.target.value as Role]}(으)로 변경되었습니다.` : '역할을 저장하지 못했습니다. 다시 시도해 주세요.'); }}><option value="member">학습자</option><option value="staff">운영진</option></select>;
  const trackSelector = (id: string, value: Track, name: string) => <select aria-label={`${name} 배정 분야`} className="field w-28" value={value} onChange={event => { setMessage(setTrack(id, event.target.value as Track) ? `${name}님의 분야가 ${event.target.value}(으)로 배정되었습니다.` : '분야를 저장하지 못했습니다. 다시 시도해 주세요.'); }}>{tracks.map(option => <option key={option} value={option}>{option}</option>)}</select>;
  return <Page pageKey="admin-users">
    <PageHeader eyebrow="08.3 / MEMBERS" title="학생 관리" />
    <AdminNav />
    <div className="mb-5"><SearchInput value={query} onChange={value => update('q', value)} label="학생 검색" placeholder="이름, 학번 또는 분야 검색" /></div>
    <FilterBar label="학생 분야 필터" value={track} onChange={value => update('track', value)} options={[{ value: 'all', label: '전체' }, ...tracks.map(value => ({ value, label: value }))]} />
    {message && <FormMessage>{message}</FormMessage>}
    <AnimatedList listKey={`${query}-${track}`} itemSelector="[data-list-item]" empty={users.length === 0 && <EmptyState title="조건에 맞는 학생이 없습니다" action={<Button variant="outline" onClick={() => setParams({}, { replace: true })}>필터 초기화</Button>} />}>
    <div className="hidden md:block"><table className="data-table"><thead><tr><th>이름 / 학번</th><th>배정 분야</th><th>역할</th></tr></thead><tbody>{users.map(user => <tr key={user.id} data-list-item>
      <td><div className="flex items-center gap-3"><Avatar><AvatarFallback>{user.initials}</AvatarFallback></Avatar><div className="min-w-0"><p className="font-medium [overflow-wrap:anywhere]">{user.name} {user.id === currentUserId && <span className="app-meta ml-1 text-xs text-muted-foreground">나</span>}</p><p className="app-meta mt-1 font-mono text-xs text-muted-foreground">{user.studentId}</p></div></div></td>
      <td>{trackSelector(user.id, user.track, user.name)}</td><td>{roleSelector(user.id, user.role, user.name)}</td>
    </tr>)}</tbody></table></div>
    <div className="divide-y divide-border md:hidden">{users.map(user => <article key={user.id} data-list-item className="py-5"><div className="flex items-center gap-3"><Avatar><AvatarFallback>{user.initials}</AvatarFallback></Avatar><div className="min-w-0"><h2 className="app-item-title text-base [overflow-wrap:anywhere]">{user.name}</h2><p className="app-meta mt-2 font-mono text-xs text-muted-foreground">{user.studentId}</p></div></div><div className="mt-4 flex flex-wrap gap-4"><label className="app-meta text-xs text-muted-foreground">배정 분야<span className="mt-2 block">{trackSelector(user.id, user.track, user.name)}</span></label><label className="app-meta text-xs text-muted-foreground">역할<span className="mt-2 block">{roleSelector(user.id, user.role, user.name)}</span></label></div></article>)}</div>
    </AnimatedList>
    <p className="mt-5 text-xs leading-6 text-muted-foreground">분야는 운영진만 배정합니다. 분야 변경 후에도 기존 제출 기록은 보존됩니다.<br />현재 로그인한 계정의 역할은 이 화면에서 변경할 수 없습니다.</p>
  </Page>;
}
