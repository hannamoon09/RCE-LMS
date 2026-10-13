import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingState } from '@/components/shared/Primitives';
import { useAuth } from './AuthContext';

export function safeAuthDestination(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) return '/dashboard';
  try {
    const base = 'https://rce.internal';
    const url = new URL(value, base);
    const pathname = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/';
    if (url.origin !== base || pathname === '/' || pathname.toLowerCase() === '/login' || pathname.startsWith('//') || pathname.includes('\\')) return '/dashboard';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/dashboard';
  }
}

export function ProtectedRoute() {
  const { isAuthenticated, isLoading, signedOutReason } = useAuth();
  const location = useLocation();
  if (isLoading) return <LoadingState />;
  if (!isAuthenticated) {
    const from = safeAuthDestination(`${location.pathname}${location.search}${location.hash}`);
    return <Navigate to={signedOutReason === 'passwordChanged' ? '/login?passwordChanged=1' : '/login'} replace state={signedOutReason ? undefined : { from }} />;
  }
  return <Outlet />;
}
