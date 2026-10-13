import { useEffect, useRef, useState } from 'react';
import { Download, FileText, LoaderCircle } from 'lucide-react';
import type { FileMetadata } from '@/data/lmsData';
import { filesApi } from '@/api/files';

export function formatFileSize(size: number) { return size >= 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`; }
export function FileList({ files, emptyLabel = '첨부파일 없음' }: { files: FileMetadata[]; emptyLabel?: string }) {
  if (!files.length) return <p className="py-2 text-sm text-muted-foreground">{emptyLabel}</p>;
  return <ul className="divide-y divide-border">{files.map((file, index) => <StoredFileRow key={file.id || `${file.name}-${index}`} file={file} />)}</ul>;
}
function StoredFileRow({ file }: { file: FileMetadata }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);
  const objectUrl = useRef<string | null>(null);
  const revokeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const release = () => {
    if (revokeTimer.current) clearTimeout(revokeTimer.current);
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    revokeTimer.current = null; objectUrl.current = null;
  };
  useEffect(() => () => { pending.current?.abort(); release(); }, []);
  const download = async () => {
    if (!file.id || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true); setError('');
    try {
      const blob = await filesApi.download(file.id, controller.signal);
      if (controller.signal.aborted) return;
      release();
      const url = URL.createObjectURL(blob);
      objectUrl.current = url;
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = file.name;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      revokeTimer.current = setTimeout(release, 1000);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '파일을 내려받지 못했습니다. 다시 시도해 주세요.');
    } finally {
      if (pending.current === controller) pending.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  };
  return <li className="flex items-start gap-3 py-3"><FileText size={17} className="mt-1 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="break-all text-sm">{file.name}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{formatFileSize(file.size)}</p>{!file.id && <p className="mt-1 text-xs text-muted-foreground">파일 정보를 찾을 수 없습니다.</p>}{error && <p role="alert" className="mt-2 text-xs leading-6 text-destructive">{error}</p>}</div>{file.id && <button type="button" disabled={loading} onClick={() => void download()} aria-label={`${file.name} 다운로드`} className="inline-flex shrink-0 items-center gap-2 rounded-md px-2 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50">{loading ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" /> : <Download size={16} />}<span className="hidden sm:inline">{loading ? '다운로드 중' : '다운로드'}</span></button>}</li>;
}
