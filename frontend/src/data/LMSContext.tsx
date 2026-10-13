import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { type LMSState, type LMSAssignment, type LMSUser, type Submission, type Notice } from './lmsData';
import { useAuth } from '@/auth/AuthContext';
import { assignmentsApi, type AssignmentInput } from '@/api/assignments';
import { submissionsApi } from '@/api/submissions';
import { adminApi, type CreateMemberInput, type UpdateMemberInput, type ReviewInput } from '@/api/admin';
import type { SelectedFile } from './lmsData';
import { noticesApi, compareNotices, type NoticeInput } from '@/api/notices';
import { rankingsApi, type RankingEntry } from '@/api/rankings';
import { profileApi } from '@/api/profile';

type Store = {
  state: LMSState;
  submit: (assignmentId: string, text: string, files: SelectedFile[], signal?: AbortSignal) => Promise<boolean>;
  submissionsLoading: boolean;
  submissionsError: string;
  reloadSubmissions: () => void;
  assignmentsLoading: boolean;
  assignmentsError: string;
  reloadAssignments: () => void;
  saveAssignment: (assignment: AssignmentInput, files: SelectedFile[], id?: string, signal?: AbortSignal) => Promise<boolean>;
  deleteAssignment: (id: string) => Promise<boolean>;
  review: (id: string, patch: ReviewInput, signal?: AbortSignal) => Promise<boolean>;
  membersLoading: boolean;
  membersError: string;
  reloadMembers: () => void;
  createMember: (input: CreateMemberInput, signal?: AbortSignal) => Promise<boolean>;
  updateMember: (id: string, input: UpdateMemberInput, signal?: AbortSignal) => Promise<boolean>;
  notices: Notice[];
  noticesLoading: boolean;
  noticesError: string;
  reloadNotices: () => void;
  saveNotice: (input: NoticeInput, id?: string, signal?: AbortSignal) => Promise<boolean>;
  deleteNotice: (id: string) => Promise<boolean>;
  rankings: RankingEntry[];
  rankingsLoading: boolean;
  rankingsReady: boolean;
  rankingsError: string;
  reloadRankings: () => void;
  saveAccount: (name: string, email: string, signal?: AbortSignal) => Promise<boolean>;
  setProfileImage: (image: File | null, signal?: AbortSignal) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string, signal?: AbortSignal) => Promise<boolean>;
};
const Context = createContext<Store | null>(null);

export function LMSProvider({ children }: { children: ReactNode }) {
  const { user: authenticatedUser, captureSession, applyUser, endSession } = useAuth();
  const profileMutations = useRef(new Set<AbortController>());
  useEffect(() => () => {
    profileMutations.current.forEach(controller => controller.abort());
    profileMutations.current.clear();
  }, [authenticatedUser?.id]);
  const saveProfile = async (mutation: (signal: AbortSignal) => Promise<LMSUser | void>, signal?: AbortSignal) => {
    if (!authenticatedUser?.active) return false;
    const session = captureSession();
    const controller = new AbortController();
    const cancel = () => controller.abort();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener('abort', cancel, { once: true });
    profileMutations.current.add(controller);
    try {
      const saved = await mutation(controller.signal);
      if (controller.signal.aborted) return false;
      if (!saved) return endSession(session, 'passwordChanged');
      const accepted = applyUser(saved, session);
      if (accepted) reloadRankings();
      return accepted;
    } finally {
      signal?.removeEventListener('abort', cancel);
      profileMutations.current.delete(controller);
    }
  };
  const assignmentOwner = authenticatedUser ? `${authenticatedUser.id}:${authenticatedUser.track}` : '';
  const assignmentOwnerRef = useRef(assignmentOwner);
  assignmentOwnerRef.current = assignmentOwner;
  const isStaff = () => authenticatedUser?.role === 'staff' && authenticatedUser.active;
  const [assignmentData, setAssignmentData] = useState<{ owner: string; items: LMSAssignment[]; loading: boolean; error: string }>({ owner: '', items: [], loading: false, error: '' });
  const assignmentRequest = useRef<AbortController | null>(null);
  const assignmentMutations = useRef(new Set<AbortController>());
  const reloadAssignments = useCallback(() => {
    assignmentRequest.current?.abort();
    if (!assignmentOwner) return;
    const controller = new AbortController();
    assignmentRequest.current = controller;
    setAssignmentData({ owner: assignmentOwner, items: [], loading: true, error: '' });
    void assignmentsApi.list(controller.signal).then(items => {
      if (!controller.signal.aborted && assignmentOwnerRef.current === assignmentOwner) setAssignmentData({ owner: assignmentOwner, items, loading: false, error: '' });
    }).catch(failure => {
      if (!controller.signal.aborted && assignmentOwnerRef.current === assignmentOwner) setAssignmentData({ owner: assignmentOwner, items: [], loading: false, error: failure instanceof Error ? failure.message : '과제를 불러오지 못했습니다.' });
    });
  }, [assignmentOwner]);
  useEffect(() => {
    reloadAssignments();
    return () => {
      assignmentRequest.current?.abort();
      assignmentMutations.current.forEach(controller => controller.abort());
      assignmentMutations.current.clear();
    };
  }, [reloadAssignments]);
  const submissionOwner = authenticatedUser ? `${authenticatedUser.id}:${authenticatedUser.track}:${authenticatedUser.role}` : '';
  const submissionOwnerRef = useRef(submissionOwner);
  submissionOwnerRef.current = submissionOwner;
  const memberSession = authenticatedUser?.role === 'member';
  const staffSession = authenticatedUser?.role === 'staff';
  const [submissionData, setSubmissionData] = useState<{ owner: string; items: Submission[]; loading: boolean; error: string }>({ owner: '', items: [], loading: false, error: '' });
  const submissionRequest = useRef<AbortController | null>(null);
  const submissionMutations = useRef(new Set<AbortController>());
  const reloadSubmissions = useCallback(() => {
    submissionRequest.current?.abort();
    if (!submissionOwner) {
      setSubmissionData({ owner: submissionOwner, items: [], loading: false, error: '' });
      return;
    }
    const controller = new AbortController();
    submissionRequest.current = controller;
    setSubmissionData({ owner: submissionOwner, items: [], loading: true, error: '' });
    const response = memberSession ? submissionsApi.mine(controller.signal) : adminApi.submissions(controller.signal);
    void response.then(items => {
      if (!controller.signal.aborted && submissionOwnerRef.current === submissionOwner) setSubmissionData({ owner: submissionOwner, items, loading: false, error: '' });
    }).catch(failure => {
      if (!controller.signal.aborted && submissionOwnerRef.current === submissionOwner) setSubmissionData({ owner: submissionOwner, items: [], loading: false, error: failure instanceof Error ? failure.message : '제출물을 불러오지 못했습니다.' });
    });
  }, [submissionOwner, memberSession]);
  useEffect(() => {
    reloadSubmissions();
    return () => {
      submissionRequest.current?.abort();
      submissionMutations.current.forEach(controller => controller.abort());
      submissionMutations.current.clear();
    };
  }, [reloadSubmissions]);
  const [memberData, setMemberData] = useState<{ owner: string; items: LMSUser[]; loading: boolean; error: string }>({ owner: '', items: [], loading: false, error: '' });
  const memberRequest = useRef<AbortController | null>(null);
  const memberMutations = useRef(new Set<AbortController>());
  const reloadMembers = useCallback(() => {
    memberRequest.current?.abort();
    if (!submissionOwner || !staffSession) {
      setMemberData({ owner: submissionOwner, items: [], loading: false, error: '' });
      return;
    }
    const controller = new AbortController();
    memberRequest.current = controller;
    setMemberData({ owner: submissionOwner, items: [], loading: true, error: '' });
    void adminApi.members(controller.signal).then(items => {
      if (!controller.signal.aborted && submissionOwnerRef.current === submissionOwner) setMemberData({ owner: submissionOwner, items, loading: false, error: '' });
    }).catch(failure => {
      if (!controller.signal.aborted && submissionOwnerRef.current === submissionOwner) setMemberData({ owner: submissionOwner, items: [], loading: false, error: failure instanceof Error ? failure.message : '학생 정보를 불러오지 못했습니다.' });
    });
  }, [submissionOwner, staffSession]);
  useEffect(() => {
    reloadMembers();
    return () => {
      memberRequest.current?.abort();
      memberMutations.current.forEach(controller => controller.abort());
      memberMutations.current.clear();
    };
  }, [reloadMembers]);
  const serverMembers = memberData.owner === submissionOwner && staffSession ? memberData.items : [];
  const [rankingData, setRankingData] = useState<{ owner: string; items: RankingEntry[]; loading: boolean; loaded: boolean; error: string }>({ owner: '', items: [], loading: false, loaded: false, error: '' });
  const rankingRequest = useRef<AbortController | null>(null);
  const reloadRankings = useCallback(() => {
    rankingRequest.current?.abort();
    if (!submissionOwner) {
      setRankingData({ owner: '', items: [], loading: false, loaded: false, error: '' });
      return;
    }
    const controller = new AbortController();
    rankingRequest.current = controller;
    // Refreshes keep the existing page and editor mounted while new scores arrive.
    setRankingData(old => old.owner === submissionOwner
      ? { ...old, loading: !old.loaded, error: '' }
      : { owner: submissionOwner, items: [], loading: true, loaded: false, error: '' });
    const response = memberSession ? rankingsApi.mine(controller.signal) : rankingsApi.admin(controller.signal);
    void response.then(items => {
      if (!controller.signal.aborted && submissionOwnerRef.current === submissionOwner) setRankingData({ owner: submissionOwner, items, loading: false, loaded: true, error: '' });
    }).catch(failure => {
      if (!controller.signal.aborted && submissionOwnerRef.current === submissionOwner) setRankingData(old => old.owner === submissionOwner
        ? { ...old, loading: false, error: failure instanceof Error ? failure.message : '순위를 불러오지 못했습니다.' }
        : old);
    });
  }, [submissionOwner, memberSession]);
  useEffect(() => {
    reloadRankings();
    return () => rankingRequest.current?.abort();
  }, [reloadRankings]);
  const saveMember = async (input: CreateMemberInput | UpdateMemberInput, id?: string, signal?: AbortSignal) => {
    if (!staffSession) return false;
    const controller = new AbortController();
    const cancel = () => controller.abort();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener('abort', cancel, { once: true });
    memberMutations.current.add(controller);
    try {
      const saved = id ? await adminApi.updateMember(id, input, controller.signal) : await adminApi.createMember(input as CreateMemberInput, controller.signal);
      if (controller.signal.aborted || submissionOwnerRef.current !== submissionOwner) return false;
      setMemberData(old => old.owner === submissionOwner ? { ...old, items: id ? old.items.map(item => item.id === id ? saved : item) : [saved, ...old.items] } : old);
      reloadRankings();
      return true;
    } finally {
      signal?.removeEventListener('abort', cancel);
      memberMutations.current.delete(controller);
    }
  };
  const [noticeData, setNoticeData] = useState<{ owner: string; items: Notice[]; loading: boolean; error: string }>({ owner: '', items: [], loading: false, error: '' });
  const noticeRequest = useRef<AbortController | null>(null);
  const noticeMutations = useRef(new Set<AbortController>());
  const reloadNotices = useCallback(() => {
    noticeRequest.current?.abort();
    if (!submissionOwner) return;
    const controller = new AbortController();
    noticeRequest.current = controller;
    setNoticeData({ owner: submissionOwner, items: [], loading: true, error: '' });
    void noticesApi.list(controller.signal).then(items => {
      if (!controller.signal.aborted && submissionOwnerRef.current === submissionOwner) setNoticeData({ owner: submissionOwner, items, loading: false, error: '' });
    }).catch(failure => {
      if (!controller.signal.aborted && submissionOwnerRef.current === submissionOwner) setNoticeData({ owner: submissionOwner, items: [], loading: false, error: failure instanceof Error ? failure.message : '공지를 불러오지 못했습니다.' });
    });
  }, [submissionOwner]);
  useEffect(() => {
    reloadNotices();
    return () => {
      noticeRequest.current?.abort();
      noticeMutations.current.forEach(controller => controller.abort());
      noticeMutations.current.clear();
    };
  }, [reloadNotices]);
  const serverSubmissions = submissionData.owner === submissionOwner ? submissionData.items : [];
  const serverActivities = serverSubmissions.flatMap(submission => [
    { id: `${submission.id}:submitted`, userId: submission.userId, assignmentId: submission.assignmentId, kind: 'submitted' as const, at: submission.submittedAt },
    ...(submission.status === 'reviewed' && submission.reviewedAt ? [{ id: `${submission.id}:feedback`, userId: submission.userId, assignmentId: submission.assignmentId, kind: 'feedback' as const, at: submission.reviewedAt }] : []),
  ]);
  const serverAssignments = assignmentData.owner === assignmentOwner ? assignmentData.items : [];
  const store: Store = {
    state: { assignments: serverAssignments, submissions: serverSubmissions, activities: serverActivities,
      users: authenticatedUser ? [...serverMembers.filter(user => user.id !== authenticatedUser.id), authenticatedUser] : [] },
    assignmentsLoading: Boolean(assignmentOwner) && (assignmentData.owner !== assignmentOwner || assignmentData.loading),
    assignmentsError: assignmentData.owner === assignmentOwner ? assignmentData.error : '',
    reloadAssignments,
    submissionsLoading: Boolean(submissionOwner) && (submissionData.owner !== submissionOwner || submissionData.loading),
    submissionsError: submissionData.owner === submissionOwner ? submissionData.error : '',
    reloadSubmissions,
    membersLoading: staffSession && (memberData.owner !== submissionOwner || memberData.loading),
    membersError: memberData.owner === submissionOwner ? memberData.error : '',
    reloadMembers,
    createMember: (input, signal) => saveMember(input, undefined, signal),
    updateMember: (id, input, signal) => saveMember(input, id, signal),
    submit: async (assignmentId, text, files, signal) => {
      if (!memberSession) return false;
      const controller = new AbortController();
      const cancel = () => controller.abort();
      if (signal?.aborted) controller.abort();
      else signal?.addEventListener('abort', cancel, { once: true });
      submissionMutations.current.add(controller);
      try {
        const saved = await submissionsApi.submit(assignmentId, text, files, controller.signal);
        if (controller.signal.aborted || submissionOwnerRef.current !== submissionOwner) return false;
        setSubmissionData(old => old.owner === submissionOwner ? { ...old, items: [saved, ...old.items.filter(item => item.assignmentId !== saved.assignmentId)] } : old);
        reloadRankings();
        return true;
      } finally {
        signal?.removeEventListener('abort', cancel);
        submissionMutations.current.delete(controller);
      }
    },
    saveAssignment: async (assignment, files, id, signal) => {
      if (!isStaff()) return false;
      const controller = new AbortController();
      const cancel = () => controller.abort();
      if (signal?.aborted) controller.abort();
      else signal?.addEventListener('abort', cancel, { once: true });
      assignmentMutations.current.add(controller);
      try {
        const saved = id ? await assignmentsApi.update(id, assignment, files, controller.signal) : await assignmentsApi.create(assignment, files, controller.signal);
        if (controller.signal.aborted || assignmentOwnerRef.current !== assignmentOwner) return false;
        setAssignmentData(old => old.owner === assignmentOwner ? { ...old, items: id ? old.items.map(item => item.id === id ? saved : item) : [saved, ...old.items] } : old);
        return true;
      } finally {
        signal?.removeEventListener('abort', cancel);
        assignmentMutations.current.delete(controller);
      }
    },
    deleteAssignment: async id => {
      if (!isStaff()) return false;
      const controller = new AbortController();
      assignmentMutations.current.add(controller);
      try {
        await assignmentsApi.remove(id, controller.signal);
        if (controller.signal.aborted || assignmentOwnerRef.current !== assignmentOwner) return false;
        setAssignmentData(old => old.owner === assignmentOwner ? { ...old, items: old.items.filter(item => item.id !== id) } : old);
        return true;
      } finally { assignmentMutations.current.delete(controller); }
    },
    review: async (id, patch, signal) => {
      if (!staffSession) return false;
      const controller = new AbortController();
      const cancel = () => controller.abort();
      if (signal?.aborted) controller.abort();
      else signal?.addEventListener('abort', cancel, { once: true });
      submissionMutations.current.add(controller);
      try {
        const saved = await adminApi.review(id, patch, controller.signal);
        if (controller.signal.aborted || submissionOwnerRef.current !== submissionOwner) return false;
        setSubmissionData(old => old.owner === submissionOwner ? { ...old, items: old.items.map(item => item.id === id ? saved : item) } : old);
        reloadRankings();
        return true;
      } finally {
        signal?.removeEventListener('abort', cancel);
        submissionMutations.current.delete(controller);
      }
    },
    notices: noticeData.owner === submissionOwner ? [...noticeData.items].sort(compareNotices) : [],
    rankings: rankingData.owner === submissionOwner ? rankingData.items : [],
    rankingsLoading: Boolean(submissionOwner) && (rankingData.owner !== submissionOwner || rankingData.loading),
    rankingsReady: rankingData.owner === submissionOwner && rankingData.loaded,
    rankingsError: rankingData.owner === submissionOwner ? rankingData.error : '',
    reloadRankings,
    noticesLoading: Boolean(submissionOwner) && (noticeData.owner !== submissionOwner || noticeData.loading),
    noticesError: noticeData.owner === submissionOwner ? noticeData.error : '',
    reloadNotices,
    saveNotice: async (input, id, signal) => {
      if (!staffSession) return false;
      const controller = new AbortController();
      const cancel = () => controller.abort();
      if (signal?.aborted) controller.abort();
      else signal?.addEventListener('abort', cancel, { once: true });
      noticeMutations.current.add(controller);
      try {
        const saved = id ? await noticesApi.update(id, input, controller.signal) : await noticesApi.create(input, controller.signal);
        if (controller.signal.aborted || submissionOwnerRef.current !== submissionOwner) return false;
        setNoticeData(old => old.owner === submissionOwner ? { ...old, items: id ? old.items.map(item => item.id === id ? saved : item) : [saved, ...old.items] } : old);
        return true;
      } finally {
        signal?.removeEventListener('abort', cancel);
        noticeMutations.current.delete(controller);
      }
    },
    deleteNotice: async id => {
      if (!staffSession) return false;
      const controller = new AbortController();
      noticeMutations.current.add(controller);
      try {
        await noticesApi.remove(id, controller.signal);
        if (controller.signal.aborted || submissionOwnerRef.current !== submissionOwner) return false;
        setNoticeData(old => old.owner === submissionOwner ? { ...old, items: old.items.filter(item => item.id !== id) } : old);
        return true;
      } finally { noticeMutations.current.delete(controller); }
    },
    saveAccount: (name, email, signal) => saveProfile(abort => profileApi.update(name, email, abort), signal),
    setProfileImage: (image, signal) => saveProfile(abort => profileApi.image(image, abort), signal),
    changePassword: (currentPassword, newPassword, signal) => saveProfile(abort => profileApi.password(currentPassword, newPassword, abort), signal),
  };
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useLMS() { const value = useContext(Context); if (!value) throw new Error('LMSProvider is required'); return value; }
