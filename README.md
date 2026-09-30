# RCE LMS

기존 Dashboard A의 React / TypeScript / Vite 프로젝트를 확장한 LMS 프론트엔드입니다. 기존 로고, Tailwind semantic token, shadcn/ui 컴포넌트와 Anime.js를 유지합니다.

## 실행과 검증

```sh
npm install
npm run dev
npm run build
npx playwright test
```

`npm run build`는 TypeScript 프로젝트 검사(`tsc -b`)와 Vite production build를 실행합니다. Playwright는 포트 5180에 별도 Vite 서버를 띄우며, 설치된 Chromium이 필요합니다. 브라우저가 없다면 `npx playwright install chromium`으로 설치합니다.

## 경로

- `/`: 공개 RCE 랜딩. 로그인 상태에서도 랜딩을 유지합니다.
- `/login`: 회원 로그인. 회원가입·소셜 로그인은 제공하지 않습니다.
- `/dashboard`: Dashboard A 기반 메인 화면
- `/assignments`, `/assignments/:id`, `/assignments/:id/submit`: 검색, 필터, 상세, 제출·재제출
- `/notices`, `/notices/:id`: 공지 목록과 읽기 화면
- `/submissions`, `/profile`, `/settings`: 내 제출 결과, 계정, 알림 설정
- `/rankings`: 학생 분야별 순위. 일반 학생은 자신의 분야, 운영진은 네 분야 필터 제공
- `/admin`, `/admin/assignments`, `/admin/submissions`, `/admin/users`: 운영 현황, 과제 CRUD, 검토, 분야 배정·역할 변경
- `/prototypes`, `/dashboard/a`, `/dashboard/b`, `/dashboard/c`, `/dashboard/d`: 기존 프로토타입 비교 경로

## 구조

- `src/auth/`: AuthProvider/useAuth, ProtectedRoute, 교체 가능한 Mock Auth adapter
- `src/components/layout/PublicLayout.tsx`: 랜딩·로그인 전용 헤더·본문·푸터, LMS Sidebar와 분리
- `src/pages/Landing.tsx`, `src/components/landing/`: Hero 네트워크, 기존 Dashboard 디자인을 재사용한 공개 미리보기, 학습 흐름
- `src/motion/landing/`: Hero timeline, SVG path/signal, pointer interaction, scroll timeline과 cleanup
- `src/components/layout/AppShell.tsx`: 서비스 경로 사이에서 유지되는 sidebar, mobile navigation
- `src/components/dashboard/`: 기존 Dashboard A 컴포넌트를 재사용·개선
- `src/components/shared/`: PageHeader, 검색·필터, 상태, 과제 행·주요 과제 카드, Modal
- `src/motion/`: Anime.js 공통 timing, reduced-motion, page transition, reveal 및 interaction cleanup
- `src/data/mockData.ts`: 공통 내비게이션·상태 라벨·프로토타입 정보
- `src/data/lmsData.ts`: 과제·공지·학생·제출물 fixture와 날짜/상태 selector
- `src/data/LMSContext.tsx`: 화면에서 사용하는 공통 mock adapter와 browser-local 상태
- `src/data/useLearningData.ts`: 공통 과제, 현재 계정의 제출·활동 및 전체/해당 분야 공지을 제공하는 공통 hook
- `src/data/ranking.ts`: 기존 제출 점수에서 분야 순위와 개인 순위를 계산하는 순수 함수
- `src/pages/`: 학습자·운영진 페이지
- `tests/refinement-admin.spec.ts`, `tests/profile.spec.ts`: 첨부파일 원본·선택 메모·필터·프로필 사진·모바일 편집 검증
- `tests/lms.spec.ts`: 경로·반응형·사용자 흐름 검증
- `tests/dashboard-assignments.spec.ts`: 마감 전·기한 지난 과제 분리, 제출 완료 제외, 빈 상태와 기존 마감 후 제출 제한 검증
- `tests/public.spec.ts`: 공개 페이지·로그인·보호 경로·키보드·모션 감소 검증
- `tests/workspace-motion.spec.ts`: 제목 접근성·필터 중 모션 재생 방지·빠른 이동·목록 정착·reduced motion 검증
- `tests/tracks.spec.ts`, `tests/data.spec.ts`: 계정별 공지·직접 URL 접근·운영진 분야 배정·기존 저장 데이터 이전 검증
- `tests/ranking-data.spec.ts`, `tests/rankings.spec.ts`: 최신 제출·동점·0점·분야 제한·점수 변경과 순위 화면 연동 검증

## 디자인과 모션

기존 `theme.css`의 canvas → navigation → workspace → card → interactive 위계를 사용합니다. Workspace에는 낮은 불투명도의 정적 Silver 빛을 더하고, `01 / DASHBOARD`처럼 번호가 붙은 섹션 라벨에는 얇은 Graphite → Silver → Graphite 구분선을 사용합니다. Sidebar와 일반 카드는 단색이며 제목은 Off White를 유지합니다. 청록 accent는 상태·마감 임박·포커스에 제한합니다. SUIT와 Wanted Sans의 크기·굵기·자간으로 정보의 우선순위를 구분합니다.

대시보드는 제출 가능한 과제 중 마감이 가장 가까운 한 개를 주요 카드로 강조하고, 실제 마감 날짜에 따라 오늘 마감·마감 임박·기한 초과를 표시합니다. 과제 확인은 기존 상세 경로로 연결됩니다. 사용자 이름은 Desktop 최대 40px, 미제출 수는 최대 64px이며 보조 정보는 13~14px입니다. 모바일에서는 다음 과제부터 확인할 수 있습니다. 마감 전 미제출은 가까운 마감순으로 다음 과제에, 기한 지난 미제출은 별도 목록에 최근 마감순으로 각각 최대 3개 표시합니다. 예정 과제가 없으면 빈 상태를 표시하며 기존 마감 후 제출 제한을 유지합니다. 최근 공지는 상단 과제·통계 두 열 다음의 독립된 전체 너비 행에 32px 간격으로 배치하며, 최근 제출물과 최근 활동은 넓은 화면에서 2열, 좁은 화면에서 1열입니다. 공지·제출·활동은 열린 섹션과 행으로 구성하며, 과제 목록도 카드 그리드 대신 마감·제출 상태를 비교하는 목록을 사용합니다. Admin은 검토 대기 수와 제출 목록을 중심으로 구성합니다. 일반 정보마다 카드·아이콘을 추가하지 않습니다.

Anime.js의 `outCubic`을 유지합니다. 페이지는 90ms 퇴장 후 180ms 진입, 제목 전체는 160ms fade와 2px 이동만 사용하고 문자 stagger는 실행하지 않습니다. 필터로 이동하는 항목은 200ms, 새 항목은 180ms로 표시합니다. 주요 카드 hover는 -1px, 버튼 press는 0.985입니다. 대시보드·운영·프로필 수치는 즉시 표시하며 과제 진행률이나 진행 바는 사용하지 않습니다. Sidebar는 경로 이동마다 재등장하지 않습니다. Drawer와 Modal은 닫힘 후 제거하고 Tab/Shift+Tab 내부 순환·포커스 복귀·Escape·배경 스크롤 잠금을 처리합니다. 낮은 화면에서는 Drawer 내부를 스크롤해 하단 메뉴에 접근합니다. 실행 중 모션 감소 설정을 변경해도 콘텐츠와 최종 상태를 즉시 복원합니다.

Anime.js API는 설치된 v4 계열과 [공식 React 통합 문서](https://animejs.com/documentation/getting-started/using-with-react/), [Scope cleanup](https://animejs.com/documentation/scope/scope-methods/revert/)를 기준으로 구성했습니다.

## 공개 페이지와 데모 로그인

미인증 상태에서 LMS 또는 프로토타입 URL에 진입하면 `/login`으로 이동합니다. 로그인 후 원래 경로와 검색 조건으로 복귀하며, 외부 주소를 복귀 경로로 사용하지 않습니다. 공개 페이지에는 Sidebar가 표시되지 않습니다. 로그인 상태에서는 랜딩 CTA가 대시보드 이동으로 바뀝니다.

데모 계정은 **학번 `20240031` / 비밀번호 `RceDemo2026!`** 입니다. 로그인 화면의 데모 계정 입력 버튼으로 채울 수 있습니다. 운영진이 발급한 실제 계정으로 인증하는 서버는 아직 연결하지 않았습니다. 현재 인증 adapter는 비동기 성공·실패·취소 상태를 검증하기 위한 Mock입니다. `sessionStorage`의 `rce-lms-auth-v1`에는 `{userId: "hanna"}`만 저장하고 입력한 비밀번호는 저장하지 않습니다. Sidebar의 로그아웃으로 세션을 종료합니다. 서버 연동 시 서버 세션 검증과 접근 권한 확인으로 교체해야 합니다.

Hero는 한 번의 1초 내외 timeline으로 로고와 문구를 표시하고 CTA는 즉시 사용할 수 있습니다. SVG signal은 데스크톱 최대 4개, 모바일 2개만 움직이며, 화면 밖·숨겨진 탭·일시 정지 상태에서는 멈춥니다. Pointer 효과는 마우스를 지원하는 데스크톱에만 적용합니다. 모션 감소 환경에서는 모든 정보가 즉시 표시되고 반복 signal과 parallax가 제거됩니다. 미리보기와 workflow는 스크롤에 연결되며 observer·listener·animation은 이탈 시 정리합니다.

기존 1.5MB PNG는 원본으로 보존합니다. 표시용 파생본은 `rce-logo-hero.webp` 약 79KB, `rce-logo-small.webp` 약 10KB이며 기존 로고를 재디자인하지 않습니다.

## 과제·제출·학생 정보

분야는 `웹해킹`, `포너블`, `리버싱`, `포렌식` 네 개이며 학생의 `track`은 하나만 가집니다. 기본 데모 계정 Hanna는 웹해킹입니다. 운영진의 **학생 관리 → 배정 분야**에서 변경하며 계정 설정에서는 읽기만 가능합니다. 학생 관리 목록은 전체 또는 분야별로 조회합니다. 활성/비활성 표시는 Sidebar 하단 계정 영역에만 둡니다.

과제는 공통 학습 공간에 공개됩니다. 분야·주차·수행 항목·진행률은 과제 데이터에 없습니다. `selectLearningData(state, userId)`가 사용자별 제출 기록으로 `미제출`과 `제출 완료`를 계산합니다. 공지는 전체 공지와 해당 계정의 분야 공지만 제공합니다. 제출 검토는 `검토 대기`와 `검토 완료`로 구분하며 운영진은 과제·학생 분야·검토 상태·검색어를 조합해 조회할 수 있습니다.

과제 본문과 첨부파일은 별도 데이터입니다. 본문에서 파일을 자동으로 만들지 않으며 관리자가 선택한 자료만 첨부됩니다. 제출 파일을 먼저 선택하고 메모 및 질문은 선택적으로 작성합니다. 파일만 또는 메모만 제출할 수 있고 둘 다 비어 있으면 제출할 수 없습니다.

저장 형식은 version 3입니다. 기존 `rce-lms-demo-v1` 키를 유지하며 version 1/2의 사용자·과제 본문·제출·피드백·설정을 이전합니다. 과제의 폐기 필드와 자동 생성 첨부만 제거하고 실제 저장 파일 참조는 보존합니다. 이전 검토 상태는 피드백을 보존한 검토 완료 또는 검토 대기로 이전합니다. 활동은 과제 ID와 제출/피드백 종류로 분리합니다.

## 분야별 순위

`calculateLeaderboard(state, track)`은 학생의 현재 `user.track`으로 그룹을 나눕니다. 분야에 속한 계정은 역할·활성 여부와 관계없이 포함합니다. 각 `userId + assignmentId`의 최신 `submittedAt` 하나를 고르고, 그 제출이 `reviewed`이며 유효한 0~100점일 때만 합산합니다. 같은 시각이면 제출 ID의 사전순으로 최신 건을 결정해 입력 배열 순서에 영향을 받지 않습니다. 재제출이 `pending`이거나 점수가 `null`이면 이전 점수도 보류합니다. 미제출에 별도 감점은 없습니다.

총점 → 반올림하지 않은 평균 → 채점 완료 과제 수 내림차순, 이름 → 학번 → 사용자 ID 오름차순으로 정렬합니다. 명시적인 0점은 채점 완료로 계산하고, 채점 기록이 없는 계정은 순위 없이 `— / 미채점`으로 표시합니다. 순위 분모는 채점된 학생 수입니다. 이메일·전체 학번·가입일은 순위 결과와 화면에 포함하지 않습니다.

일반 학생에게는 자신의 분야만 표시하며 다른 분야의 query도 무시합니다. 운영진은 네 분야를 전환할 수 있습니다. Desktop은 표, 모바일은 가로 스크롤 없는 Compact Row를 사용합니다. 1~3위는 서로 다른 낮은 강도의 Platinum / Silver / Gunmetal 배경과 순위 숫자로 표시하고, 현재 사용자는 `나`와 얇은 왼쪽 선으로 구분합니다.

Dashboard의 내 순위와 Profile 통계는 같은 `calculateStudentRanking` 결과를 사용합니다. Admin 검토에서 점수가 바뀌면 현재 상태에서 즉시 다시 계산하며 순위·점수를 별도로 저장하지 않습니다. 기존 Page·FilterBar·AnimatedList와 Anime.js 모션 감소·cleanup 처리를 재사용합니다.

## 프로필 사진과 파일 저장

`src/data/fileStore.ts`가 실제 Blob을 IndexedDB `rce-lms-files-v1`에 저장합니다. 컴포넌트는 파일 선택 중에만 `File`을 보유하며 저장 시 ID·파일명·크기·형식 메타데이터를 상태에 연결합니다. 다운로드는 저장된 원본 Blob을 사용하고 object URL은 정리합니다. 실제 원본이 없는 과거 데모 제출 파일은 그 사실을 표시합니다.

프로필에서 PNG/JPEG/WebP, 최대 5MB, 가로·세로 최소 256px 이미지를 선택할 수 있습니다. 드래그·키보드 방향키·위치 슬라이더·확대로 자를 영역을 조절한 뒤 Canvas에서 512 × 512 PNG로 저장합니다. 추가 라이브러리는 사용하지 않습니다. 취소하면 기존 사진을 유지하고 삭제하면 기본 Avatar로 돌아갑니다. 프로필·Sidebar·Dashboard는 공통 `UserAvatar`를 사용합니다.

파일은 저장 성공 전까지 기존 원본을 유지합니다. 메타데이터 저장 실패 시 변경을 거부하고 새 Blob을 정리하며, 저장 취소나 화면 이탈 시에도 미완료 파일을 정리합니다. 이 저장소는 현재 브라우저에만 적용되며 다른 기기와 동기화하지 않습니다.

## 앱 색상과 Typography

로그인 이후 `.app-shell`과 로그인 화면은 독립 토큰 범위를 사용합니다. 공개 Landing의 배경·글자 크기·레이아웃은 유지하며, 앱은 가장 어두운 canvas에서 navigation, workspace, card, interaction 순서로 밝아집니다.

| 역할 | 토큰 | 색상 |
| --- | --- | --- |
| Application background | `--surface-app` | `hsl(220 16% 3.7%)` |
| Sidebar / mobile drawer | `--surface-sidebar` | `hsl(220 19% 5.2%)` |
| Main workspace | `--surface-workspace` | `#101318` |
| Section / card | `--surface-card` | `#191E26` |
| Hover / selected | `--surface-interactive` | `#191E26` |

주요 텍스트 `#EAEDF0`, 보조 텍스트 `#A8AEB8`, 동작·링크·선택 `#8ACBD8`, 마감 임박 `#E3B66F`, 제출·검토 완료 `#83BEA3`, 피드백 도착은 동작과 동일한 시안 `#8ACBD8`, 기한 초과·오류 `#E89292`로 역할을 구분합니다. 일반 미제출·검토 대기는 중립색이며 상태 문구를 함께 표시합니다. 기본 배경과 카드 위의 일반 텍스트 대비는 모두 AA(4.5:1 이상)를 충족합니다. 채워진 오류 버튼과 활성 스위치에는 어두운 전경색을 사용합니다. Silver 경계선은 `--border-subtle/default/strong`을 유지합니다. 메뉴 선택은 낮은 밝기의 surface와 얇은 cyan indicator·아이콘으로 표현합니다. 일반 섹션에는 배경·그림자를 추가하지 않고, 주요 과제 surface에만 4px radius를 사용합니다. 공개 랜딩의 브랜드 비주얼과 상태 배지는 유지합니다.

무채색 빛은 `.app-shell` 안의 `--silver-soft`, `--silver-bright`, `--platinum`, `--gunmetal`과 `--gradient-workspace/rule/number/highlight/rank-first/rank-second/rank-third`로 관리합니다. 미제출·내 순위 숫자, 주요 구분선, 순위 Top 3·현재 사용자 행·선택된 분야 필터에만 적용합니다. Workspace 빛의 최대 불투명도는 Desktop 2.5%, 모바일 1.5%이며 그라데이션 자체는 움직이지 않습니다. 본문·제목·일반 카드에는 그라데이션을 적용하지 않습니다.

본문·메뉴·Form·Table은 **SUIT Variable 400–700**, 페이지 제목·섹션 제목·큰 숫자는 **Wanted Sans Variable 600–700**을 사용합니다. UI는 정돈된 한글 가독성을, 제목은 더 뚜렷한 문자 조형을 담당합니다. CSS 변수 `--font-sans/display/mono`와 Tailwind `font-sans/display/mono`로 관리합니다. `app-title`, `app-section-title`, `app-item-title`, `app-number`, `app-meta`, `app-eyebrow`가 크기·굵기·자간·행간의 역할을 나눕니다. 숫자는 tabular figures를 사용하고 monospace는 학번·ID·기술 메타데이터에 제한합니다.

폰트는 공식 OFL 원본을 `src/assets/fonts`에 자체 호스팅하며 `font-display: swap`을 사용합니다. SUIT는 variable 파일 하나, Wanted Sans는 공식 Unicode 분할 파일 중 현재 화면에 필요한 범위만 요청합니다. 공개 Landing은 기존 폰트를 유지하므로 새 웹폰트를 요청하지 않습니다. 원본 출처·버전·파일 해시·라이선스는 해당 폴더의 README와 manifest에 기록했습니다.

## Mock 동작과 API 연결 경계

백엔드 및 인증 서버는 연결하지 않았습니다. 현재 사용자는 fixture의 `hanna`이며 학습 및 운영 기능을 확인할 수 있습니다. 변경은 이 브라우저의 `rce-lms-demo-v1` localStorage에 저장됩니다. 새로고침해도 제출·검토·설정이 유지됩니다. 초기 데이터를 복원하려면 해당 키를 삭제하고 새로고침합니다. 손상된 저장 데이터는 fixture로 복구합니다.

과제/제출 첨부는 PDF·MD·TXT·ZIP·PNG·JPEG·WebP를 파일당 10MB, 최대 5개까지 검증하고 실제 원본을 브라우저에 저장합니다. 서버 업로드와 기기 간 공유는 아직 연결하지 않았습니다. 비밀번호는 입력 검증만 수행하고 저장하지 않습니다. 알림은 수신 설정만 저장하며 발송하지 않습니다.

Spring Boot 연동 시 `LMSContext`의 mutation과 fixture 초기 로딩을 API adapter로 교체하고 인증, 서버 권한 검사, 파일 업로드, 알림 전송을 추가하면 됩니다. 현재 UI의 Role 선택은 서버 접근 권한을 부여하는 기능이 아닙니다.
