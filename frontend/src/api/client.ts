export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export const unauthorizedEvent = 'rce:unauthorized';
type Options = Omit<RequestInit, 'body'> & { json?: unknown; body?: BodyInit; silentUnauthorized?: boolean };

function csrfCookie(): string | undefined {
  return document.cookie.split('; ').find(part => part.startsWith('XSRF-TOKEN='))?.slice('XSRF-TOKEN='.length);
}

async function checked(response: Response, silentUnauthorized = false): Promise<Response> {
  if (response.ok) return response;
  if (response.status === 401 && !silentUnauthorized) window.dispatchEvent(new Event(unauthorizedEvent));
  const fallback = response.status === 403 ? '이 작업에 접근할 권한이 없거나 인증 정보가 만료되었습니다.' : '요청을 처리하지 못했습니다. 다시 시도해 주세요.';
  const error = await response.json().catch(() => ({})) as { code?: string; message?: string };
  throw new ApiError(response.status, error.code || 'REQUEST_FAILED', error.message || fallback);
}

/** Resolve the deferred server token. The header uses the raw cookie, not the XOR response token. */
export async function refreshCsrf(signal?: AbortSignal): Promise<void> {
  await checked(await fetch('/api/csrf', { credentials: 'include', cache: 'no-store', signal }));
}

let csrfRequest: Promise<void> | undefined;

export async function apiResponse(path: string, options: Options = {}): Promise<Response> {
  const { json, body, silentUnauthorized, ...init } = options;
  const method = (init.method || 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    if (!csrfCookie()) {
      csrfRequest ??= refreshCsrf().finally(() => { csrfRequest = undefined; });
      await csrfRequest;
    }
    const token = csrfCookie();
    if (!token) throw new ApiError(403, 'CSRF_UNAVAILABLE', '인증 토큰을 받지 못했습니다. 새로고침 후 다시 시도해 주세요.');
    headers.set('X-XSRF-TOKEN', decodeURIComponent(token));
  }
  if (json !== undefined) headers.set('Content-Type', 'application/json');
  return checked(await fetch(`/api${path}`, {
    ...init, method, headers, credentials: 'include', cache: 'no-store',
    body: json === undefined ? body : JSON.stringify(json),
  }), silentUnauthorized);
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const response = await apiResponse(path, options);
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
