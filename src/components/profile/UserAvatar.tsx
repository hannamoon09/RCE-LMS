import { useState } from 'react';
import type { LMSUser } from '@/data/lmsData';
import { useFileUrl } from '@/hooks/useFileUrl';
import { cn } from '@/lib/utils';

export function UserAvatar({ user, className }: { user: Pick<LMSUser, 'name' | 'initials' | 'profileImage'>; className?: string }) {
  const url = useFileUrl(user.profileImage?.id);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <span data-user-avatar className={cn('relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-secondary text-sm', className)}>
    {url && url !== failedUrl
      ? <img data-profile-image src={url} alt={`${user.name} 프로필 사진`} className="h-full w-full object-cover" onError={() => setFailedUrl(url)} />
      : <span role="img" aria-label={`${user.name} 기본 프로필`} className="font-medium">{user.initials}</span>}
  </span>;
}
