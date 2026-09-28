import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLMS } from '@/data/LMSContext';
import { type LMSUser } from '@/data/lmsData';
import { mockAuth, type AuthSession, type LoginCredentials } from './mockAuth';

type AuthContextValue = {
  user: LMSUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials, options?: { signal?: AbortSignal }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { state } = useLMS();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    request.current = controller;
    void mockAuth.restore(controller.signal).then(restored => {
      if (!controller.signal.aborted && mounted.current) setSession(restored);
    }).catch(() => {
      if (!controller.signal.aborted && mounted.current) setSession(null);
    }).finally(() => {
      if (request.current === controller && mounted.current) {
        request.current = null;
        setIsLoading(false);
      }
    });
    return () => {
      mounted.current = false;
      request.current?.abort();
      request.current = null;
    };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials, options?: { signal?: AbortSignal }) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const cancel = () => controller.abort();
    if (options?.signal?.aborted) controller.abort();
    else options?.signal?.addEventListener('abort', cancel, { once: true });
    setIsLoading(true);
    try {
      const next = await mockAuth.login(credentials, controller.signal);
      if (controller.signal.aborted || !mounted.current) throw new DOMException('로그인이 취소되었습니다.', 'AbortError');
      setSession(next);
    } finally {
      options?.signal?.removeEventListener('abort', cancel);
      if (request.current === controller && mounted.current) {
        request.current = null;
        setIsLoading(false);
      }
    }
  }, []);

  const logout = useCallback(() => {
    request.current?.abort();
    request.current = null;
    mockAuth.logout();
    setSession(null);
    setIsLoading(false);
  }, []);

  const user = session ? state.users.find(candidate => candidate.id === session.userId) || null : null;
  return <AuthContext.Provider value={{ user, isAuthenticated: user !== null, isLoading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is required');
  return value;
}
