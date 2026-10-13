import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { type LMSUser } from '@/data/lmsData';
import { authApi, type LoginCredentials } from '@/api/auth';
import { unauthorizedEvent } from '@/api/client';

type AuthContextValue = {
  user: LMSUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials, options?: { signal?: AbortSignal }) => Promise<void>;
  logout: () => Promise<void>;
  captureSession: () => number;
  applyUser: (user: LMSUser, session: number) => boolean;
  endSession: (session: number, reason?: 'passwordChanged') => boolean;
  signedOutReason: 'passwordChanged' | null;
  error: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LMSUser | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [signedOutReason, setSignedOutReason] = useState<'passwordChanged' | null>(null);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const currentUser = useRef<LMSUser | null>(null);
  const commit = useCallback((next: LMSUser | null) => {
    currentUser.current = next;
    setUser(next);
  }, []);
  const captureSession = useCallback(() => generation.current, []);
  const applyUser = useCallback((next: LMSUser, session: number) => {
    if (!mounted.current || generation.current !== session || currentUser.current?.id !== next.id) return false;
    commit(next);
    return true;
  }, [commit]);
  const endSession = useCallback((session: number, reason?: 'passwordChanged') => {
    if (!mounted.current || generation.current !== session) return false;
    generation.current++;
    request.current?.abort();
    request.current = null;
    commit(null);
    setSignedOutReason(reason || null);
    setIsLoading(false);
    return true;
  }, [commit]);

  useEffect(() => {
    mounted.current = true;
    const session = ++generation.current;
    const controller = new AbortController();
    request.current = controller;
    void authApi.restore(controller.signal).then(restored => {
      if (!controller.signal.aborted && mounted.current && generation.current === session) commit(restored);
    }).catch(failure => {
      if (!controller.signal.aborted && mounted.current && generation.current === session) {
        commit(null);
        setError(failure instanceof Error ? failure.message : '인증 서버에 연결하지 못했습니다. 다시 시도해 주세요.');
      }
    }).finally(() => {
      if (request.current === controller && mounted.current) {
        request.current = null;
        setIsLoading(false);
      }
    });
    const expired = () => { if (currentUser.current) endSession(generation.current); };
    window.addEventListener(unauthorizedEvent, expired);
    return () => {
      window.removeEventListener(unauthorizedEvent, expired);
      mounted.current = false;
      generation.current++;
      request.current?.abort();
      request.current = null;
    };
  }, [commit, endSession]);

  const login = useCallback(async (credentials: LoginCredentials, options?: { signal?: AbortSignal }) => {
    const session = ++generation.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const cancel = () => controller.abort();
    if (options?.signal?.aborted) controller.abort();
    else options?.signal?.addEventListener('abort', cancel, { once: true });
    setIsLoading(true);
    setError('');
    try {
      const next = await authApi.login(credentials, controller.signal);
      if (controller.signal.aborted || !mounted.current || generation.current !== session) throw new DOMException('로그인이 취소되었습니다.', 'AbortError');
      commit(next);
      setSignedOutReason(null);
    } finally {
      options?.signal?.removeEventListener('abort', cancel);
      if (request.current === controller && mounted.current) {
        request.current = null;
        setIsLoading(false);
      }
    }
  }, [commit]);

  const logout = useCallback(async () => {
    const session = ++generation.current;
    request.current?.abort();
    request.current = null;
    await authApi.logout();
    endSession(session);
  }, [endSession]);

  return <AuthContext.Provider value={{ user, isAuthenticated: user !== null, isLoading, login, logout, captureSession, applyUser, endSession, signedOutReason, error }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is required');
  return value;
}
