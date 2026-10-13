import type { Track } from '@/data/lmsData';

// Public feature descriptions and decorative geometry contain no user or business records.
export const landingWorkflow = [
  { id: 'assign', title: 'ASSIGN', label: '새로운 과제를 확인하고', description: '과제와 마감을 확인하고 필요한 자료를 살펴보세요.' },
  { id: 'learn', title: 'LEARN', label: '직접 부딪히며 배우고', description: '문제의 구조를 이해하고, 자신만의 접근을 기록하세요.' },
  { id: 'submit', title: 'SUBMIT', label: '과정을 기록으로 남기고', description: '실습 결과와 생각의 흐름을 하나의 제출물로 정리하세요.' },
  { id: 'review', title: 'REVIEW', label: '피드백으로 더 깊이', description: '운영진의 피드백을 바탕으로 다음 실습을 이어가세요.' },
];
export const learningAreas: { id: string; number: string; title: Track; subtitle: string; description: string; detail: string }[] = [
  { id: 'web', number: '01', title: '웹해킹', subtitle: '보이는 화면 너머의 구조', description: '요청과 응답, 입력과 실행의 경계를 분석합니다.', detail: 'WEB APPLICATIONS' },
  { id: 'pwnable', number: '02', title: '포너블', subtitle: '실행의 가장 낮은 층까지', description: '메모리와 바이너리에서 프로그램의 원리를 탐구합니다.', detail: 'BINARY EXPLOITATION' },
  { id: 'reversing', number: '03', title: '리버싱', subtitle: '결과에서 원리로 거슬러', description: '실행 파일을 읽고 숨은 로직과 구조를 찾아냅니다.', detail: 'REVERSE ENGINEERING' },
  { id: 'forensics', number: '04', title: '포렌식', subtitle: '흔적을 근거로 바꾸는 과정', description: '디지털 기록을 분석하고 사실을 연결합니다.', detail: 'DIGITAL EVIDENCE' },
];
export const networkNodes = [
  { x: 88, y: 154, label: '웹해킹', tx: -22, ty: -24 },
  { x: 548, y: 154, label: '포너블', tx: -12, ty: -24 },
  { x: 88, y: 448, label: '리버싱', tx: -22, ty: 30 },
  { x: 548, y: 448, label: '포렌식', tx: -12, ty: 30 },
  { x: 320, y: 64 }, { x: 320, y: 548 },
  { x: 56, y: 298 }, { x: 584, y: 298 },
  { x: 184, y: 74, extra: true }, { x: 456, y: 74, extra: true },
  { x: 184, y: 526, extra: true }, { x: 456, y: 526, extra: true },
];
export const networkPaths = [
  'M88 154H158L228 224H256V274',
  'M548 154H482L412 224H384V274',
  'M88 448H162L218 392H266V350',
  'M548 448H476L420 392H374V350',
];
