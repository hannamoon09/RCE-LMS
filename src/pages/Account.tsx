import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useLMS } from '@/data/LMSContext';
import { useLearningData } from '@/data/useLearningData';
import { currentUserId, formatDate, roleLabels } from '@/data/lmsData';
import { calculateStudentRanking } from '@/data/ranking';
import { ProfileImageEditor } from '@/components/profile/ProfileImageEditor';
import { Button } from '@/components/ui/button';
import { ActivityLabel, EmptyState, FormMessage, Page, PageHeader, SectionHeading } from '@/components/shared/Primitives';
import { cn } from '@/lib/utils';
export function ProfilePage() {
  const { user, assignments, submissions, activities } = useLearningData();
  const { state } = useLMS();
  const { user: authenticatedUser } = useAuth();
  const ranking = useMemo(() => authenticatedUser ? calculateStudentRanking(state, authenticatedUser.id) : null, [state, authenticatedUser?.id]);
  const stats = [
    { label: '현재 순위', value: ranking?.rank ? `${ranking.rank}위` : '—', key: 'rank' },
    { label: '총점', value: ranking && ranking.reviewedCount > 0 ? ranking.totalScore.toLocaleString('ko-KR') : '—', key: 'total' },
    { label: '평균 점수', value: ranking?.averageScore === null || !ranking ? '—' : ranking.averageScore.toFixed(1), key: 'average' },
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
        <h2 className="mt-6 font-display text-2xl font-semibold tracking-tight">{user.name}</h2>
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
        </dl><p className="app-meta mt-4 text-muted-foreground">{ranking?.rank ? `${ranking.track} · 채점된 ${ranking.rankedCount}명 기준` : '미채점 · 검토 완료된 점수 기준'}</p></section>
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
  const { state, saveAccount, savePreferences } = useLMS(); const user = state.users.find(u => u.id === currentUserId)!;
  const [name, setName] = useState(user.name); const [email, setEmail] = useState(user.email); const [accountMessage, setAccountMessage] = useState('');
  const [currentPassword, setCurrentPassword] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [passwordMessage, setPasswordMessage] = useState(''); const [passwordError, setPasswordError] = useState(false);
  const [preferences, setPreferences] = useState(state.preferences); const [notificationMessage, setNotificationMessage] = useState('');
  return <Page pageKey="settings"><PageHeader eyebrow="07 / SETTINGS" title="설정" /><div className="max-w-4xl"><section className="grid gap-6 border-b border-border-subtle pb-12 md:grid-cols-[13rem_minmax(0,1fr)]"><div><h2 className="app-section-title text-base font-semibold">계정 정보</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">학번, 분야와 역할은 운영진이 관리합니다.</p></div><form onSubmit={e => { e.preventDefault(); if (!name.trim()) { setAccountMessage('이름을 입력해 주세요.'); return; } setAccountMessage(saveAccount(name.trim(), email.trim()) ? '계정 정보가 저장되었습니다.' : '계정 정보를 저장하지 못했습니다. 다시 시도해 주세요.'); }} className="space-y-5"><div><label htmlFor="account-name" className="field-label">이름</label><input id="account-name" className="field" autoComplete="name" required maxLength={40} value={name} onChange={e => { setName(e.target.value); setAccountMessage(''); }} /></div><div><label htmlFor="account-email" className="field-label">이메일</label><input id="account-email" type="email" className="field" autoComplete="email" required value={email} onChange={e => { setEmail(e.target.value); setAccountMessage(''); }} /></div><div><label htmlFor="account-id" className="field-label">학번</label><input id="account-id" className="field font-mono text-muted-foreground" value={user.studentId} readOnly /></div><div><label htmlFor="account-track" className="field-label">배정 분야</label><input id="account-track" className="field text-muted-foreground" value={user.track} readOnly /><p className="app-meta mt-2 text-xs text-muted-foreground">분야 변경은 운영진에게 문의하세요.</p></div><Button type="submit">계정 정보 저장</Button>{accountMessage && <FormMessage error={!name.trim()}>{accountMessage}</FormMessage>}</form></section>
    <section className="grid gap-6 border-b border-border-subtle py-12 md:grid-cols-[13rem_minmax(0,1fr)]"><div><h2 className="app-section-title text-base font-semibold">비밀번호 변경</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">데모에서는 입력값만 검증합니다. 실제 비밀번호는 변경되지 않습니다.</p></div><form className="space-y-5" onSubmit={e => { e.preventDefault(); setPasswordError(true); if (password.length < 8) { setPasswordMessage('새 비밀번호는 8자 이상 입력해 주세요.'); return; } if (password !== confirm) { setPasswordMessage('새 비밀번호가 일치하지 않습니다.'); return; } if (currentPassword === password) { setPasswordMessage('현재 비밀번호와 다른 비밀번호를 입력해 주세요.'); return; } setPasswordError(false); setPasswordMessage('입력값 검증이 완료되었습니다. 실제 변경은 서버 연결 후 사용할 수 있습니다.'); setCurrentPassword(''); setPassword(''); setConfirm(''); }}><div><label htmlFor="current-password" className="field-label">현재 비밀번호</label><input id="current-password" type="password" autoComplete="current-password" required className="field" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></div><div><label htmlFor="new-password" className="field-label">새 비밀번호</label><input id="new-password" type="password" autoComplete="new-password" required minLength={8} className="field" placeholder="8자 이상" value={password} onChange={e => setPassword(e.target.value)} /></div><div><label htmlFor="confirm-password" className="field-label">새 비밀번호 확인</label><input id="confirm-password" type="password" autoComplete="new-password" required className="field" value={confirm} onChange={e => setConfirm(e.target.value)} /></div><Button type="submit" variant="outline">비밀번호 변경 검증</Button>{passwordMessage && <FormMessage error={passwordError}>{passwordMessage}</FormMessage>}</form></section>
    <section className="grid gap-6 py-12 md:grid-cols-[13rem_minmax(0,1fr)]"><div><h2 className="app-section-title text-base font-semibold">알림 설정</h2></div><form onSubmit={e => { e.preventDefault(); setNotificationMessage(savePreferences(preferences) ? '알림 설정이 저장되었습니다.' : '알림 설정을 저장하지 못했습니다. 다시 시도해 주세요.'); }}><div className="divide-y divide-border-subtle">{([{ key: 'assignment', label: '과제 알림', description: '새 과제 등록 및 마감 임박' }, { key: 'notice', label: '공지 알림', description: '중요 공지와 활동 일정' }, { key: 'feedback', label: '피드백 알림', description: '점수와 운영진 피드백 등록' }, { key: 'email', label: '이메일 수신', description: '선택한 알림을 이메일로도 수신' }] as const).map(item => <div key={item.key} className="flex items-center justify-between gap-5 py-4 first:pt-0"><div><p id={`label-${item.key}`} className="text-sm font-medium">{item.label}</p><p className="app-meta mt-2 text-xs text-muted-foreground">{item.description}</p></div><button type="button" role="switch" aria-checked={preferences[item.key]} aria-labelledby={`label-${item.key}`} onClick={() => { setPreferences(p => ({ ...p, [item.key]: !p[item.key] })); setNotificationMessage(''); }} className={cn('relative h-6 w-10 shrink-0 rounded-full border transition-colors', preferences[item.key] ? 'border-accent bg-accent' : 'border-border bg-secondary')}><span className={cn('absolute top-0.5 h-4 w-4 rounded-full transition-transform', preferences[item.key] ? 'translate-x-0.5 bg-accent-foreground' : '-translate-x-3.5 bg-foreground')} /></button></div>)}</div><Button type="submit" className="mt-5">알림 설정 저장</Button><p className="mt-3 text-xs leading-6 text-muted-foreground">알림 수신은 서버 연결 후 제공됩니다. 선택한 설정은 이 브라우저에 저장됩니다.</p>{notificationMessage && <FormMessage>{notificationMessage}</FormMessage>}</form></section></div></Page>;
}
