import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { animate } from 'animejs';
import { Button } from '@/components/ui/button';
import { useReducedMotion } from '@/motion/hooks';
import { MOTION } from '@/motion/constants';
import { cn } from '@/lib/utils';
export function Modal({ open, onClose, title, children, drawer = false, onAfterClose }: { open: boolean; onClose: () => void; title: string; children: ReactNode; drawer?: boolean; onAfterClose?: () => void }) {
  const [present, setPresent] = useState(open);
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();
  const retained = useRef({ title, children });
  if (open) retained.current = { title, children };
  const afterClose = useRef(onAfterClose);
  afterClose.current = onAfterClose;
  useLayoutEffect(() => { if (open) setPresent(true); }, [open]);
  useLayoutEffect(() => {
    if (!present || !dialog.current) return;
    const element = dialog.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!element.open) element.showModal();
    panel.current?.querySelector<HTMLElement>('[autofocus], button, input, select, textarea, a[href]')?.focus();
    return () => { document.body.style.overflow = previousOverflow; if (element.open) element.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }); afterClose.current?.(); };
  }, [present]);
  useLayoutEffect(() => {
    if (!present || !panel.current || !backdrop.current) return;
    let valid = true;
    const bg = animate(backdrop.current, { opacity: open ? [0, 1] : 0, duration: reduce ? 0 : MOTION.fast });
    const animation = animate(panel.current, { opacity: open ? [0, 1] : 0, ...(drawer ? { x: reduce ? 0 : open ? ['-100%', '0%'] : '-100%' } : { y: reduce ? 0 : open ? [8, 0] : 4 }), duration: reduce ? 0 : MOTION.fast, ease: MOTION.ease, onComplete: () => { if (!open && valid) setPresent(false); } });
    return () => { valid = false; bg.cancel(); animation.cancel(); };
  }, [open, present, reduce, drawer]);
  if (!present) return null;
  return <dialog ref={dialog} aria-label={retained.current.title} onCancel={event => { event.preventDefault(); onClose(); }} className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 text-foreground backdrop:bg-transparent">
    <button ref={backdrop} onClick={onClose} aria-label="닫기" tabIndex={-1} className="fixed inset-0 bg-background/80 backdrop-blur-sm" />
    <div ref={panel} className={cn('relative border-border bg-card', drawer ? 'h-dvh w-[min(86vw,21rem)] border-r bg-surface-sidebar p-5' : 'mx-auto mt-[8dvh] max-h-[84dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-lg border p-6')}>
      <div className="mb-6 flex items-center justify-between gap-4"><h2 className="text-lg font-semibold">{retained.current.title}</h2><Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label={`${retained.current.title} 닫기`}><X size={18} /></Button></div>{retained.current.children}
    </div>
  </dialog>;
}
