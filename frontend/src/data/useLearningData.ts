import { useMemo } from 'react';
import { useLMS } from './LMSContext';
import { useAuth } from '@/auth/AuthContext';
import { selectLearningData } from './lmsData';

export function useLearningData() {
  const { state, notices } = useLMS();
  const { user } = useAuth();
  return useMemo(() => {
    const data = selectLearningData(state, user?.id || '', notices);
    if (!data.user) throw new Error('현재 학습자 정보를 찾을 수 없습니다.');
    return { ...data, user: data.user };
  }, [state, user?.id, notices]);
}
