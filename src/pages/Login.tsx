import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, LoaderCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { demoCredentials } from '@/auth/mockAuth';
import { safeAuthDestination } from '@/auth/ProtectedRoute';
import { BrandMark } from '@/components/dashboard/BrandMark';
import { Button } from '@/components/ui/button';
import { useChangeFade } from '@/motion/hooks';

export function LoginPage() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const location = useLocation();
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<{ studentId?: string; password?: string }>({});
  const formRoot = useRef<HTMLDivElement>(null);
  const errorRoot = useRef<HTMLDivElement>(null);
  const studentInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const pending = useRef<AbortController | null>(null);
  useChangeFade(formRoot, 'login');
  useChangeFade(errorRoot, `${error}-${fields.studentId || ''}-${fields.password || ''}`);
  useEffect(() => { document.title = '로그인 · RCE LMS'; return () => { pending.current?.abort(); }; }, []);

  const destination = safeAuthDestination((location.state as { from?: unknown } | null)?.from);
  if (isAuthenticated) return <Navigate to={destination} replace />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading || pending.current) return;
    const invalid = {
      studentId: studentId.trim() ? undefined : '학번을 입력해 주세요.',
      password: password ? undefined : '비밀번호를 입력해 주세요.',
    };
    setFields(invalid);
    setError('');
    if (invalid.studentId || invalid.password) {
      (invalid.studentId ? studentInput : passwordInput).current?.focus();
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    try {
      await login({ studentId: studentId.trim(), password }, { signal: controller.signal });
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '로그인하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  };

  return <section className="mx-auto grid min-h-[calc(100svh-9rem)] w-full max-w-6xl items-center gap-12 px-5 py-10 sm:px-8 sm:py-16 lg:min-h-[calc(100dvh-12rem)] lg:grid-cols-[1.1fr_1fr] lg:gap-20">
    <div className="hidden max-w-lg lg:block">
      <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={15} />RCE 소개로 돌아가기</Link>
      <BrandMark className="mb-9" />
      <p className="mb-4 font-mono text-xs tracking-[0.2em] text-accent">MEMBER ACCESS</p>
      <h2 className="app-title">오늘의 실습을<br />이어가세요.</h2>
      <p className="mt-5 max-w-sm text-sm leading-7 text-muted-foreground">과제를 확인하고, 분석 과정을 기록하고, 피드백으로 다음 단계를 준비하세요. RCE의 학습 공간에서 다시 만나요.</p>
      <div className="mt-8 flex items-start gap-3 border-t border-border pt-6 text-xs leading-6 text-muted-foreground"><ShieldCheck size={17} className="mt-1 shrink-0 text-accent" /><p>RCE 구성원을 위한 학습 공간입니다.<br />현재는 아래 데모 계정으로 둘러볼 수 있습니다.</p></div>
    </div>
    <div ref={formRoot} className="mx-auto w-full max-w-md lg:border-l lg:border-border lg:pl-12">
      <p className="mb-3 font-mono text-xs tracking-widest text-muted-foreground">RCE LMS</p>
      <h1 tabIndex={-1} className="app-title">로그인</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">학번과 비밀번호를 입력해 주세요.</p>
      <form onSubmit={submit} noValidate aria-busy={isLoading} className="mt-8 space-y-5">
        <div><label htmlFor="login-student-id" className="field-label">학번</label><input ref={studentInput} id="login-student-id" name="username" autoComplete="username" inputMode="numeric" className="field" placeholder="학번을 입력하세요" maxLength={20} required disabled={isLoading} value={studentId} aria-invalid={Boolean(fields.studentId)} aria-describedby={fields.studentId ? 'login-student-error' : undefined} onChange={event => { setStudentId(event.target.value); setFields(value => ({ ...value, studentId: undefined })); setError(''); }} />{fields.studentId && <p id="login-student-error" className="mt-2 text-xs text-destructive">{fields.studentId}</p>}</div>
        <div><label htmlFor="login-password" className="field-label">비밀번호</label><div className="relative"><input ref={passwordInput} id="login-password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" className="field pr-12" placeholder="비밀번호를 입력하세요" required disabled={isLoading} value={password} aria-invalid={Boolean(fields.password)} aria-describedby={fields.password ? 'login-password-error' : undefined} onChange={event => { setPassword(event.target.value); setFields(value => ({ ...value, password: undefined })); setError(''); }} /><button type="button" aria-label={visible ? '비밀번호 숨기기' : '비밀번호 표시'} aria-pressed={visible} disabled={isLoading} onClick={() => setVisible(value => !value)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground">{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{fields.password && <p id="login-password-error" className="mt-2 text-xs text-destructive">{fields.password}</p>}</div>
        <div ref={errorRoot}>{error && <p id="login-error" role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm leading-6 text-destructive">{error}</p>}</div>
        <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? <><LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" />로그인 확인 중</> : <>로그인<ArrowRight size={16} /></>}</Button>
        <p className="text-center text-xs leading-6 text-muted-foreground">계정 관련 문의는 RCE 운영진에게 전달해 주세요.</p>
      </form>
      <div className="mt-8 border-t border-border pt-6"><div className="flex items-center justify-between gap-3"><p className="text-xs font-medium text-foreground">데모 계정</p><Button size="sm" variant="ghost" disabled={isLoading} onClick={() => { setStudentId(demoCredentials.studentId); setPassword(demoCredentials.password); setFields({}); setError(''); passwordInput.current?.focus(); }}>데모 계정 입력</Button></div><dl className="mt-3 grid grid-cols-[4rem_1fr] gap-y-2 text-xs"><dt className="text-muted-foreground">학번</dt><dd className="font-mono">{demoCredentials.studentId}</dd><dt className="text-muted-foreground">비밀번호</dt><dd className="font-mono">{demoCredentials.password}</dd></dl><p className="mt-4 text-xs leading-6 text-muted-foreground">실제 계정 인증 없이 동작하는 데모입니다. 로그인 상태는 현재 브라우저 탭에서 유지됩니다.</p></div>
    </div>
  </section>;
}
