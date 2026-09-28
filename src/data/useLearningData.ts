import { useMemo } from 'react';
import { useLMS } from './LMSContext';
import { currentUserId, selectLearningData } from './lmsData';

export type { LearnerAssignment } from './lmsData';

export function useLearningData() {
  const { state } = useLMS();
  return useMemo(() => {
    const data = selectLearningData(state, currentUserId);
    if (!data.user) throw new Error('현재 학습자 정보를 찾을 수 없습니다.');
    return { ...data, user: data.user };
  }, [state]);
}
