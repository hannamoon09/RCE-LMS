import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { preferencesApi } from '@/api/preferences';
import type { Preferences } from '@/data/lmsData';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/shared/Primitives';
import { cn } from '@/lib/utils';

const options = [
  { key: 'assignment', label: '과제 알림', description: '새 과제 등록 및 마감 임박' },
  { key: 'notice', label: '공지 알림', description: '중요 공지와 활동 일정' },
  { key: 'feedback', label: '피드백 알림', description: '점수와 운영진 피드백 등록' },
  { key: 'email', label: '이메일 수신', description: '선택한 알림의 이메일 수신 동의' },
] as const;

export function NotificationSettings() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const loading = useRef<AbortController | null>(null);
  const saving = useRef<AbortController | null>(null);
  const reload = useCallback(() => {
    loading.current?.abort();
    const controller = new AbortController();
    loading.current = controller;
    setLoadError(''); setPreferences(null);
    void preferencesApi.get(controller.signal).then(value => {
      if (!controller.signal.aborted) setPreferences(value);
    }).catch(failure => {
      if (!controller.signal.aborted) setLoadError(failure instanceof Error ? failure.message : '알림 설정을 불러오지 못했습니다.');
    });
  }, []);
  useEffect(() => { reload(); return () => { loading.current?.abort(); saving.current?.abort(); }; }, [reload]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!preferences || saving.current) return;
    const controller = new AbortController();
    saving.current = controller; setBusy(true); setMessage(''); setError(false);
    try {
      const saved = await preferencesApi.save(preferences, controller.signal);
      if (!controller.signal.aborted) { setPreferences(saved); setMessage('알림 설정이 저장되었습니다.'); }
    } catch (failure) {
      if (!controller.signal.aborted) { setError(true); setMessage(failure instanceof Error ? failure.message : '알림 설정을 저장하지 못했습니다.'); }
    } finally {
      if (saving.current === controller) saving.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  return <section className="grid gap-6 py-12 md:grid-cols-[13rem_minmax(0,1fr)]">
    <div><h2 className="app-section-title text-base font-semibold">알림 설정</h2></div>
    <div>{loadError ? <><FormMessage error>{loadError}</FormMessage><Button variant="outline" onClick={reload}>알림 설정 다시 불러오기</Button></> : !preferences ? <p role="status" className="text-sm text-muted-foreground">알림 설정을 불러오는 중…</p> :
      <form onSubmit={save} aria-busy={busy}>
        <div className="divide-y divide-border-subtle">{options.map(item => <div key={item.key} className="flex items-center justify-between gap-5 py-4 first:pt-0">
          <div><p id={`label-${item.key}`} className="text-sm font-medium">{item.label}</p><p className="app-meta mt-2 text-xs text-muted-foreground">{item.description}</p></div>
          <button type="button" role="switch" disabled={busy} aria-checked={preferences[item.key]} aria-labelledby={`label-${item.key}`} onClick={() => { setPreferences({ ...preferences, [item.key]: !preferences[item.key] }); setMessage(''); }} className={cn('relative h-6 w-10 shrink-0 rounded-full border transition-colors disabled:opacity-60', preferences[item.key] ? 'border-accent bg-accent' : 'border-border bg-secondary')}><span className={cn('absolute top-0.5 h-4 w-4 rounded-full transition-transform', preferences[item.key] ? 'translate-x-0.5 bg-accent-foreground' : '-translate-x-3.5 bg-foreground')} /></button>
        </div>)}</div>
        <Button type="submit" disabled={busy} className="mt-5">{busy ? '저장 중…' : '알림 설정 저장'}</Button>
        <p className="mt-3 text-xs leading-6 text-muted-foreground">수신 설정은 계정에 저장됩니다. 알림 발송 기능은 아직 제공되지 않습니다.</p>
        {message && <FormMessage error={error}>{message}</FormMessage>}
      </form>}
    </div>
  </section>;
}
