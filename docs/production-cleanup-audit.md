# RCE LMS 운영 정리 감사 보고서

2026-10-13 기준. Phase 1~12 이후의 Mock·개발 데이터·브라우저 저장소·미사용 코드와 운영 설정을 감사했습니다. 기존 미커밋 변경사항과 프론트엔드/백엔드 폴더 분리를 보존하고, 검색 → 용도 판단 → 참조 확인 → 제거 또는 격리 → 빌드 → 테스트 순서로 처리했습니다. 새 기능, 새 역할·분야·인증 방식이나 UI 리디자인은 추가하지 않았습니다.

코드·문서 정리와 요청된 검증을 완료했습니다. 중단 전에 통과한 검사 기록을 보존하고 미완료 검사만 이어서 확인했습니다. 서로 다른 백엔드 검사 94개와 브라우저 검사 93개가 통과했습니다. 외부 운영 서버 배포는 수행하지 않았습니다. 실행 방법은 [README](../README.md), 이전 구현 이력은 [구현 진행 기록](implementation-progress.md)을 참고하세요.

## Removed Runtime Mock

Phase 1~12에서 제거된 `mockAuth`, 고정 현재 사용자, 운영용 fixture, localStorage LMS 데이터베이스, IndexedDB `fileStore`, 클라이언트 임의 순위 계산이 런타임에 다시 들어오지 않았음을 확인했습니다. 현재 인증은 `/api/auth/me`와 Spring Security Session에서 복구합니다.

이번 정리에서는 [landingData.ts](../frontend/src/data/landingData.ts)의 `previewStats`, `previewAssignments`, `previewNotices`, `previewFeedback`를 제거했습니다. [ProductPreview](../frontend/src/components/landing/ProductPreview.tsx)는 동일한 배치와 스크롤 모션 안에서 과제·제출·피드백·공지 기능만 설명합니다. 가짜 학생 이름·과제 제목·마감·제출 수·공지·피드백을 표시하지 않습니다.

[LMSContext](../frontend/src/data/LMSContext.tsx)는 계정별 API 응답, 요청·오류·수정 상태를 메모리에만 보유합니다. API 실패 시 Mock으로 전환하지 않고 오류와 재시도를 표시하며, 401은 인증 상태를 해제합니다. 순위는 실제 서버 응답만 사용합니다.

## Removed Development Data

공개 랜딩에 남아 있던 가짜 업무 데이터를 제거했습니다. 정적 내비게이션, 상태 라벨, 기능 설명, 브랜드 네트워크 도형은 실제 표현 요소이므로 유지했습니다.

개발 계정을 만드는 코드는 유용한 로컬 개발 도구로 유지하되 운영 프로필에서 실행될 수 없도록 격리를 강화했습니다. 기존 PostgreSQL의 계정이나 과제는 임시 데이터로 단정하여 삭제하지 않았습니다. 테스트 fixture도 테스트의 목적과 사용 참조를 확인한 뒤 유지했습니다.

## Browser Storage

| 항목 | 현재 사용과 목적 |
| --- | --- |
| localStorage | 런타임 사용 없음. 업무 데이터 및 UI preference 영구 저장 없음 |
| sessionStorage | 런타임 사용 없음. 인증·현재 사용자 저장 없음 |
| IndexedDB | 런타임 사용 없음. 파일 원본·메타데이터 저장 없음 |
| React Context/state | 현재 계정의 API 결과, 로딩·오류 상태, 저장 전 입력만 임시 보유 |
| File/Blob/object URL | 파일 선택·이미지 자르기·인증된 다운로드의 메모리 객체. 교체·이탈 시 URL 정리 |
| 쿠키 | 실제 서버의 세션·CSRF 쿠키. Mock 인증이나 업무 데이터 저장소가 아님 |

예전 브라우저 저장소에 남아 있는 값은 읽거나 서버로 가져오지 않습니다. `frontend/tests/tracks.spec.ts`에 남은 위조 저장소 입력은 이 원칙을 검증하는 테스트 전용 데이터입니다.

## Backend Seed

[DevelopmentSeed.java](../backend/src/main/java/com/rce/lms/user/DevelopmentSeed.java)의 실행 조건은 다음과 같습니다.

```text
dev & !test & !prod & !production
```

개발 비밀번호 환경 변수가 설정되어야 개발용 STAFF 1개와 분야별 MEMBER 4개를 생성합니다. 기존 학번의 계정과 비밀번호는 덮어쓰지 않습니다. 비밀번호는 코드의 기본값이 아니라 환경 변수에서 받아 해시합니다.

`prod` 또는 `production`이 선택되면 `dev`가 함께 있어도 seed가 실행되지 않습니다. 일반 운영 시작은 STAFF·MEMBER·과제·제출·공지·순위용 데이터를 자동 생성하지 않습니다. Flyway V1~V7은 보존하며 개발 데이터 삭제용 migration을 추가하지 않았습니다.

## STAFF Provisioning

최초 운영 STAFF는 [신뢰된 운영자 계정 발급 절차](staff-provisioning.md)를 명시적으로 실행하여 발급합니다. 같은 Spring PasswordEncoder로 생성한 해시와 운영자가 확인한 학번·분야 등을 파라미터 바인딩으로 등록하고 결과를 확인합니다. 기본 비밀번호, 공개 가입, STAFF 생성·승격 API, 전역 관리자 역할은 제공하지 않습니다.

운영 DB와 파일 경로를 배포 환경에서 주입한 뒤 프로젝트 루트에서 다음과 같이 실행합니다. 비밀번호나 다른 비밀 값을 명령에 넣지 않습니다.

```sh
SPRING_PROFILES_ACTIVE=prod java -jar backend/build/libs/rce-lms-backend-0.1.0.jar
```

`production`도 동일한 운영 프로필 별칭입니다. 운영진 발급은 이 서버 실행과 별도의 운영자 작업이며, 개발 seed를 운영 초기화 수단으로 사용하지 않습니다.

## Dead Code

런타임과 테스트 참조를 먼저 확인하고 다음을 정리했습니다.

- 비교 전용 `FocusPanel.tsx`, `RouteTabs.tsx`, `DesignSelector.tsx`, `useDashboardAnimation.ts` 및 `NoticeActivity`의 비교 화면용 wrapper.
- 사용되지 않는 `Progress`, `Tooltip`, Card 하위 컴포넌트, `useReveal`, `useAnimatedNumber`, `AnimatedNumber`, `isTrack`, `AuthContext.refreshUser` 및 중복 export.
- 비교 화면만 사용하던 레이아웃·appearance props와 CSS, `designOptions`.
- 사용되지 않는 `@radix-ui/react-tooltip` 의존성과 관련 하위 패키지.

최종 화면에 필요한 Anime.js, 프로필 자르기·키보드·드래그 기능, 실제 API DTO, 서버 데이터 selector는 유지했습니다. 정리 후 런타임 진입점에서 도달 불가능한 TypeScript 모듈과 비교 화면 번들이 없음을 확인했습니다.

원본 로고 PNG는 브랜드 자산 원본으로 보존하지만 배포 번들에는 포함하지 않습니다. 화면에는 기존 WebP 파생본을 사용합니다. 폰트 원본·출처·라이선스는 실제 글꼴 사용과 라이선스 준수를 위해 유지합니다.

## Prototype Cleanup

`/prototypes`, `/dashboard/a`, `/dashboard/b`, `/dashboard/c`, `/dashboard/d`의 비교 라우트와 내비게이션을 제거했습니다. `DashboardB.tsx`, `DashboardC.tsx`, `DashboardD.tsx`도 삭제했습니다.

확정된 Dashboard A의 실제 레이아웃은 [Dashboard.tsx](../frontend/src/pages/Dashboard.tsx)로 이름을 정리하여 `/dashboard`에서 유지합니다. 예전 비교 주소는 로그인 후 기존 페이지를 찾을 수 없다는 안내를 표시합니다. 공개 랜딩은 디자인 비교용 서비스가 아니라 기존 기능 안내 화면으로 유지됩니다.

과제·공지·운영진 과제 목록은 실제 데이터 0건과 검색 결과 0건을 구분합니다. 과제는 `등록된 과제가 없습니다`, 공지는 `아직 공지가 없습니다`로 안내하며, 대시보드·제출·활동·순위의 기존 빈 상태와 0점 표시도 유지합니다.

## Security Cleanup

[application.yaml](../backend/src/main/resources/application.yaml)과 [application-dev.yaml](../backend/src/main/resources/application-dev.yaml)에 운영·개발 설정의 경계를 명시했습니다.

| 항목 | 운영 상태 |
| --- | --- |
| 개발 seed | `prod`·`production` 활성 시 실행 안 됨. 혼합 프로필 순서와 무관 |
| 세션·CSRF 쿠키 | Secure `true`. 로컬 `SESSION_COOKIE_SECURE=false`를 운영 설정에 적용하지 않음 |
| DB 연결 | 환경 변수 사용. 코드·공개 문서에 운영 접속 비밀 없음 |
| 파일 저장 | 웹 루트 밖의 `FILE_STORAGE_PATH` 필수 |
| 스키마 | Flyway ON, Hibernate `ddl-auto=validate` 유지 |
| 인증·권한 | 실제 Session·CSRF와 서버의 역할·분야·활성 상태 검사 유지 |
| 로그 | debug OFF, SQL 출력 OFF. 비밀번호·세션 ID·CSRF 값 출력 없음 |
| 공개 파일 | 빌드한 `frontend/dist/`만 배포. Vite는 backend와 비공개 파일 저장 경로 직접 접근 차단 |

`/api/debug/**`, `/api/test/**`, `/api/dev/**`, CSRF 비활성화, CORS wildcard, 인증 우회는 발견되지 않았습니다. `permitAll`은 health·CSRF 발급·로그인 및 오류 dispatcher 처리에 필요한 범위로 유지합니다. 해당 로그인 요청에도 CSRF 검증은 적용됩니다. 실제 `.env`와 업로드·빌드·로그 파일은 Git 제외 대상이고 `.env.example`은 변수 이름만 제공합니다.

의존성 감사에서 운영 의존성 경고는 0건입니다. `source-map-js`는 보안 수정 버전 1.2.2로 갱신했습니다. 이 버전은 인덱스 source map으로 인한 이벤트 루프 차단 문제를 수정합니다. [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)

개발·빌드 도구에는 경고 7건(높음 5, 중간 2)이 남아 있습니다. 이는 서로 다른 취약점 7개라는 뜻이 아니라 영향받는 의존성 경로를 포함한 npm 집계입니다. `braces` 3.0.3의 중첩 패턴 처리 문제는 감사 시점에 수정 버전이 없으며, `postcss-selector-parser` 6.1.4의 CPU 소모 문제는 7.1.6에서 수정되었습니다. 현재 Tailwind 3 의존성 범위에는 후자의 주 버전 변경이 포함되지 않습니다. [braces 공지](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [postcss-selector-parser 공지](https://github.com/advisories/GHSA-rj75-hqrm-r3gf)

이 패키지들은 개발 의존성이며 사용자 업무 데이터를 처리하는 Spring Boot나 배포된 React 번들에서 실행되지 않습니다. 다만 개발·빌드 환경의 경고는 미해결로 남깁니다. 기존 UI와 빌드 체계를 유지하는 cleanup 범위에서 Tailwind 4 전환이나 강제 의존성 교체는 수행하지 않았습니다.

## Database

일반 개발 DB `rce_lms`에서 확인한 기존 계정 6개와 과제 1개를 삭제하거나 수정하지 않았습니다. 사용자 DB에 `DROP TABLE`, `TRUNCATE`, 전체 삭제를 실행하지 않았으며 Flyway V1~V7 파일과 migration history도 변경하지 않았습니다.

데이터·migration의 사전 기록과 최종 해시 대조 상태: **PASS**. 2026-10-13 개발 DB의 9개 업무 테이블 전체 행 지문이 감사 시작 시점과 동일하며 Flyway 파일 7개의 SHA-256도 모두 일치했습니다. 사용자 계정 6개와 과제 1개가 그대로 유지됩니다. 실제 로컬 DB·개발 seed 비밀 값이 소스·공개 문서·프론트 빌드 결과에 포함되지 않은 것도 확인했습니다.

테스트는 전용 `rce_lms_test`와 폐기 가능한 `rce_lms_e2e`만 사용합니다. E2E 스크립트의 스키마 초기화는 후자의 고정된 DB 이름에만 적용되며 일반 `DB_URL`을 초기화하지 않습니다. 이 테스트 환경 정리는 사용자 데이터 삭제와 구분합니다.

## Tests

| 검증 | 상태 | 근거·범위 |
| --- | --- | --- |
| 백엔드 기존 회귀 89개 | PASS | 기존 기능·권한·파일·순위·프로필·알림 설정 검사 |
| 운영·개발 혼합 프로필 4개 | PASS | `prod,dev`, `dev,prod`, `production,dev`, `dev,production`의 seed 차단·운영 설정 확인 |
| 백엔드 실제 재시작 1개 | PASS | 실제 서버 종료·재기동 후 사용자·과제·제출·87점·피드백·공지·순위 유지. 이전 세션 만료 후 재로그인과 독립 클라이언트도 확인 |
| 신규 clean-browser 검사 2개 | PASS | 저장소 없는 브라우저, 빈 화면, 실제 제출→검토→순위, 새로고침·독립 세션·로그아웃, API 실패·재시도 |
| 브라우저 전체 회귀 93개 | PASS | 첫 15개와 별도 신규 2개 통과 기록을 보존하고, 중단·미실행 76개만 재개하여 모두 통과(6.0분) |
| 사용자 DB·migration 최종 보존 대조 | PASS | 9개 테이블 행 지문과 Flyway 파일 7개 모두 감사 시작 시점과 일치 |
| `git diff --check` | PASS | 코드·문서 변경 공백 검사 |

신규 검사 2개는 전체 브라우저 검사에 포함되므로 별도로 더해 전체 통과 수를 계산하지 않습니다. 기존 통과 결과와 중단 이후 미확인 결과를 구분하여 기록합니다.

백엔드 전체 94개 중 최초 실행에서는 기존 89개와 혼합 프로필 4개가 통과했습니다. 재시작 테스트의 반복 CSRF 조회가 매번 새 쿠키를 발급해야 한다는 잘못된 기대를 수정한 후 신규 5개를 재검증하여 모두 통과했습니다. 기존 89개는 반복하지 않았으며, 최종 `test/build`는 성공했습니다(21초). 수정 후에도 실제 수신하는 CSRF 쿠키의 Secure/SameSite/Path 검증은 유지합니다.

[production-cleanup.spec.ts](../frontend/tests/production-cleanup.spec.ts)는 실제 API만으로 clean browser의 학습 흐름과 오류 UI를 확인합니다. [ProductionRestartIntegrationTest.java](../backend/src/test/java/com/rce/lms/ProductionRestartIntegrationTest.java)는 독립적인 서버 시작·종료와 실제 HTTP 요청을 통해 영속성·운영 설정을 확인합니다. 기본 세션은 서버 메모리에 저장되므로 서버 재시작 후에는 다시 로그인해야 하며, 영속 업무 데이터 유지와 세션 유지는 별개입니다.

기존 테스트의 목적을 약화시키지 않았습니다. 비교 화면 테스트는 제거된 주소의 안내 화면과 비교 내비게이션 부재를 확인하도록 조정하고, 실제 운영 화면의 여섯 화면 폭·키보드·모바일·모션 회귀는 유지했습니다.

## Build

```text
Frontend build: PASS
Backend test: PASS — 서로 다른 94개 검사 검증 완료
Backend build: PASS
Smoke test: PASS — 신규 실제 API/browser 검사 2개
Full browser regression: PASS — 서로 다른 93개 검사 검증 완료
```

프론트엔드는 TypeScript 검사와 Vite 빌드를 통과했으며 Vite 단계는 2.58초입니다. 실제 로컬 개발 백엔드도 최신 코드로 재시작한 후 DB 전체 행 지문이 동일한지 다시 확인했습니다. Vite 프록시를 통한 health, CSRF·STAFF 로그인·도메인 조회·로그아웃도 통과했습니다. 배포 JAR에 테스트 클래스·테스트 설정이 없고, 프론트 번들에 제거한 비교 경로·운영 Mock 식별자가 없음을 확인했습니다. 실제 운영 호스트·도메인·TLS 배포는 수행하지 않았습니다.

검사별 통과 기록과 집계는 [검증 결과 JSON](verification/production-cleanup-results.json)에 보존했습니다. 이는 중단 전·후 실행 결과를 합친 기록이며, 전체 93개를 한 번에 다시 실행했다고 주장하지 않습니다.

## Runtime Data Source

| 데이터 | 원본 |
| --- | --- |
| Auth | Spring Security Session → `/api/auth/me` → AuthContext |
| Users | PostgreSQL |
| Assignments | PostgreSQL |
| Submissions | PostgreSQL |
| Notices | PostgreSQL |
| Scores | PostgreSQL의 실제 검토 완료 점수 |
| Ranking | 서버가 현재 분야의 실제 제출 점수로 계산 |
| Files | Backend Private File Storage 원본 + PostgreSQL 메타데이터 |
| Profile / Preferences | PostgreSQL 및 인증된 파일 API |

```text
Browser → React → same-origin /api → Spring Boot
                                      ├─ Session / Security
                                      ├─ Business Logic → PostgreSQL
                                      └─ Private File Storage
```

React의 Mock database, localStorage LMS database, IndexedDB file database는 사용하지 않습니다.

## Remaining Temporary Code

운영 런타임의 가짜 사용자·업무 데이터·인증 우회: **None**. 아래 개발·테스트 도구는 목적과 실행 경계가 명확하므로 유지합니다.

| 파일·경로 | 유지 이유 | 운영에 적용되지 않는 이유 |
| --- | --- | --- |
| `backend/src/main/java/com/rce/lms/user/DevelopmentSeed.java` | 로컬 학습자·운영진 개발 계정 준비 | `dev & !test & !prod & !production`에서만 등록·실행. 운영 프로필은 제외 |
| `backend/src/main/resources/application-dev.yaml` | 로컬 HTTP와 개발 seed 환경 설정 | 동일한 개발 프로필 조건. 운영 설정은 Secure와 파일 경로를 별도 적용 |
| `scripts/init-dev-env.mjs`, `scripts/backend-dev.sh` | 개발 환경의 임의 비밀 생성과 dev 실행 | 운영 명령은 `prod` JAR 실행. 생성 `.env`는 Git·배포 번들에서 제외 |
| `backend/src/test/**` | API·보안·파일·순위·재시작 검증용 fixture | Gradle 테스트 소스와 전용 DB. 운영 bootJar에 포함되지 않음 |
| `frontend/tests/scenario.ts`, `frontend/tests/api-helpers.ts`, `frontend/tests/*.spec.ts` | 실제 API fixture, 실패 주입, 위조 저장소 무시 검증 | Vite 런타임에서 import하지 않는 Playwright 전용 경로 |
| `scripts/backend-test.sh`, `scripts/e2e-server.sh`, `scripts/e2e-test.sh`, `frontend/playwright*.config.ts` | 전용 DB·포트에서 재현 가능한 검사 | 고정 테스트 DB만 사용. 운영 시작 시 실행되지 않음 |
| `frontend/vite.config.ts`의 개발 프록시 | 로컬 same-origin `/api` 연결과 비공개 경로 차단 | 운영은 빌드된 정적 파일과 Nginx 프록시를 사용 |

`landingData.ts`의 설명·도형, 폰트 라이선스, 원본 브랜드 자산은 임시 업무 데이터가 아닙니다. 실제 이메일·푸시 발송과 공유 세션·다중 인스턴스 운영은 이번 cleanup에서 새로 추가하지 않았습니다. 남은 개발 도구 의존성 경고는 Security Cleanup에 명시했습니다.
