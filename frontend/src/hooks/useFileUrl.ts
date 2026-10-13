import { useEffect, useState } from 'react';
import { filesApi } from '@/api/files';

export function useStoredFile(id?: string) {
  const [file, setFile] = useState<{ id?: string; url: string | null; loading: boolean }>({ id, url: null, loading: Boolean(id) });
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;
    setFile({ id, url: null, loading: Boolean(id) });
    if (id) void filesApi.download(id, controller.signal).then(blob => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setFile({ id, url: objectUrl, loading: false });
    }).catch(() => { if (!controller.signal.aborted) setFile({ id, url: null, loading: false }); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id]);
  return file.id === id ? { url: file.url, loading: file.loading } : { url: null, loading: Boolean(id) };
}

export function useFileUrl(id?: string): string | null { return useStoredFile(id).url; }
