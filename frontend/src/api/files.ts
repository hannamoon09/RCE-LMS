import { apiResponse } from './client';
import type { SelectedFile } from '@/data/lmsData';

/** Save metadata and bytes together so the server can commit or clean up atomically. */
export function withFiles(data: object, files: SelectedFile[]): FormData {
  const form = new FormData();
  const retainedFileIds = files.flatMap(file => !file.source && file.id ? [file.id] : []);
  form.append('data', new Blob([JSON.stringify({ ...data, retainedFileIds })], { type: 'application/json' }));
  files.forEach(file => { if (file.source) form.append('files', file.source, file.source.name); });
  return form;
}

export const filesApi = {
  async download(id: string, signal?: AbortSignal): Promise<Blob> {
    return (await apiResponse(`/files/${encodeURIComponent(id)}`, { signal })).blob();
  },
};
