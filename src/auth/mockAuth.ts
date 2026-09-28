import { currentUserId } from '@/data/lmsData';

export type LoginCredentials = { studentId: string; password: string };
export type AuthSession = { userId: typeof currentUserId };
export interface AuthAdapter {
  restore: (signal: AbortSignal) => Promise<AuthSession | null>;
  login: (credentials: LoginCredentials, signal: AbortSignal) => Promise<AuthSession>;
  logout: () => void;
}

export const demoCredentials: LoginCredentials = {
  studentId: '20240031',
  password: 'RceDemo2026!',
};
export const authStorageKey = 'rce-lms-auth-v1';

function wait(duration: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      window.clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(new DOMException('로그인이 취소되었습니다.', 'AbortError'));
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, duration);
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}

// This adapter simulates a session only. Replace it with the server adapter
// when authentication is connected; never persist submitted credentials.
export const mockAuth: AuthAdapter = {
  async restore(signal) {
    await wait(120, signal);
    try {
      const value: unknown = JSON.parse(sessionStorage.getItem(authStorageKey) || 'null');
      if (value && typeof value === 'object' && 'userId' in value && value.userId === currentUserId) {
        // Normalize even manually edited demo storage to the minimal session.
        const session: AuthSession = { userId: currentUserId };
        sessionStorage.setItem(authStorageKey, JSON.stringify(session));
        return session;
      }
      sessionStorage.removeItem(authStorageKey);
    } catch {
      // Storage restrictions do not prevent using the demo in this view.
    }
    return null;
  },
  async login(credentials, signal) {
    await wait(480, signal);
    if (credentials.studentId.trim() !== demoCredentials.studentId || credentials.password !== demoCredentials.password) {
      throw new Error('학번 또는 비밀번호가 올바르지 않습니다. 아래 데모 계정을 확인해 주세요.');
    }
    const session: AuthSession = { userId: currentUserId };
    try { sessionStorage.setItem(authStorageKey, JSON.stringify(session)); } catch { /* Keep the current session in memory. */ }
    return session;
  },
  logout() {
    try { sessionStorage.removeItem(authStorageKey); } catch { /* In-memory authentication is still cleared. */ }
  },
};
