import { useId, useRef, useState, type DragEvent } from 'react';
import { FileText, UploadCloud, X } from 'lucide-react';
import type { SelectedFile } from '@/data/fileStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatFileSize } from './FileList';

export type { SelectedFile } from '@/data/fileStore';
const accepted = '.pdf,.md,.txt,.zip,.png,.jpg,.jpeg,.webp';
export function FilePicker({ files, onChange, disabled = false, label = '첨부파일 선택' }: { files: SelectedFile[]; onChange: (files: SelectedFile[]) => void; disabled?: boolean; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const hintId = useId();
  const add = (selected: globalThis.FileList | null) => {
    if (!selected || disabled) return;
    const next = [...files];
    const errors: string[] = [];
    Array.from(selected).forEach(file => {
      if (file.size > 10 * 1024 * 1024) errors.push(`${file.name}: 10MB를 초과했습니다.`);
      else if (!/\.(pdf|md|txt|zip|png|jpe?g|webp)$/i.test(file.name)) errors.push(`${file.name}: 지원하지 않는 형식입니다.`);
      else if (next.some(item => item.name === file.name)) errors.push(`${file.name}: 이미 추가된 파일입니다.`);
      else if (next.length >= 5) errors.push('파일은 최대 5개까지 추가할 수 있습니다.');
      else next.push({ name: file.name, size: file.size, type: file.type || 'application/octet-stream', source: file });
    });
    onChange(next);
    setError(errors.join(' '));
    if (input.current) input.current.value = '';
  };
  const drop = (event: DragEvent) => { event.preventDefault(); depth.current = 0; setDragging(false); if (!disabled) add(event.dataTransfer.files); };
  return <div><input ref={input} type="file" multiple accept={accepted} onChange={event => add(event.target.files)} className="sr-only" tabIndex={-1} aria-label={label} disabled={disabled} /><button type="button" disabled={disabled} aria-describedby={hintId} onClick={() => input.current?.click()} onDragEnter={event => { event.preventDefault(); if (!disabled) { depth.current++; setDragging(true); } }} onDragOver={event => event.preventDefault()} onDragLeave={event => { event.preventDefault(); if (--depth.current <= 0) { depth.current = 0; setDragging(false); } }} onDrop={drop} className={cn('w-full rounded-lg border border-dashed px-5 py-8 text-center transition-colors disabled:opacity-50', dragging ? 'border-accent bg-accent/10' : 'border-border bg-card/50 hover:border-input')}><UploadCloud size={25} className={cn('mx-auto mb-4', dragging ? 'text-accent' : 'text-muted-foreground')} /><span className="block text-sm">파일을 드래그하거나 클릭하여 선택</span><span id={hintId} className="mt-2 block text-xs leading-6 text-muted-foreground">PDF, MD, TXT, ZIP, 이미지 · 파일당 10MB · 최대 5개</span></button>
    <ul className="mt-3 divide-y divide-border">{files.map((file, index) => <li key={file.id || `${file.name}-${index}`} className="flex items-center gap-3 py-3"><FileText size={16} className="shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="break-all text-sm">{file.name}</p><p className="mt-1 text-xs text-muted-foreground">{formatFileSize(file.size)} · {file.source ? '저장할 때 첨부' : file.id ? '기존 첨부파일' : '원본 파일 없음'}</p></div><Button type="button" aria-label={`${file.name} 제거`} variant="ghost" size="icon" disabled={disabled} onClick={() => { onChange(files.filter((_, i) => i !== index)); setError(''); }}><X size={15} /></Button></li>)}</ul>{!files.length && <p className="mt-3 text-xs text-muted-foreground">선택한 파일이 없습니다.</p>}{error && <p role="alert" className="mt-3 text-sm leading-6 text-destructive">{error}</p>}<p className="mt-4 text-xs leading-6 text-muted-foreground">파일은 저장할 때 이 브라우저에 보관됩니다.</p>
  </div>;
}
