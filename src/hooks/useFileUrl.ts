import { useEffect, useState } from 'react';
import { getFile } from '@/data/fileStore';

export function useStoredFile(id?: string) {
  const [file, setFile] = useState<{ id?: string; url: string | null; loading: boolean }>({ id, url: null, loading: Boolean(id) });
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setFile({ id, url: null, loading: Boolean(id) });
    if (id) void getFile(id).then(blob => {
      if (!active) return;
      objectUrl = blob ? URL.createObjectURL(blob) : null;
      setFile({ id, url: objectUrl, loading: false });
    }).catch(() => { if (active) setFile({ id, url: null, loading: false }); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id]);
  return file.id === id ? { url: file.url, loading: file.loading } : { url: null, loading: Boolean(id) };
}

export function useFileUrl(id?: string): string | null { return useStoredFile(id).url; }
