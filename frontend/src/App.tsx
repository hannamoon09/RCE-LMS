import { Component, Suspense, lazy, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { ErrorState, LoadingState } from '@/components/shared/Primitives';
import { LMSProvider } from '@/data/LMSContext';
import { PageTransition } from '@/motion/PageTransition';
import { Dashboard } from '@/pages/Dashboard';
import { LandingPage } from '@/pages/Landing';
import { LoginPage } from '@/pages/Login';
const Assignments = lazy(() => import('@/pages/Assignments').then(m => ({ default: m.AssignmentsPage })));
const AssignmentDetail = lazy(() => import('@/pages/Assignments').then(m => ({ default: m.AssignmentDetailPage })));
const AssignmentSubmit = lazy(() => import('@/pages/Assignments').then(m => ({ default: m.AssignmentSubmitPage })));
const Notices = lazy(() => import('@/pages/Notices').then(m => ({ default: m.NoticesPage })));
const NoticeDetail = lazy(() => import('@/pages/Notices').then(m => ({ default: m.NoticeDetailPage })));
const Submissions = lazy(() => import('@/pages/Submissions').then(m => ({ default: m.SubmissionsPage })));
const Rankings = lazy(() => import('@/pages/Rankings').then(m => ({ default: m.RankingsPage })));
const Profile = lazy(() => import('@/pages/Account').then(m => ({ default: m.ProfilePage })));
const Settings = lazy(() => import('@/pages/Account').then(m => ({ default: m.SettingsPage })));
const Admin = lazy(() => import('@/pages/Admin').then(m => ({ default: m.AdminPage })));
const AdminAssignments = lazy(() => import('@/pages/Admin').then(m => ({ default: m.AdminAssignmentsPage })));
const AdminSubmissions = lazy(() => import('@/pages/Admin').then(m => ({ default: m.AdminSubmissionsPage })));
const AdminUsers = lazy(() => import('@/pages/Admin').then(m => ({ default: m.AdminUsersPage })));
class PageErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? <ErrorState title="화면을 불러오지 못했습니다" description="잠시 후 다시 시도해 주세요." onRetry={() => window.location.reload()} /> : this.props.children; }
}
function StaffOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user?.role === 'staff' ? children : <ErrorState title="운영진 전용 페이지입니다" description="분야 배정과 과제 관리는 운영진에게 문의해 주세요." />;
}
function ServiceRoutes() {
  return <AppShell><PageTransition>{location => <PageErrorBoundary key={location.pathname}><Suspense fallback={<LoadingState />}><Routes location={location}>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/assignments" element={<Assignments />} />
    <Route path="/assignments/:id" element={<AssignmentDetail />} />
    <Route path="/assignments/:id/submit" element={<AssignmentSubmit />} />
    <Route path="/notices" element={<Notices />} />
    <Route path="/notices/:id" element={<NoticeDetail />} />
    <Route path="/submissions" element={<Submissions />} />
    <Route path="/rankings" element={<Rankings />} />
    <Route path="/profile" element={<Profile />} />
    <Route path="/settings" element={<Settings />} />
    <Route path="/admin" element={<StaffOnly><Admin /></StaffOnly>} />
    <Route path="/admin/assignments" element={<StaffOnly><AdminAssignments /></StaffOnly>} />
    <Route path="/admin/submissions" element={<StaffOnly><AdminSubmissions /></StaffOnly>} />
    <Route path="/admin/users" element={<StaffOnly><AdminUsers /></StaffOnly>} />
    <Route path="*" element={<ErrorState title="페이지를 찾을 수 없습니다" description="주소를 확인하거나 대시보드로 돌아가세요." />} />
  </Routes></Suspense></PageErrorBoundary>}</PageTransition></AppShell>;
}
export default function App() {
  return <AuthProvider><LMSProvider><Suspense fallback={<LoadingState />}><Routes>
    <Route path="/" element={<PublicLayout mode="landing"><LandingPage /></PublicLayout>} />
    <Route path="/login" element={<PublicLayout mode="login"><LoginPage /></PublicLayout>} />
    <Route element={<ProtectedRoute />}>
      <Route path="*" element={<ServiceRoutes />} />
    </Route>
  </Routes></Suspense></LMSProvider></AuthProvider>;
}
