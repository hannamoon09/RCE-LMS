import { Download, FileText } from 'lucide-react';
import type { FileMetadata } from '@/data/fileStore';
import { useStoredFile } from '@/hooks/useFileUrl';

export function formatFileSize(size: number) { return size >= 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`; }
export function FileList({ files, emptyLabel = '첨부파일 없음' }: { files: FileMetadata[]; emptyLabel?: string }) {
  if (!files.length) return <p className="py-2 text-sm text-muted-foreground">{emptyLabel}</p>;
  return <ul className="divide-y divide-border">{files.map((file, index) => <StoredFileRow key={file.id || `${file.name}-${index}`} file={file} />)}</ul>;
}
function StoredFileRow({ file }: { file: FileMetadata }) {
  const { url, loading } = useStoredFile(file.id);
  return <li className="flex items-start gap-3 py-3"><FileText size={17} className="mt-1 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="break-all text-sm">{file.name}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{formatFileSize(file.size)}</p>{!url && <p className="mt-1 text-xs text-muted-foreground">{loading ? '파일 확인 중…' : file.id ? '저장된 파일을 찾을 수 없습니다.' : '이전 데모 파일 · 원본 파일 없음'}</p>}</div>{url && <a href={url} download={file.name} aria-label={`${file.name} 다운로드`} className="inline-flex shrink-0 items-center gap-2 rounded-md px-2 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"><Download size={16} /><span className="hidden sm:inline">다운로드</span></a>}</li>;
}
