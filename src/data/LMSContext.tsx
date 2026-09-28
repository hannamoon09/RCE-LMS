import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { currentUserId, initialState, isFileMetadata, isLMSAssignment, isTrack, migrateLMSState, type ActivityKind, type LMSState, type LMSAssignment, type Submission, type Role, type Preferences, type Track } from './lmsData';
import type { FileMetadata } from './lmsData';

export const lmsStorageKey = 'rce-lms-demo-v1';
function readState(): LMSState {
  try {
    const migrated = migrateLMSState(JSON.parse(localStorage.getItem(lmsStorageKey) || 'null'));
    if (migrated) return migrated;
  } catch { /* Unavailable or invalid browser storage falls back to fixtures. */ }
  return structuredClone(initialState);
}

type Store = {
  state: LMSState;
  storageError: boolean;
  submit: (assignmentId: string, text: string, files: Submission['files']) => boolean;
  saveAssignment: (assignment: LMSAssignment) => boolean;
  deleteAssignment: (id: string) => boolean;
  review: (id: string, patch: Pick<Submission, 'score' | 'feedback' | 'status'>) => boolean;
  setRole: (id: string, role: Role) => boolean;
  setTrack: (id: string, track: Track) => boolean;
  saveAccount: (name: string, email: string) => boolean;
  savePreferences: (preferences: Preferences) => boolean;
  setProfileImage: (image: FileMetadata | null) => boolean;
};
const Context = createContext<Store | null>(null);
const isStaff = (state: LMSState) => state.users.some(user => user.id === currentUserId && user.role === 'staff' && user.active);

export function LMSProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(readState);
  const latest = useRef(state);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    try { localStorage.setItem(lmsStorageKey, JSON.stringify(latest.current)); setStorageError(false); }
    catch { setStorageError(true); }
  }, []);
  // Commit synchronously so async file uploads can clean up only after acceptance.
  const update = (change: (old: LMSState) => LMSState) => {
    const next = change(latest.current);
    if (next === latest.current) return false;
    try { localStorage.setItem(lmsStorageKey, JSON.stringify(next)); }
    catch { setStorageError(true); return false; }
    latest.current = next;
    setStorageError(false);
    setState(next);
    return true;
  };
  const activity = (assignmentId: string, kind: ActivityKind, userId = currentUserId) => ({ id: crypto.randomUUID(), userId, assignmentId, kind, at: new Date().toISOString() });
  const store: Store = {
    state,
    storageError,
    submit: (assignmentId, text, files) => update(old => {
      const user = old.users.find(candidate => candidate.id === currentUserId);
      const assignment = old.assignments.find(candidate => candidate.id === assignmentId);
      if (!user?.active || !assignment || new Date(assignment.deadline).getTime() < Date.now()) return old;
      if (typeof text !== 'string' || !Array.isArray(files) || (!text.trim() && files.length === 0)) return old;
      if (text.length > 20000 || files.length > 5 || !files.every(file => isFileMetadata(file) && file.size <= 10 * 1024 * 1024)) return old;
      const existing = old.submissions.find(submission => submission.assignmentId === assignmentId && submission.userId === currentUserId);
      const submission: Submission = { id: existing?.id || crypto.randomUUID(), assignmentId, userId: currentUserId, submittedAt: new Date().toISOString(), text: text.trim(), files: structuredClone(files), status: 'pending', score: null, feedback: '' };
      return {
        ...old,
        submissions: [submission, ...old.submissions.filter(item => item.assignmentId !== assignmentId || item.userId !== currentUserId)],
        activities: [activity(assignmentId, 'submitted'), ...old.activities],
      };
    }),
    saveAssignment: assignment => update(old => {
      if (!isStaff(old) || !isLMSAssignment(assignment)) return old;
      const saved = structuredClone(assignment);
      return { ...old, assignments: old.assignments.some(item => item.id === saved.id) ? old.assignments.map(item => item.id === saved.id ? saved : item) : [saved, ...old.assignments] };
    }),
    deleteAssignment: id => update(old => {
      if (!isStaff(old) || !old.assignments.some(assignment => assignment.id === id)) return old;
      return { ...old, assignments: old.assignments.filter(assignment => assignment.id !== id), submissions: old.submissions.filter(submission => submission.assignmentId !== id), activities: old.activities.filter(item => item.assignmentId !== id) };
    }),
    review: (id, patch) => update(old => {
      if (!isStaff(old) || !['pending', 'reviewed'].includes(patch.status) || typeof patch.feedback !== 'string' || (patch.score !== null && (!Number.isInteger(patch.score) || patch.score < 0 || patch.score > 100))) return old;
      const submission = old.submissions.find(item => item.id === id);
      if (!submission) return old;
      return { ...old, submissions: old.submissions.map(item => item.id === id ? { ...item, ...patch } : item), activities: patch.status === 'reviewed' ? [activity(submission.assignmentId, 'feedback', submission.userId), ...old.activities] : old.activities };
    }),
    setRole: (id, role) => update(old => {
      if (!isStaff(old) || id === currentUserId || !['member', 'staff'].includes(role)) return old;
      return { ...old, users: old.users.map(user => user.id === id ? { ...user, role } : user) };
    }),
    setTrack: (id, track) => update(old => {
      if (!isStaff(old) || !isTrack(track)) return old;
      return { ...old, users: old.users.map(user => user.id === id ? { ...user, track } : user) };
    }),
    saveAccount: (name, email) => update(old => {
      if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return old;
      return { ...old, users: old.users.map(user => user.id === currentUserId ? { ...user, name: name.trim(), email: email.trim() } : user) };
    }),
    savePreferences: preferences => update(old => ({ ...old, preferences: { ...preferences } })),
    setProfileImage: image => update(old => {
      if (image !== null && (!isFileMetadata(image) || !image.id || !['image/png', 'image/jpeg', 'image/webp'].includes(image.type) || image.size > 5 * 1024 * 1024)) return old;
      if (!old.users.some(user => user.id === currentUserId)) return old;
      return { ...old, users: old.users.map(user => user.id === currentUserId ? { ...user, profileImage: image ? { ...image } : null } : user) };
    }),
  };
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useLMS() { const value = useContext(Context); if (!value) throw new Error('LMSProvider is required'); return value; }
