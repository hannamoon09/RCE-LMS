import type { FileMetadata } from './lmsData';
export type { FileMetadata } from './lmsData';

export type SavedFile = FileMetadata & { id: string };
export type SelectedFile = FileMetadata & { source?: File };
const databaseName = 'rce-lms-files-v1';
const objectStoreName = 'files';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error('이 브라우저에서 파일 저장소를 사용할 수 없습니다.')); return; }
    const request = indexedDB.open(databaseName, 1);
    let failed = false;
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(objectStoreName)) request.result.createObjectStore(objectStoreName);
    };
    request.onsuccess = () => {
      if (failed) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(new Error('파일 저장소를 열지 못했습니다. 브라우저 저장 공간을 확인해 주세요.'));
    request.onblocked = () => { failed = true; reject(new Error('파일 저장소를 사용하는 다른 RCE 탭을 닫고 다시 시도해 주세요.')); };
  });
}

async function storeBlobs(files: { blob: Blob; name: string }[]): Promise<SavedFile[]> {
  if (!files.length) return [];
  const entries = files.map(({ blob, name }) => ({ blob, metadata: { id: crypto.randomUUID(), name, size: blob.size, type: blob.type || 'application/octet-stream' } }));
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(objectStoreName, 'readwrite');
    transaction.oncomplete = () => { database.close(); resolve(entries.map(entry => entry.metadata)); };
    transaction.onabort = () => { database.close(); reject(new Error('파일을 저장하지 못했습니다. 브라우저 저장 공간을 확인한 뒤 다시 시도해 주세요.')); };
    transaction.onerror = () => { /* The transaction abort handler reports the failed atomic write. */ };
    try { entries.forEach(({ blob, metadata }) => transaction.objectStore(objectStoreName).put(blob, metadata.id)); }
    catch { transaction.abort(); }
  });
}

export function saveFiles(files: File[]): Promise<SavedFile[]> { return storeBlobs(files.map(file => ({ blob: file, name: file.name }))); }
export async function saveFile(blob: Blob, name: string): Promise<SavedFile> { return (await storeBlobs([{ blob, name }]))[0]; }
export async function getFile(id: string): Promise<Blob | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(objectStoreName, 'readonly');
    const request = transaction.objectStore(objectStoreName).get(id);
    let blob: Blob | null = null;
    request.onsuccess = () => { blob = request.result instanceof Blob ? request.result : null; };
    transaction.oncomplete = () => { database.close(); resolve(blob); };
    transaction.onabort = () => { database.close(); reject(new Error('파일을 불러오지 못했습니다. 다시 시도해 주세요.')); };
    transaction.onerror = () => { /* Handled by the transaction abort. */ };
  });
}
export async function deleteFiles(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(objectStoreName, 'readwrite');
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onabort = () => { database.close(); reject(new Error('저장된 파일을 정리하지 못했습니다.')); };
    transaction.onerror = () => { /* Handled by the transaction abort. */ };
    [...new Set(ids)].forEach(id => transaction.objectStore(objectStoreName).delete(id));
  });
}

/** Files stay in React until the enclosing form is saved. No File objects enter application metadata. */
export async function persistSelectedFiles(files: SelectedFile[], signal?: AbortSignal): Promise<FileMetadata[]> {
  if (signal?.aborted) throw new DOMException('파일 저장이 취소되었습니다.', 'AbortError');
  const saved = await saveFiles(files.flatMap(file => file.source ? [file.source] : []));
  if (signal?.aborted) {
    await deleteFiles(saved.map(file => file.id)).catch(() => undefined);
    throw new DOMException('파일 저장이 취소되었습니다.', 'AbortError');
  }
  let next = 0;
  return files.map(file => file.source ? saved[next++] : { ...(file.id ? { id: file.id } : {}), name: file.name, size: file.size, type: file.type });
}
