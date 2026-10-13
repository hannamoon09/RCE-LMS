import { useId, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { Camera, RotateCcw, Trash2 } from 'lucide-react';
import type { LMSUser } from '@/data/lmsData';
import { useLMS } from '@/data/LMSContext';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/shared/Modal';
import { FormMessage } from '@/components/shared/Primitives';
import { UserAvatar } from './UserAvatar';

type Draft = { image: HTMLImageElement; url: string; width: number; height: number };
type Crop = { zoom: number; x: number; y: number };
const centered: Crop = { zoom: 1, x: 0, y: 0 };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];

function cropRect(draft: Draft, crop: Crop) {
  const side = Math.min(draft.width, draft.height) / crop.zoom;
  const rangeX = (draft.width - side) / 2;
  const rangeY = (draft.height - side) / 2;
  return { side, rangeX, rangeY, x: rangeX * (1 + crop.x), y: rangeY * (1 + crop.y) };
}

export function ProfileImageEditor({ user }: { user: LMSUser }) {
  const { setProfileImage } = useLMS();
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const draftRef = useRef<Draft | null>(null);
  const [crop, setCrop] = useState<Crop>(centered);
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const mounted = useRef(true);
  const generation = useRef(0);
  const cancelDecode = useRef<(() => void) | null>(null);
  const pending = useRef<AbortController | null>(null);
  const userRef = useRef(user);
  userRef.current = user;
  const drag = useRef<{ pointerId: number; clientX: number; clientY: number; viewport: number; rect: ReturnType<typeof cropRect> } | null>(null);
  const id = useId();

  const releaseDraft = () => {
    if (draftRef.current) URL.revokeObjectURL(draftRef.current.url);
    draftRef.current = null;
    if (mounted.current) setDraft(null);
  };
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
      cancelDecode.current?.();
      cancelDecode.current = null;
      pending.current?.abort();
      if (draftRef.current) URL.revokeObjectURL(draftRef.current.url);
      draftRef.current = null;
    };
  }, []);

  const choose = async (file: File) => {
    if (busyRef.current || !userRef.current.active) return;
    generation.current++;
    const ticket = generation.current;
    cancelDecode.current?.();
    setError(''); setMessage(''); setLoading(false);
    if (!allowedTypes.includes(file.type)) { setError('PNG, JPG 또는 WebP 이미지를 선택해 주세요.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('이미지는 최대 5MB까지 사용할 수 있습니다.'); return; }
    setLoading(true);
    const url = URL.createObjectURL(file);
    const image = new Image();
    try {
      await new Promise<void>((resolve, reject) => {
        const clear = () => { image.onload = null; image.onerror = null; };
        image.onload = () => { clear(); resolve(); };
        image.onerror = () => { clear(); reject(new Error('이미지를 읽을 수 없습니다. 다른 파일을 선택해 주세요.')); };
        cancelDecode.current = () => { clear(); image.src = ''; URL.revokeObjectURL(url); reject(new DOMException('선택 취소', 'AbortError')); };
        image.src = url;
      });
      if (!mounted.current || ticket !== generation.current) { URL.revokeObjectURL(url); return; }
      cancelDecode.current = null;
      if (image.naturalWidth < 256 || image.naturalHeight < 256) throw new Error('가로와 세로가 모두 256px 이상인 이미지를 선택해 주세요.');
      releaseDraft();
      const next = { image, url, width: image.naturalWidth, height: image.naturalHeight };
      draftRef.current = next;
      setDraft(next); setCrop(centered); setOpen(true); openRef.current = true;
    } catch (cause) {
      URL.revokeObjectURL(url);
      if (mounted.current && ticket === generation.current) setError(cause instanceof Error ? cause.message : '이미지를 읽을 수 없습니다.');
    } finally {
      if (mounted.current && ticket === generation.current) { setLoading(false); cancelDecode.current = null; }
    }
  };

  const close = () => {
    generation.current++;
    cancelDecode.current?.(); cancelDecode.current = null;
    pending.current?.abort(); pending.current = null;
    openRef.current = false; busyRef.current = false; drag.current = null;
    setOpen(false); setBusy(false); setLoading(false); setError('');
  };

  const save = async () => {
    const source = draftRef.current;
    if (!source || !openRef.current || busyRef.current || !userRef.current.active) return;
    busyRef.current = true; setBusy(true); setError('');
    const ticket = ++generation.current;
    const startedPath = window.location.pathname;
    const controller = new AbortController();
    pending.current = controller;
    try {
      const rect = cropRect(source, crop);
      const canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 512;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('이 브라우저에서 이미지를 저장할 수 없습니다.');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(source.image, rect.x, rect.y, rect.side, rect.side, 0, 0, 512, 512);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('이미지 변환에 실패했습니다.')), 'image/png'));
      if (!mounted.current || ticket !== generation.current || !openRef.current || window.location.pathname !== startedPath) return;
      const saved = await setProfileImage(new File([blob], 'profile.png', { type: 'image/png' }), controller.signal);
      if (!mounted.current || ticket !== generation.current || !openRef.current || !userRef.current.active || window.location.pathname !== startedPath) return;
      if (!saved) throw new Error('프로필 사진을 변경하지 못했습니다. 다시 시도해 주세요.');
      setMessage('프로필 사진이 저장되었습니다.');
      close();
    } catch (cause) {
      if (mounted.current && ticket === generation.current) setError(cause instanceof Error ? cause.message : '사진을 저장하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      if (pending.current === controller) pending.current = null;
      if (mounted.current && ticket === generation.current) { busyRef.current = false; setBusy(false); }
    }
  };

  const remove = async () => {
    if (busyRef.current || !userRef.current.active) return;
    busyRef.current = true; setBusy(true); setError(''); setMessage('');
    const ticket = ++generation.current;
    const controller = new AbortController();
    pending.current = controller;
    try {
      const saved = await setProfileImage(null, controller.signal);
      if (!mounted.current || ticket !== generation.current || controller.signal.aborted) return;
      if (!saved) throw new Error('프로필 사진을 삭제하지 못했습니다. 다시 시도해 주세요.');
      setMessage('기본 프로필로 변경되었습니다.');
    } catch (cause) {
      if (mounted.current && ticket === generation.current && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : '프로필 사진을 삭제하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      if (pending.current === controller) pending.current = null;
      if (mounted.current && ticket === generation.current) { busyRef.current = false; setBusy(false); }
    }
  };
  const rect = draft ? cropRect(draft, crop) : null;
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!rect || busy || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, viewport: event.currentTarget.getBoundingClientRect().width, rect };
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId || busy) return;
    const x = start.rect.x - (event.clientX - start.clientX) * start.rect.side / start.viewport;
    const y = start.rect.y - (event.clientY - start.clientY) * start.rect.side / start.viewport;
    setCrop(current => ({ ...current, x: start.rect.rangeX ? clamp(x / start.rect.rangeX - 1, -1, 1) : 0, y: start.rect.rangeY ? clamp(y / start.rect.rangeY - 1, -1, 1) : 0 }));
  };

  return <div>
    <div className="flex flex-wrap items-center gap-4"><UserAvatar user={user} className="h-20 w-20 text-2xl" /><div className="flex flex-wrap gap-2"><Button ref={trigger} type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy || loading || !user.active}><Camera size={14} />{loading ? '이미지 확인 중' : '사진 변경'}</Button>{user.profileImage && <Button type="button" variant="ghost" size="sm" onClick={() => void remove()} disabled={busy || !user.active}><Trash2 size={14} />사진 삭제</Button>}</div></div>
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-label="프로필 이미지 선택" onChange={event => { const file = event.target.files?.[0]; event.currentTarget.value = ''; if (file) void choose(file); }} />
    <p className="mt-3 text-xs leading-6 text-muted-foreground">PNG, JPG, WebP · 최대 5MB<br />최소 256 × 256px · 정사각형으로 저장</p>
    {!open && error && <FormMessage error>{error}</FormMessage>}
    {message && <FormMessage>{message}</FormMessage>}
    <Modal open={open} onClose={close} onAfterClose={() => { if (!openRef.current) { releaseDraft(); if (mounted.current) trigger.current?.focus({ preventScroll: true }); } }} title="프로필 사진 편집">
      <p id={`${id}-help`} className="mb-5 text-sm leading-6 text-muted-foreground">이미지를 드래그하거나 위치와 크기를 조절하세요. 선택 영역은 512 × 512px로 저장됩니다.</p>
      {draft && rect && <>
        <div role="group" aria-label="사진 자르기 영역" aria-describedby={`${id}-help`} tabIndex={0} className="profile-crop-stage" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} onKeyDown={event => { if (busy || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return; event.preventDefault(); setCrop(current => ({ ...current, x: clamp(current.x + (event.key === 'ArrowLeft' ? -0.05 : event.key === 'ArrowRight' ? 0.05 : 0), -1, 1), y: clamp(current.y + (event.key === 'ArrowUp' ? -0.05 : event.key === 'ArrowDown' ? 0.05 : 0), -1, 1) })); }}>
          <img src={draft.url} alt="저장할 프로필 사진 미리보기" draggable={false} style={{ width: `${draft.width / rect.side * 100}%`, height: `${draft.height / rect.side * 100}%`, left: `${-rect.x / rect.side * 100}%`, top: `${-rect.y / rect.side * 100}%` }} />
          <span className="profile-crop-grid" aria-hidden="true" />
        </div>
        <div className="mt-6 space-y-4"><div><label htmlFor={`${id}-zoom`} className="mb-2 flex justify-between text-sm"><span>확대</span><output className="font-mono text-xs text-muted-foreground">{crop.zoom.toFixed(2)}×</output></label><input id={`${id}-zoom`} aria-label="확대" type="range" min="1" max="3" step="0.01" value={crop.zoom} disabled={busy} onChange={event => setCrop(current => ({ ...current, zoom: Number(event.target.value) }))} className="profile-crop-range" /></div><div className="grid grid-cols-2 gap-5"><div><label htmlFor={`${id}-x`} className="mb-2 block text-xs text-muted-foreground">가로 위치</label><input id={`${id}-x`} type="range" min="-100" max="100" value={Math.round(crop.x * 100)} disabled={busy || rect.rangeX === 0} onChange={event => setCrop(current => ({ ...current, x: Number(event.target.value) / 100 }))} className="profile-crop-range" /></div><div><label htmlFor={`${id}-y`} className="mb-2 block text-xs text-muted-foreground">세로 위치</label><input id={`${id}-y`} type="range" min="-100" max="100" value={Math.round(crop.y * 100)} disabled={busy || rect.rangeY === 0} onChange={event => setCrop(current => ({ ...current, y: Number(event.target.value) / 100 }))} className="profile-crop-range" /></div></div></div>
      </>}
      {error && <FormMessage error>{error}</FormMessage>}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-5"><Button type="button" size="sm" variant="ghost" onClick={() => setCrop(centered)} disabled={busy}><RotateCcw size={14} />위치 초기화</Button><div className="flex gap-2"><Button type="button" variant="outline" onClick={close}>취소</Button><Button type="button" onClick={() => void save()} disabled={busy || !draft}>{busy ? '저장 중…' : '사진 저장'}</Button></div></div>
    </Modal>
  </div>;
}
