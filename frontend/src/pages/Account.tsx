import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useLMS } from '@/data/LMSContext';
import { useLearningData } from '@/data/useLearningData';
import { formatDate, roleLabels } from '@/data/lmsData';
import { ProfileImageEditor } from '@/components/profile/ProfileImageEditor';
import { NotificationSettings } from '@/components/profile/NotificationSettings';
import { Button } from '@/components/ui/button';
import { ActivityLabel, EmptyState, FormMessage, Page, PageHeader, SectionHeading } from '@/components/shared/Primitives';
import { cn } from '@/lib/utils';
export function ProfilePage() {
  const { user, assignments, submissions, activities } = useLearningData();
  const { rankings } = useLMS();
  const ranking = rankings.find(entry => entry.isMe);
  const stats = [
    { label: '현재 순위', value: ranking?.rank ? `${ranking.rank}위` : '—', key: 'rank' },
    { label: '총점', value: ranking ? ranking.totalScore.toLocaleString('ko-KR') : '—', key: 'total' },
    { label: '평균 점수', value: ranking ? ranking.averageScore.toFixed(1) : '—', key: 'average' },
    { label: '채점 완료', value: ranking?.reviewedCount ?? 0, key: 'reviewed' },
    { label: '제출한 과제', value: assignments.filter(assignment => assignment.status === 'submitted').length, key: 'submitted' },
    { label: '검토 대기', value: submissions.filter(submission => submission.status === 'pending').length, key: 'pending' },
  ];
  const joined = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(user.joinedAt));
  return <Page pageKey="profile">
    <PageHeader eyebrow="06 / PROFILE" title="내 프로필" action={<Button asChild variant="outline"><Link to="/settings">계정 설정</Link></Button>} />
    <div className="grid items-start gap-14 xl:grid-cols-[18rem_minmax(0,1fr)] xl:gap-16">
      <section>
        <ProfileImageEditor user={user} />
        <h2 className="mt-6 font-display text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]">{user.name}</h2>
        <p className="app-meta mt-2 text-muted-foreground">{roleLabels[user.role]}</p>
        <dl className="mt-8 divide-y divide-border-subtle border-t border-border-subtle text-sm">
          <div className="py-4"><dt className="app-meta mb-2 text-xs text-muted-foreground">배정 분야</dt><dd className="font-medium">{user.track}</dd></div>
          <div className="py-4"><dt className="app-meta mb-2 text-xs text-muted-foreground">학번</dt><dd className="font-mono">{user.studentId}</dd></div>
          <div className="py-4"><dt className="app-meta mb-2 text-xs text-muted-foreground">이메일</dt><dd className="break-all">{user.email}</dd></div>
          <div className="py-4"><dt className="app-meta mb-2 text-xs text-muted-foreground">가입 날짜</dt><dd className="tabular-nums"><time dateTime={user.joinedAt}>{joined}</time></dd></div>
        </dl>
      </section>
      <div>
        <section data-ranking-profile><SectionHeading title="내 제출 통계" href="/rankings" /><dl className="grid grid-cols-2 gap-x-6 gap-y-8 py-3 sm:grid-cols-3">
          {stats.map(stat => <div key={stat.key}><dt className="app-meta text-xs text-muted-foreground">{stat.label}</dt><dd className={cn('app-number mt-3 text-3xl', stat.key === 'rank' && 'platinum-number')} data-ranking-stat={stat.key}>{stat.value}</dd></div>)}
        </dl><p className="app-meta mt-4 text-muted-foreground">{ranking ? `${user.track} · 활성 학생 ${rankings.length}명 기준` : '운영진 계정은 학생 순위에서 제외됩니다.'}</p></section>
        <section className="mt-14"><SectionHeading title="최근 활동" /><ul className="divide-y divide-border-subtle">
          {activities.slice(0, 10).map(activity => {
            const title = assignments.find(assignment => assignment.id === activity.assignmentId)?.title ?? '과제';
            return <li key={activity.id}><Link to={`/assignments/${activity.assignmentId}`} className="feed-row -mx-3 py-4"><div className="min-w-0 flex-1"><p className="app-item-title break-words">{title}</p><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1"><ActivityLabel kind={activity.kind} /><time dateTime={activity.at} className="app-meta text-xs text-muted-foreground">{formatDate(activity.at, true)}</time></div></div></Link></li>;
          })}
        </ul>{activities.length === 0 && <EmptyState title="아직 활동 기록이 없습니다" />}</section>
      </div>
    </div>
  </Page>;
}
export function SettingsPage() {
  const { saveAccount, changePassword } = useLMS();
  const { user: authenticatedUser } = useAuth();
  const user = authenticatedUser!;
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [accountMessage, setAccountMessage] = useState('');
  const [accountError, setAccountError] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const accountRequest = useRef<AbortController | null>(null);
  const passwordRequest = useRef<AbortController | null>(null);
  useEffect(() => () => { accountRequest.current?.abort(); passwordRequest.current?.abort(); }, []);

  const updateAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (accountRequest.current) return;
    setAccountMessage(''); setAccountError(false);
    if (!name.trim()) { setAccountError(true); setAccountMessage('이름을 입력해 주세요.'); return; }
    const controller = new AbortController();
    accountRequest.current = controller; setAccountBusy(true);
    try {
      if (await saveAccount(name.trim(), email.trim(), controller.signal)) {
        setName(name.trim()); setEmail(email.trim()); setAccountMessage('계정 정보가 저장되었습니다.');
      }
    } catch (error) {
      if (!controller.signal.aborted) { setAccountError(true); setAccountMessage(error instanceof Error ? error.message : '계정 정보를 저장하지 못했습니다.'); }
    } finally {
      if (accountRequest.current === controller) accountRequest.current = null;
      if (!controller.signal.aborted) setAccountBusy(false);
    }
  };
  const updatePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (passwordRequest.current) return;
    setPasswordMessage('');
    if (password.length < 8 || new TextEncoder().encode(password).length > 72) { setPasswordMessage('새 비밀번호는 8자 이상, UTF-8 기준 72바이트 이하로 입력해 주세요.'); return; }
    if (password !== confirm) { setPasswordMessage('새 비밀번호가 일치하지 않습니다.'); return; }
    if (currentPassword === password) { setPasswordMessage('현재 비밀번호와 다른 비밀번호를 입력해 주세요.'); return; }
    const controller = new AbortController();
    passwordRequest.current = controller; setPasswordBusy(true);
    try {
      await changePassword(currentPassword, password, controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) setPasswordMessage(error instanceof Error ? error.message : '비밀번호를 변경하지 못했습니다.');
    } finally {
      if (passwordRequest.current === controller) passwordRequest.current = null;
      if (!controller.signal.aborted) setPasswordBusy(false);
    }
  };
  return <Page pageKey="settings"><PageHeader eyebrow="07 / SETTINGS" title="설정" /><div className="max-w-4xl">
    <section className="grid gap-6 border-b border-border-subtle pb-12 md:grid-cols-[13rem_minmax(0,1fr)]">
      <div><h2 className="app-section-title text-base font-semibold">계정 정보</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">학번, 분야와 역할은 운영진이 관리합니다.</p></div>
      <form onSubmit={updateAccount} aria-busy={accountBusy} className="space-y-5">
        <div><label htmlFor="account-name" className="field-label">이름</label><input id="account-name" className="field" autoComplete="name" required maxLength={100} disabled={accountBusy} value={name} onChange={e => { setName(e.target.value); setAccountMessage(''); }} /></div>
        <div><label htmlFor="account-email" className="field-label">이메일</label><input id="account-email" type="email" className="field" autoComplete="email" maxLength={254} disabled={accountBusy} value={email} onChange={e => { setEmail(e.target.value); setAccountMessage(''); }} /></div>
        <div><label htmlFor="account-id" className="field-label">학번</label><input id="account-id" className="field font-mono text-muted-foreground" value={user.studentId} readOnly /></div>
        <div><label htmlFor="account-track" className="field-label">배정 분야</label><input id="account-track" className="field text-muted-foreground" value={user.track} readOnly /><p className="app-meta mt-2 text-xs text-muted-foreground">분야 변경은 운영진에게 문의하세요.</p></div>
        <Button type="submit" disabled={accountBusy}>{accountBusy ? '저장 중…' : '계정 정보 저장'}</Button>{accountMessage && <FormMessage error={accountError}>{accountMessage}</FormMessage>}
      </form>
    </section>
    <section className="grid gap-6 border-b border-border-subtle py-12 md:grid-cols-[13rem_minmax(0,1fr)]">
      <div><h2 className="app-section-title text-base font-semibold">비밀번호 변경</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">변경 후 모든 기기에서 로그아웃됩니다. 새 비밀번호로 다시 로그인해 주세요.</p></div>
      <form className="space-y-5" onSubmit={updatePassword} aria-busy={passwordBusy}>
        <div><label htmlFor="current-password" className="field-label">현재 비밀번호</label><input id="current-password" type="password" autoComplete="current-password" required maxLength={128} disabled={passwordBusy} className="field" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></div>
        <div><label htmlFor="new-password" className="field-label">새 비밀번호</label><input id="new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} disabled={passwordBusy} className="field" placeholder="8자 이상" value={password} onChange={e => setPassword(e.target.value)} /></div>
        <div><label htmlFor="confirm-password" className="field-label">새 비밀번호 확인</label><input id="confirm-password" type="password" autoComplete="new-password" required maxLength={128} disabled={passwordBusy} className="field" value={confirm} onChange={e => setConfirm(e.target.value)} /></div>
        <Button type="submit" variant="outline" disabled={passwordBusy}>{passwordBusy ? '변경 중…' : '비밀번호 변경'}</Button>{passwordMessage && <FormMessage error>{passwordMessage}</FormMessage>}
      </form>
    </section>
    <NotificationSettings key={user.id} /></div></Page>;
}
