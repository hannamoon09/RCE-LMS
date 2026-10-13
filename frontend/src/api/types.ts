import type { FileMetadata, LMSUser, Track } from '@/data/lmsData';

export const trackLabels = { WEB: '웹해킹', PWN: '포너블', REVERSING: '리버싱', FORENSICS: '포렌식' } as const;
export type ApiTrack = keyof typeof trackLabels;
export type UserResponse = {
  id: string; studentId: string; name: string; email: string | null;
  role: 'MEMBER' | 'STAFF'; track: ApiTrack; active: boolean; joinedAt: string;
  profileImage: (FileMetadata & { id: string }) | null;
};

export function toUser(user: UserResponse): LMSUser {
  return { ...user, email: user.email || '', role: user.role === 'STAFF' ? 'staff' : 'member',
    track: trackLabels[user.track] as Track, initials: user.name.slice(0, 2).toUpperCase() };
}
