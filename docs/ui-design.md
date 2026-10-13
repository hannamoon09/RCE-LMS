# UI 디자인과 모션

기존 React 화면의 로고, 레이아웃, semantic token, Radix 기반 컴포넌트와 Anime.js 모션을 유지한 구현 기록입니다. 실제 계정·과제·제출·공지·순위·파일·설정은 서버 API를 사용하며, 이 문서는 표현 방식만 설명합니다.

## 디자인과 모션

기존 `theme.css`의 canvas → navigation → workspace → card → interactive 위계를 사용합니다. Workspace에는 낮은 불투명도의 정적 Silver 빛을 더하고, `01 / DASHBOARD`처럼 번호가 붙은 섹션 라벨에는 얇은 Graphite → Silver → Graphite 구분선을 사용합니다. Sidebar와 일반 카드는 단색이며 제목은 Off White를 유지합니다. 청록 accent는 상태·마감 임박·포커스에 제한합니다. SUIT와 Wanted Sans의 크기·굵기·자간으로 정보의 우선순위를 구분합니다.

대시보드는 제출 가능한 과제 중 마감이 가장 가까운 한 개를 주요 카드로 강조하고, 실제 마감 날짜에 따라 오늘 마감·마감 임박·기한 초과를 표시합니다. 과제 확인은 기존 상세 경로로 연결됩니다. 사용자 이름은 Desktop 최대 40px, 미제출 수는 최대 64px이며 보조 정보는 13~14px입니다. 모바일에서는 다음 과제부터 확인할 수 있습니다. 마감 전 미제출은 가까운 마감순으로 다음 과제에, 기한 지난 미제출은 별도 목록에 최근 마감순으로 각각 최대 3개 표시합니다. 예정 과제가 없으면 빈 상태를 표시하며 기존 마감 후 제출 제한을 유지합니다. 최근 공지는 상단 과제·통계 두 열 다음의 독립된 전체 너비 행에 32px 간격으로 배치하며, 최근 제출물과 최근 활동은 넓은 화면에서 2열, 좁은 화면에서 1열입니다. 공지·제출·활동은 열린 섹션과 행으로 구성하며, 과제 목록도 카드 그리드 대신 마감·제출 상태를 비교하는 목록을 사용합니다. Admin은 검토 대기 수와 제출 목록을 중심으로 구성합니다. 일반 정보마다 카드·아이콘을 추가하지 않습니다.

Anime.js의 `outCubic`을 유지합니다. 페이지는 90ms 퇴장 후 180ms 진입, 제목 전체는 160ms fade와 2px 이동만 사용하고 문자 stagger는 실행하지 않습니다. 필터로 이동하는 항목은 200ms, 새 항목은 180ms로 표시합니다. 주요 카드 hover는 -1px, 버튼 press는 0.985입니다. 대시보드·운영·프로필 수치는 즉시 표시하며 과제 진행률이나 진행 바는 사용하지 않습니다. Sidebar는 경로 이동마다 재등장하지 않습니다. Drawer와 Modal은 닫힘 후 제거하고 Tab/Shift+Tab 내부 순환·포커스 복귀·Escape·배경 스크롤 잠금을 처리합니다. 낮은 화면에서는 Drawer 내부를 스크롤해 하단 메뉴에 접근합니다. 실행 중 모션 감소 설정을 변경해도 콘텐츠와 최종 상태를 즉시 복원합니다.

Anime.js API는 설치된 v4 계열과 [공식 React 통합 문서](https://animejs.com/documentation/getting-started/using-with-react/), [Scope cleanup](https://animejs.com/documentation/scope/scope-methods/revert/)를 기준으로 구성했습니다.

## 공개 랜딩

Hero는 한 번의 1초 내외 timeline으로 로고와 문구를 표시하고 CTA는 즉시 사용할 수 있습니다. SVG signal은 데스크톱 최대 4개, 모바일 2개만 움직이며, 화면 밖·숨겨진 탭·일시 정지 상태에서는 멈춥니다. Pointer 효과는 마우스를 지원하는 데스크톱에만 적용합니다. 모션 감소 환경에서는 모든 정보가 즉시 표시되고 반복 signal과 parallax가 제거됩니다. 기능 안내 패널과 workflow는 스크롤에 연결되며 observer·listener·animation은 이탈 시 정리합니다.

공개 랜딩의 `ProductPreview`는 과제 확인·실습 제출·피드백·공지 기능을 설명하는 패널입니다. 가짜 과제 제목·마감·제출 수·공지·피드백 데이터는 표시하지 않습니다. 기존 배치와 스크롤 모션은 유지하며 실제 학습 정보는 로그인 후 서버 API로 확인합니다.

기존 1.5MB PNG는 원본으로 보존하며 배포 번들에는 포함하지 않습니다. 표시용 파생본은 `rce-logo-hero.webp` 약 79KB, `rce-logo-small.webp` 약 10KB이며 기존 로고를 재디자인하지 않습니다.

## 프로필 이미지 편집

프로필에서 PNG/JPEG/WebP, 최대 5MB, 가로·세로 최소 256px 이미지를 선택할 수 있습니다. 드래그·키보드 방향키·위치 슬라이더·확대로 자를 영역을 조절한 뒤 Canvas에서 512 × 512 PNG로 저장합니다. 추가 라이브러리는 사용하지 않습니다. 취소하면 기존 사진을 유지하고 삭제하면 기본 Avatar로 돌아갑니다. 프로필·Sidebar·Dashboard는 공통 `UserAvatar`를 사용합니다.

편집 중 선택한 파일은 메모리에만 두며 저장할 때 서버로 업로드합니다. 표시용 Blob은 인증된 파일 API에서 받고, 임시 object URL은 화면 이탈이나 이미지 교체 시 정리합니다. 메타데이터·원본 저장 및 실패 복구 정책은 [Profile API](profile-api.md)와 [File API](file-api.md)를 따릅니다.

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

무채색 빛은 `.app-shell` 안의 `--silver-soft`, `--silver-bright`, `--platinum`, `--gunmetal`과 `--gradient-workspace/rule/number/highlight/rank-first/rank-second/rank-third`로 관리합니다. 미제출·내 순위 숫자, 주요 구분선, 순위 Top 3·현재 사용자 행·선택된 목록 필터에만 적용합니다. Workspace 빛의 최대 불투명도는 Desktop 2.5%, 모바일 1.5%이며 그라데이션 자체는 움직이지 않습니다. 본문·제목·일반 카드에는 그라데이션을 적용하지 않습니다.

본문·메뉴·Form·Table은 **SUIT Variable 400–700**, 페이지 제목·섹션 제목·큰 숫자는 **Wanted Sans Variable 600–700**을 사용합니다. UI는 정돈된 한글 가독성을, 제목은 더 뚜렷한 문자 조형을 담당합니다. CSS 변수 `--font-sans/display/mono`와 Tailwind `font-sans/display/mono`로 관리합니다. `app-title`, `app-section-title`, `app-item-title`, `app-number`, `app-meta`, `app-eyebrow`가 크기·굵기·자간·행간의 역할을 나눕니다. 숫자는 tabular figures를 사용하고 monospace는 학번·ID·기술 메타데이터에 제한합니다.

폰트는 공식 OFL 원본을 `frontend/src/assets/fonts`에 자체 호스팅하며 `font-display: swap`을 사용합니다. SUIT는 variable 파일 하나, Wanted Sans는 공식 Unicode 분할 파일 중 현재 화면에 필요한 범위만 요청합니다. 공개 Landing은 기존 폰트를 유지하므로 새 웹폰트를 요청하지 않습니다. 원본 출처·버전·파일 해시·라이선스는 해당 폴더의 README와 manifest에 기록했습니다.

## 기존 경로와 회귀 검증

공개 랜딩, 로그인, 학습자·운영진 화면을 유지합니다. 최종 대시보드의 레이아웃은 `frontend/src/pages/Dashboard.tsx`에서 `/dashboard`로 제공하며, `/prototypes`, `/dashboard/a`~`/dashboard/d` 비교 경로·내비게이션·전용 컴포넌트는 제거했습니다. 이전 비교 주소는 페이지를 찾을 수 없다는 안내를 표시합니다. 운영진의 FIELD는 읽기 전용이며 다른 분야 선택이나 역할 승격 UI는 제공하지 않습니다. 순위는 Desktop 표와 모바일 행 레이아웃을 유지하되 실제 서버의 현재 분야 순위를 표시합니다.

`public.spec.ts`, `workspace-motion.spec.ts`, `lms.spec.ts`는 공개 페이지, 키보드, 제목 접근성, 빠른 경로 이동, Sidebar 유지, 모바일 Drawer 포커스, 모션 감소와 여섯 화면 폭을 검증합니다. `profile-crop-api.spec.ts`는 자르기 픽셀 결과, 드래그·키보드·확대, 취소와 모바일 배치를 실제 업로드·다운로드와 함께 검증합니다. 기존 반응형 검사에는 삭제된 비교 경로의 안내 화면 검증을 남겼고, 공개 랜딩 검사는 기능 안내가 가짜 업무 데이터를 표시하지 않는지도 확인합니다. 과제·공지 목록에서는 실제 데이터 0건과 검색 결과 0건을 구분합니다. 최신 검사 결과는 [운영 정리 감사 보고서](production-cleanup-audit.md), 이전 검사 기록과 스크린샷은 [구현 진행 기록](implementation-progress.md), [verification](verification/)에 있습니다.
