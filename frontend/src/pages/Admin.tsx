import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useLMS } from '@/data/LMSContext';
import { formatDate, deadlineLabel, type LMSAssignment, type LMSUser, type Submission } from '@/data/lmsData';
import { useAuth } from '@/auth/AuthContext';
import type { ReviewInput } from '@/api/admin';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AnimatedList, EmptyState, FilterBar, FormMessage, Page, PageHeader, ReviewBadge, SearchInput, SectionHeading } from '@/components/shared/Primitives';
import { Modal } from '@/components/shared/Modal';
import { FileList } from '@/components/shared/FileList';
import { AssignmentEditor } from '@/components/admin/AssignmentEditor';
import { cn } from '@/lib/utils';
function AdminNav() { const { user } = useAuth(); return <><nav aria-label="운영진 메뉴" className="filter-bar mb-4">{[{ href: '/admin', label: '운영 개요' }, { href: '/admin/assignments', label: '과제 관리' }, { href: '/admin/submissions', label: '제출 검토' }, { href: '/admin/users', label: '학생 관리' }].map(item => <NavLink end key={item.href} to={item.href} className={({ isActive }) => cn('filter-button', isActive && 'is-selected')}>{item.label}</NavLink>)}</nav><p className="mb-7 app-meta text-xs text-muted-foreground">FIELD <span className="ml-3 text-foreground">{user?.track}</span></p></>; }
export function AdminPage() {
  const { state } = useLMS();
  const openAssignments = state.assignments.filter(assignment => new Date(assignment.deadline).getTime() > Date.now());
  const pending = state.submissions.filter(submission => submission.status === 'pending');
  const stats = [
    { label: '전체 학생', value: state.users.filter(user => user.role === 'member').length, href: '/admin/users' },
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
  const [removing, setRemoving] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const assignments = state.assignments.filter(a => a.title.toLowerCase().includes(query.toLowerCase()));
  const closeEditor = () => { saveRequest.current?.abort(); setEditor(null); if (params.has('create')) { const next = new URLSearchParams(params); next.delete('create'); setParams(next, { replace: true }); } };
  const actions = (a: LMSAssignment) => <div className="flex shrink-0 items-center gap-1"><Button variant="ghost" size="icon" aria-label={`${a.title} 수정`} onClick={() => setEditor(a)}><Pencil size={15} /></Button><Button variant="ghost" size="icon" aria-label={`${a.title} 삭제`} onClick={() => { setDeleteError(''); setDeleting(a); }}><Trash2 size={15} className="text-muted-foreground" /></Button></div>;
  const removeAssignment = async () => {
    if (!deleting || removing) return;
    setRemoving(true); setDeleteError('');
    try {
      if (!await deleteAssignment(deleting.id)) throw new Error('과제를 삭제하지 못했습니다. 다시 시도해 주세요.');
      setMessage('과제가 삭제되었습니다.'); setDeleting(null);
    } catch (failure) {
      setDeleteError(failure instanceof Error ? failure.message : '과제를 삭제하지 못했습니다. 다시 시도해 주세요.');
    } finally { setRemoving(false); }
  };
  const count = (a: LMSAssignment) => new Set(state.submissions.filter(s => s.assignmentId === a.id).map(s => s.userId)).size;
  return <Page pageKey="admin-assignments"><PageHeader eyebrow="08.1 / ASSIGNMENTS" title="과제 관리" action={<Button onClick={() => setEditor('new')}><Plus size={16} />과제 생성</Button>} /><AdminNav /><SearchInput value={query} onChange={setQuery} label="운영진 과제 검색" placeholder="과제명 검색" />{message && <FormMessage>{message}</FormMessage>}<AnimatedList listKey={query} itemSelector="[data-list-item]" empty={assignments.length === 0 && <EmptyState title={state.assignments.length ? "표시할 과제가 없습니다" : "등록된 과제가 없습니다"} description={state.assignments.length ? "검색어를 변경해 보세요." : "과제 생성 버튼으로 첫 과제를 등록해 주세요."} action={state.assignments.length > 0 && <Button variant="outline" onClick={() => { setQuery(''); setParams({}, { replace: true }); }}>검색 초기화</Button>} />}><div className="mt-5 hidden md:block"><table className="data-table"><thead><tr><th>과제</th><th>마감</th><th>제출 현황</th><th>관리</th></tr></thead><tbody>{assignments.map(a => <tr key={a.id} data-list-item><td><button type="button" className="app-item-title text-left [overflow-wrap:anywhere] hover:text-accent" onClick={() => setEditor(a)}>{a.title}</button><p className="app-meta mt-2 text-xs text-muted-foreground">첨부 {a.attachments.length}개 · {a.author}</p></td><td><p className="font-medium tabular-nums">{deadlineLabel(a.deadline)}</p><p className="app-meta mt-2 text-xs text-muted-foreground">{formatDate(a.deadline, true)}</p></td><td><Link className="inline-flex items-center gap-2 hover:text-accent" to={`/admin/submissions?assignment=${a.id}`}><span className="tabular-nums">{count(a)}명 제출</span><ArrowUpRight size={14} /></Link></td><td>{actions(a)}</td></tr>)}</tbody></table></div><div className="mt-5 divide-y divide-border md:hidden">{assignments.map(a => <article key={a.id} data-list-item className="py-5"><div className="flex items-start justify-between gap-3"><button type="button" className="min-w-0 flex-1 pt-2 app-item-title text-left text-base [overflow-wrap:anywhere]" onClick={() => setEditor(a)}>{a.title}</button>{actions(a)}</div><p className="app-meta mt-2 text-xs text-muted-foreground">첨부 {a.attachments.length}개 · {a.author}</p><div className="mt-4 flex justify-between gap-3 text-sm"><span>{deadlineLabel(a.deadline)} · {formatDate(a.deadline)}</span><Link className="text-accent" to={`/admin/submissions?assignment=${a.id}`}>{count(a)}명 제출</Link></div></article>)}</div></AnimatedList><Modal open={editor !== null} onClose={closeEditor} title={editor === 'new' ? '새 과제 생성' : '과제 수정'}>{editor && <AssignmentEditor saveRequest={saveRequest} key={editor === 'new' ? 'new' : editor.id} assignment={editor === 'new' ? undefined : editor} onCancel={closeEditor} onSave={async (a, files, signal) => { if (!await saveAssignment(a, files, editor === 'new' ? undefined : editor.id, signal)) return false; saveRequest.current = null; setMessage(editor === 'new' ? '새 과제가 생성되었습니다.' : '과제가 수정되었습니다.'); closeEditor(); return true; }} />}</Modal><Modal open={deleting !== null} onClose={() => { if (!removing) setDeleting(null); }} title="과제를 삭제할까요?"><p className="text-sm leading-7 text-muted-foreground">{deleting?.title}<br />제출물이 있는 과제는 삭제할 수 없습니다. 삭제한 과제는 복구할 수 없습니다.</p>{deleteError && <FormMessage error>{deleteError}</FormMessage>}<div className="mt-7 flex justify-end gap-3"><Button variant="outline" disabled={removing} onClick={() => setDeleting(null)}>취소</Button><Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={removing} onClick={() => void removeAssignment()}>{removing ? '삭제 중' : '삭제'}</Button></div></Modal></Page>;
}
function ReviewEditor({ submission, onSave }: { submission: Submission; onSave: (patch: ReviewInput, signal: AbortSignal) => Promise<boolean> }) {
  const [score, setScore] = useState(submission.score?.toString() || '');
  const [feedback, setFeedback] = useState(submission.feedback);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => { pending.current?.abort(); }, []);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (pending.current) return;
    if (score === '' || !Number.isInteger(Number(score)) || Number(score) < 0 || Number(score) > 100) { setError('점수는 0부터 100까지의 정수로 입력해 주세요.'); return; }
    const controller = new AbortController(); pending.current = controller;
    setSaving(true); setError('');
    try {
      if (!await onSave({ score: Number(score), feedback: feedback.trim() }, controller.signal) && !controller.signal.aborted) throw new Error('검토를 저장하지 못했습니다. 다시 시도해 주세요.');
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '검토를 저장하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      if (pending.current === controller) pending.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  };
  return <form onSubmit={save} aria-busy={saving}>
    <div className="mb-6 border-b border-border pb-6"><p className="app-meta mb-3 text-xs text-muted-foreground">학생 메모 및 질문 · {formatDate(submission.submittedAt, true)}</p><p className="whitespace-pre-wrap break-words text-sm leading-7">{submission.text || '작성한 메모가 없습니다.'}</p><div className="mt-5"><FileList files={submission.files} emptyLabel="첨부 파일 없음" /></div></div>
    <div><label htmlFor="review-score" className="field-label">점수 / 100</label><input id="review-score" type="number" min={0} max={100} step={1} required disabled={saving} value={score} onChange={event => setScore(event.target.value)} className="field" /></div>
    <div className="mt-5"><label htmlFor="review-feedback" className="field-label">피드백</label><textarea id="review-feedback" rows={5} maxLength={20000} disabled={saving} className="field" value={feedback} onChange={event => setFeedback(event.target.value)} /></div>
    <p className="app-meta mt-3 text-xs text-muted-foreground">피드백은 선택 사항입니다. 저장하면 검토 완료 상태로 변경됩니다.</p>
    {error && <FormMessage error>{error}</FormMessage>}
    <div className="mt-6 flex justify-end"><Button type="submit" disabled={saving}>{saving ? '저장 중' : '검토 저장'}</Button></div>
  </form>;
}
export function AdminSubmissionsPage() {
  const { state, review } = useLMS();
  const [params, setParams] = useSearchParams();
  const [message, setMessage] = useState('');
  const query = params.get('q') || '';
  const requestedStatus = params.get('status');
  const status = requestedStatus === 'pending' || requestedStatus === 'reviewed' ? requestedStatus : 'all';
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
      && `${student?.name || ''} ${task?.title || ''}`.toLowerCase().includes(query.toLowerCase());
  }).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const taskTitle = (submission: Submission) => state.assignments.find(task => task.id === submission.assignmentId)?.title || '삭제된 과제';
  const studentName = (submission: Submission) => state.users.find(user => user.id === submission.userId)?.name || '알 수 없는 학생';
  const studentTrack = (submission: Submission) => state.users.find(user => user.id === submission.userId)?.track;
  return <Page pageKey="admin-submissions">
    <PageHeader eyebrow="08.2 / REVIEWS" title="제출 검토" />
    <AdminNav />
    <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_16rem]">
      <SearchInput value={query} onChange={value => updateParam('q', value)} label="제출물 검색" placeholder="제출자 또는 과제 검색" />
      <select aria-label="과제별 제출물" className="field min-w-0 max-w-full" value={assignment} onChange={event => updateParam('assignment', event.target.value)}><option value="all">모든 과제</option>{state.assignments.map(task => <option value={task.id} key={task.id}>{task.title}</option>)}</select>
    </div>
    <FilterBar value={status} onChange={value => updateParam('status', value)} options={[{ value: 'all', label: '전체' }, { value: 'pending', label: '검토 대기' }, { value: 'reviewed', label: '검토 완료' }]} />
    {message && <FormMessage>{message}</FormMessage>}
    <AnimatedList listKey={`${query}-${status}-${assignment}`} itemSelector="[data-list-item]" empty={submissions.length === 0 && <EmptyState title="조건에 맞는 제출물이 없습니다" action={<Button variant="outline" onClick={() => setParams({}, { replace: true })}>필터 초기화</Button>} />}>
      <div className="hidden md:block"><table className="data-table"><thead><tr><th>제출자 / 과제</th><th>제출 시간</th><th>상태</th><th>점수</th><th>피드백</th></tr></thead><tbody>{submissions.map(submission => <tr key={submission.id} data-list-item>
        <td><p className="font-medium [overflow-wrap:anywhere]">{studentName(submission)}</p><p className="app-meta mt-1 text-xs text-muted-foreground">{studentTrack(submission)}</p><p className="app-meta mt-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">{taskTitle(submission)}</p></td>
        <td className="app-meta text-xs">{formatDate(submission.submittedAt, true)}</td><td><ReviewBadge status={submission.status} /></td><td className="font-medium tabular-nums">{submission.score ?? '—'}</td>
        <td><Button variant="outline" size="sm" onClick={() => setSelected(submission)}>{submission.status === 'pending' ? '검토하기' : '피드백 수정'}</Button></td>
      </tr>)}</tbody></table></div>
      <div className="divide-y divide-border md:hidden">{submissions.map(submission => <article key={submission.id} data-list-item className="py-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium [overflow-wrap:anywhere]">{studentName(submission)}</p><p className="app-meta mt-1 text-xs text-muted-foreground">{studentTrack(submission)}</p></div><ReviewBadge status={submission.status} /></div><h2 className="app-item-title mt-3 text-base [overflow-wrap:anywhere]">{taskTitle(submission)}</h2><p className="app-meta mt-2 text-xs text-muted-foreground">{formatDate(submission.submittedAt, true)} · {submission.score === null ? '미채점' : `${submission.score}점`}</p><Button className="mt-4" variant="outline" size="sm" onClick={() => setSelected(submission)}>{submission.status === 'pending' ? '검토하기' : '피드백 수정'}</Button></article>)}</div>
    </AnimatedList>
    <Modal open={selected !== null} onClose={() => setSelected(null)} title={`${selected ? studentName(selected) : ''} · 제출 검토`}>{selected && <><p className="app-item-title mb-5 text-sm [overflow-wrap:anywhere]">{taskTitle(selected)}</p><ReviewEditor key={selected.id} submission={selected} onSave={async (patch, signal) => { if (!await review(selected.id, patch, signal)) return false; setSelected(null); setMessage('점수와 피드백이 저장되었습니다.'); return true; }} /></>}</Modal>
  </Page>;
}
export function AdminUsersPage() {
  const { state } = useLMS();
  const [params, setParams] = useSearchParams();
  const [message, setMessage] = useState('');
  const [editor, setEditor] = useState<LMSUser | 'new' | null>(null);
  const query = params.get('q') || '';
  const updateQuery = (value: string) => {
    const next = new URLSearchParams(window.location.search);
    next.delete('track'); next.delete('status');
    if (!value) next.delete('q'); else next.set('q', value);
    setParams(next, { replace: true });
  };
  const users = state.users.filter(user => user.role === 'member' && `${user.name} ${user.studentId}`.toLowerCase().includes(query.toLowerCase()));
  const editButton = (user: LMSUser) => <Button variant="outline" size="sm" aria-label={`${user.name} 수정`} onClick={() => setEditor(user)}>관리</Button>;
  return <Page pageKey="admin-users">
    <PageHeader eyebrow="08.3 / MEMBERS" title="학생 관리" action={<Button onClick={() => setEditor('new')}><Plus size={16} />학생 추가</Button>} />
    <AdminNav />
    <div className="mb-5"><SearchInput value={query} onChange={updateQuery} label="학생 검색" placeholder="이름 또는 학번 검색" /></div>
    {message && <FormMessage>{message}</FormMessage>}
    <AnimatedList listKey={query} itemSelector="[data-list-item]" empty={users.length === 0 && <EmptyState title="조건에 맞는 학생이 없습니다" action={<Button variant="outline" onClick={() => setParams({}, { replace: true })}>검색 초기화</Button>} />}>
      <div className="hidden md:block"><table className="data-table"><thead><tr><th>이름 / 학번</th><th>배정 분야</th><th>상태</th><th>관리</th></tr></thead><tbody>{users.map(user => <tr key={user.id} data-list-item>
        <td><div className="flex items-center gap-3"><Avatar><AvatarFallback>{user.initials}</AvatarFallback></Avatar><div className="min-w-0"><p className="font-medium [overflow-wrap:anywhere]">{user.name}</p><p className="app-meta mt-1 font-mono text-xs text-muted-foreground">{user.studentId}</p></div></div></td>
        <td className="text-muted-foreground">{user.track}</td><td className="text-muted-foreground">{user.active ? '활성' : '비활성'}</td><td>{editButton(user)}</td>
      </tr>)}</tbody></table></div>
      <div className="divide-y divide-border md:hidden">{users.map(user => <article key={user.id} data-list-item className="py-5"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><Avatar><AvatarFallback>{user.initials}</AvatarFallback></Avatar><div className="min-w-0"><h2 className="app-item-title text-base [overflow-wrap:anywhere]">{user.name}</h2><p className="app-meta mt-2 font-mono text-xs text-muted-foreground">{user.studentId}</p></div></div>{editButton(user)}</div><p className="app-meta mt-4 text-xs text-muted-foreground">{user.track} · {user.active ? '활성' : '비활성'}</p></article>)}</div>
    </AnimatedList>
    <p className="mt-5 text-xs leading-6 text-muted-foreground">현재 분야의 학습자 계정을 관리합니다. 계정을 비활성화하면 로그인이 제한됩니다.</p>
    <Modal open={editor !== null} onClose={() => setEditor(null)} title={editor === 'new' ? '학생 계정 추가' : '학생 계정 수정'}>{editor && <MemberEditor key={editor === 'new' ? 'new' : editor.id} user={editor === 'new' ? undefined : editor} onCancel={() => setEditor(null)} onSaved={() => { setMessage(editor === 'new' ? '학생 계정이 생성되었습니다.' : '학생 계정이 수정되었습니다.'); setEditor(null); }} />}</Modal>
  </Page>;
}

function MemberEditor({ user, onCancel, onSaved }: { user?: LMSUser; onCancel: () => void; onSaved: () => void }) {
  const { createMember, updateMember } = useLMS();
  const [name, setName] = useState(user?.name || '');
  const [studentId, setStudentId] = useState(user?.studentId || '');
  const [password, setPassword] = useState('');
  const [active, setActive] = useState(user?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => { pending.current?.abort(); }, []);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (pending.current) return;
    if (!name.trim()) { setError('이름을 입력해 주세요.'); return; }
    if (!user && !/^[0-9]{4,32}$/.test(studentId)) { setError('학번은 4자 이상 32자 이하의 숫자로 입력해 주세요.'); return; }
    if ((!user || password) && (Array.from(password).length < 8 || new TextEncoder().encode(password).length > 72 || !password.trim())) { setError('비밀번호는 8자 이상, UTF-8 기준 72바이트 이하로 입력해 주세요.'); return; }
    const controller = new AbortController(); pending.current = controller;
    setSaving(true); setError('');
    try {
      const saved = user
        ? await updateMember(user.id, { name: name.trim(), active, ...(password ? { newPassword: password } : {}) }, controller.signal)
        : await createMember({ name: name.trim(), studentId, initialPassword: password }, controller.signal);
      if (!saved && !controller.signal.aborted) throw new Error('학생 계정을 저장하지 못했습니다. 다시 시도해 주세요.');
      if (!controller.signal.aborted) { pending.current = null; onSaved(); }
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '학생 계정을 저장하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      if (pending.current === controller) pending.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  };
  return <form onSubmit={save} className="space-y-5" aria-busy={saving}>
    <div><label htmlFor="member-name" className="field-label">이름</label><input id="member-name" autoFocus className="field" required maxLength={100} disabled={saving} value={name} onChange={event => setName(event.target.value)} /></div>
    <div><label htmlFor="member-student-id" className="field-label">학번</label><input id="member-student-id" className="field font-mono" inputMode="numeric" required maxLength={32} readOnly={Boolean(user)} disabled={saving} value={studentId} onChange={event => setStudentId(event.target.value)} /></div>
    <div><label htmlFor="member-password" className="field-label">{user ? '새 비밀번호 (선택)' : '초기 비밀번호'}</label><input id="member-password" type="password" className="field" autoComplete="new-password" required={!user} minLength={8} disabled={saving} value={password} onChange={event => setPassword(event.target.value)} /><p className="app-meta mt-2 text-xs text-muted-foreground">{user ? '변경할 때만 입력하세요. ' : ''}8자 이상 입력해 주세요.</p></div>
    {user && <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-accent" checked={active} disabled={saving} onChange={event => setActive(event.target.checked)} />활성 계정</label>}
    {error && <FormMessage error>{error}</FormMessage>}
    <div className="flex justify-end gap-3 border-t border-border pt-5"><Button type="button" variant="outline" onClick={onCancel}>취소</Button><Button type="submit" disabled={saving}>{saving ? '저장 중' : user ? '변경 사항 저장' : '계정 생성'}</Button></div>
  </form>;
}
