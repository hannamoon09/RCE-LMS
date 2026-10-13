# RCE LMS MVP E2E 검증 보고서

검증일: 2026-10-13 (Asia/Seoul). 요청된 13단계와 24개 시나리오를 모두 검증했습니다. 이번 작업에서 Playwright 검사 99개와 backend 검사 94개가 통과했습니다. 이전 Production Cleanup의 통과 기록을 이번 검증 결과로 대신하지 않았으며, 이번 작업 중 완료한 부분 실행은 반복하지 않고 합산했습니다.

검증 범위는 실제 로그인 → 운영진 학생 생성 → 과제 → 제출·파일 → 검토·피드백 → 순위 → 파일 교체 재제출 → 순위 점수 제거 → 재채점입니다. 역할·분야·파일 접근 권한, 비활성 계정의 세션 회수, 오류·빈 화면, 영속성과 모바일 화면도 확인합니다. 제품 기능 추가와 UI 리디자인은 범위에 포함하지 않습니다.

## MVP E2E Status

**READY FOR PRIVATE BETA**

실제 사용자 흐름, 서버 권한·분야 격리·파일 보안, 재제출 순위, 비활성 세션 폐기와 영속성을 검증했고 제품의 BLOCKER/HIGH 실패가 없습니다. 격리된 로컬 Chromium/PostgreSQL 환경의 MVP 검증을 기준으로 비공개 베타 진행이 가능합니다.

## Progress

확정 완료: **13 / 13 (100%)**

```text
████████████████████ 100%
```

| Phase | 작업 | 이번 실행 결과 |
| --- | --- | --- |
| 1 | Environment 확인 및 테스트 격리 | PASS |
| 2 | Authentication, 잘못된 로그인, 세션 복구 | PASS |
| 3 | STAFF → MEMBER 실제 UI 생성 | PASS |
| 4 | Assignment 실제 UI 생성과 Track 노출 | PASS |
| 5 | MEMBER 제출과 파일 업로드 | PASS |
| 6 | STAFF 검토, 점수, Feedback | PASS |
| 7 | 두 MEMBER의 Ranking과 대상 검증 | PASS |
| 8 | 재제출, 리뷰 초기화, 파일 교체 | PASS |
| 9 | 재채점과 Ranking 재반영 | PASS |
| 10 | Permission / Security / IDOR | PASS, 서버 직접 접근 검증 |
| 11 | Session / Inactive User | PASS |
| 12 | Empty / Error State / Validation | PASS, 404·권한 안내 UI 포함 |
| 13 | Final Regression / Build / Persistence / Responsive | PASS |

요청된 최종 24개 시나리오의 판정은 다음과 같습니다. 테스트 파일에 검증 코드가 존재하는 사실과 실제 실행 성공을 구분했습니다.

| Scenario | Result | 실행 근거 |
| --- | --- | --- |
| Environment | PASS | 실제 저장소 분석, 기존 Playwright 구성, 별도 DB·포트·파일 경로 확인 |
| Authentication | PASS | `auth-api.spec.ts` 7개 및 `beta-browser-state.spec.ts` 1개 통과 |
| Invalid Login | PASS | 실제 UI 401·오류 안내, JSESSIONID 미발급, `/api/auth/me` 401 |
| STAFF Member Creation | PASS | 실제 UI로 A/B와 미채점 MEMBER 생성, MEMBER / WEB / active=true 확인 |
| Assignment | PASS | 실제 UI 생성·상세·미래 마감·첨부, DB target_track=WEB 확인 |
| Track Isolation | PASS | WEB 노출, PWN 비노출, 양쪽 실제 ID 접근을 서버에서 404 차단 |
| Submission | PASS | A Text + File, 모바일 B File Only, PENDING, 상세·history·dashboard 일치 |
| File Upload | PASS | 서버 메타데이터·다운로드 원본 byte·새로고침·독립 모바일 context 조회 |
| Review | PASS | 실제 STAFF 검토 화면의 제출자·내용·첨부 및 A 92 / B 80점 저장 |
| Feedback | PASS | MEMBER 화면에서 92점·피드백, 재채점 후 새 모바일 context에서 96점·피드백 확인 |
| Ranking | PASS | A 92 > B 80, 합계·평균·검토 수·rank, 미채점 0점, STAFF·inactive·PWN 제외 |
| Resubmission | PASS | 같은 submission ID, PENDING, score / feedback / reviewedAt / reviewedBy 초기화, 파일 교체 |
| Re-ranking | PASS | 재제출 즉시 A 0 / B 80, 재채점 후 A 96 / B 80으로 순위 재반영 |
| Member Admin Access | PASS | users / assignments / submissions / rankings 직접 403, 브라우저 admin 접근 거부 확인 |
| Cross-track IDOR | PASS | PWN의 실제 Assignment / Submission / File ID를 WEB MEMBER·STAFF가 직접 요청해도 차단 |
| STAFF Track Isolation | PASS | PWN 과제·제출·학생 ID 수정/삭제/검토 거부, query 변조에도 PWN 목록·순위 미노출 |
| File Authorization | PASS | 실제 API에서 소유자·허용 STAFF 다운로드, 같은 분야 peer·타 분야 거부; 익명 차단은 backend 회귀 포함 |
| Logout | PASS | 실제 UI logout 204, browser Back 로그인 보호, 보호 API 401 |
| Inactive Login | PASS | 실제 신규 로그인 401, JSESSIONID 미발급, `/api/auth/me` 401 |
| Existing Session Revocation | PASS | 다른 context의 비활성화 후 기존 세션 401, 재활성화 후 이전 세션 재사용 거부 |
| Persistence | PASS | backend 전체 94개 통과에 실제 Spring 서버 종료·재시작 후 User / Assignment / Submission / Score / Feedback / Notice 조회 포함 |
| Empty State | PASS | 실제 빈 과제·제출·순위·공지와 dashboard 0점·활동 없음, 브라우저 저장소 비의존 |
| Error State | PASS | Network / 500 / 403 재시도·Mock fallback 없음, 잘못된 로그인 UI 401, API validation 400, 실제 다른 분야 ID의 404 안내 UI 확인 |
| Responsive Smoke | PASS | Desktop A 제출·순위, 모바일 B 로그인·파일만 제출, 모바일 STAFF 재채점, 새 모바일 A 96점·파일·순위, 1440/1280/1024/768/390/375px 전체 route 회귀 |

## Critical Flow

```text
Login
→ Member Creation
→ Assignment
→ Submission + File
→ Review + Feedback
→ Ranking
→ Resubmission + File Replacement
→ Ranking Reset
→ Re-review
→ Updated Ranking
```

결과: **PASS**. [beta-critical-flow.spec.ts](../frontend/tests/beta-critical-flow.spec.ts)의 하나의 이어지는 시나리오에서 Phase 2~9를 모두 통과했습니다. 테스트 자체는 **40.7초**, 해당 실행 전체는 **49.5초**이며 `/tmp/rce-beta-critical.log`에 기록했습니다.

WEB STAFF가 실제 UI에서 WEB MEMBER A/B와 미채점 MEMBER를 만들었습니다. A는 텍스트와 파일을, 모바일 B는 파일만 제출했습니다. STAFF가 실제 UI에서 A 92점 / B 80점을 저장했고 MEMBER 화면의 피드백과 순위를 확인했습니다.

A의 새 파일 재제출 직후 모든 검토 필드가 초기화되고 순위는 A 0점 / B 80점으로 바뀌었습니다. 기존 파일은 현재 제출에서 사라졌으며 다운로드 404, 메타데이터 삭제, 실제 파일 byte 삭제를 확인했습니다. 모바일 STAFF가 A를 96점으로 재채점한 뒤 A 96점 / B 80점 순위가 복구됐습니다. 쿠키나 업무 저장소를 복사하지 않은 새 모바일 브라우저에서도 96점·피드백·새 파일·순위가 일치했습니다.

해당 흐름에서 관측한 page error, 예상하지 않은 console error, 5xx는 0건입니다. 동일 페이지의 동일 API에 1초 동안 20회를 초과하는 요청 폭주도 0건이었습니다. 로그인 전 `/api/auth/me`의 예상된 401은 별도 기록했습니다. 이를 모든 중복 요청이 0건이었다는 뜻으로 해석하지 않습니다.

## Security

| 구분 | 확인할 서버 보장 | 결과 |
| --- | --- | --- |
| Role | MEMBER의 admin API 거부, STAFF 생성·승격 요청 변조 거부 | PASS |
| Track | 클라이언트 track 입력·query와 무관하게 인증 계정 분야 적용 | PASS |
| IDOR | 실제 존재하는 다른 분야의 ID를 직접 요청해도 데이터 미노출 | PASS |
| File | 허용된 과제 파일·자신의 제출 파일만 다운로드, 내부 storage key 미노출 | PASS |
| Inactive Session | 신규 로그인 차단, 기존 세션 회수, 재활성화 후 과거 session 재사용 차단 | PASS |
| CSRF / Session | CSRF 없는 변경 요청 차단, 실제 HttpOnly 세션과 CSRF 회전 | PASS |
| Logout | 세션 종료 후 보호 API·브라우저 history 접근 차단 | PASS |

추가 보안 시나리오 [beta-security.spec.ts](../frontend/tests/beta-security.spec.ts) **4개 PASS, 15.5초**입니다. 빈 과제 제목, -1점·101점, 금지 확장자와 위장 PNG도 실제 backend에서 400으로 거부했으며 이전 제출·92점·피드백·파일이 손상되지 않았습니다.

운영 DB는 테스트 대상으로 사용하지 않습니다. E2E는 리터럴 `rce_lms_e2e`, backend 통합 검사는 `rce_lms_test`를 사용합니다. 일반 개발 서버의 `rce_lms`와 업로드 경로를 테스트 초기화 대상으로 사용하지 않습니다.

## Bugs Found

확인된 제품 버그: **0건** (BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0). **No blocking bugs found.** 검증 환경 문제 1건과 자동화 타입 문제 1건은 아래와 같이 구분하여 해결했습니다.

### QA-ENV-001 — 중복 생성 class 파일 때문에 backend test discovery 실패

- 분류: 검증 환경 / 생성물 문제. 제품 런타임 버그로 집계하지 않습니다.
- Severity: MEDIUM (백엔드 회귀 검사 실행 차단).
- Scenario: 최종 backend `test / build` 재실행.
- 기대 결과: JUnit이 테스트 클래스를 정상 탐색하고 실행.
- 실제 결과: 무시 대상인 `backend/build/classes/java/test/com/rce/lms/`에 `ProductionRestartIntegrationTest 2.class`, `ProductionRestartIntegrationTest$ApiSession 2.class`가 있어 파일 이름과 JVM 내부 클래스 이름 불일치로 discovery 실패.
- 원인: 테스트 소스 변경이 아닌 중복 생성 class 산출물. 중복 파일이 만들어진 외부 원인은 확인되지 않았습니다.
- 최초 실패 로그: `/tmp/rce-beta-backend.log`.
- 조치: Gradle `clean`으로 해당 프로젝트의 생성물을 정리. `clean` 성공 확인.
- 수정한 제품 파일: 없음.
- 재테스트: `clean` 후 전체 backend **94개, 실패 0 / 오류 0 / 건너뜀 0**, test/build **PASS (49초)**. `/tmp/rce-beta-backend-retest.log`에 기록.

### QA-AUTO-001 — 테스트 helper의 집합 원소 타입 명시

- 분류: 자동화 코드의 TypeScript 타입 수정. 제품 동작 결함으로 집계하지 않습니다.
- Severity: LOW (테스트 helper의 정적 타입 문제).
- 조치: 테스트 helper의 집합 원소 타입을 `Set<string>`으로 명시.
- 검증: 신규 Playwright 파일 3개의 별도 TypeScript 검사 **PASS**. frontend TypeScript/Vite build도 **PASS (2.57초)**.
- 제품 코드 변경: 없음.

## Bugs Fixed

- 제품 버그 수정: 현재 없음. 이번 작업에서 제품 코드를 변경하지 않았습니다.
- 자동화 수정: 테스트 helper의 `Set<string>` 타입 명시.
- 검증 환경 복구: 중복 생성 class 파일을 Gradle `clean`으로 제거. 전체 backend 94개 및 build 재검사 **PASS**.

## Remaining Bugs

이번 검증 범위에서 확인된 미해결 제품 버그는 없습니다. 요청된 시나리오를 건너뛰거나 실패를 통과로 처리한 항목도 없습니다.

이전 [Production Cleanup 감사 보고서](production-cleanup-audit.md)에 기록된 빌드 도구 의존성 경고 7건은 이전 감사 결과입니다. 이번 E2E 작업의 새 `npm audit` 결과로 주장하지 않습니다. 의존성의 대규모 업그레이드나 제품 기능 확장은 이번 작업 범위에 포함하지 않습니다.

## E2E Automation

기존 [Playwright 구성](../frontend/playwright.config.ts)과 [scenario helper](../frontend/tests/scenario.ts)를 재사용합니다. 별도의 병렬 QA 체계를 만들지 않았습니다.

| 파일 | 이번 작업의 용도 | 실행 상태 |
| --- | --- | --- |
| [auth-api.spec.ts](../frontend/tests/auth-api.spec.ts) | 기존 실제 인증·CSRF·세션·모바일 로그인 회귀 7개 | PASS |
| [beta-browser-state.spec.ts](../frontend/tests/beta-browser-state.spec.ts) | 새 clean context, 잘못된 로그인 UI, cookie 미발급, 실제 logout 후 browser Back | PASS, 1개 |
| [beta-security.spec.ts](../frontend/tests/beta-security.spec.ts) | 역할·분야 위조, 실제 IDOR·파일 권한, 서버 validation, inactive/session 재사용 4개 | PASS, 15.5초 |
| [beta-critical-flow.spec.ts](../frontend/tests/beta-critical-flow.spec.ts) | 실제 STAFF→MEMBER→과제→제출→검토→순위→재제출→재채점 흐름 | PASS, 1개 / 테스트 40.7초·실행 전체 49.5초 |
| [production-cleanup.spec.ts](../frontend/tests/production-cleanup.spec.ts) | 실제 빈 상태, 브라우저 storage 비의존, 500/403/network 오류·재시도 | PASS, 2개 / 33.6초 |
| [lms.spec.ts](../frontend/tests/lms.spec.ts), [public.spec.ts](../frontend/tests/public.spec.ts) | 전체 route·공개 페이지의 desktop/mobile 및 console/runtime 회귀 | PASS, 최종 회귀 84개에 포함 |
| [ProductionRestartIntegrationTest.java](../backend/src/test/java/com/rce/lms/ProductionRestartIntegrationTest.java) | 실제 HTTP와 독립 backend lifecycle 두 번을 통한 DB 영속성 | PASS, 전체 backend 94개에 포함 |

`ProductionRestartIntegrationTest`는 servlet server, connection pool, JPA context를 종료한 뒤 새 application context를 시작합니다. 새 로그인과 독립 HTTP client로 저장 데이터를 재조회합니다. 별도 JVM 프로세스 재시작이나 운영 HTTPS 배포 전체를 검증한 것으로 표현하지 않습니다.

최종 Playwright 자동화 결과: **서로 다른 99개 PASS, 최종 실패 0 / 건너뜀 0**. 기존 93개(데이터 selector 검사 포함)에 브라우저 상태 1개·보안 4개·핵심 흐름 1개를 추가했습니다. 인증 8개(19.7초) + 핵심 흐름 1개(49.5초) + 보안 4개(15.5초) + 빈 화면·오류 2개(33.6초) + 남은 회귀 84개(6.8분)의 실제 실행 결과를 합산했습니다. 통과한 검사는 반복하지 않았습니다. backend는 clean 재실행에서 **94개 모두 PASS, test/build 49초**입니다.

검사별 이름과 실행 집계, 소스 SHA-256, 데이터 보존·정리 결과는 [검증 결과 JSON](verification/mvp-e2e-results.json)에 보존했습니다. 화면 증거: [92/80점 순위](verification/mvp-e2e/beta-ranking-92-80.png), [재제출 후 0점](verification/mvp-e2e/beta-resubmission-score-reset.png), [새 모바일 브라우저의 96점](verification/mvp-e2e/beta-new-browser-reviewed-96.png), [모바일 파일만 제출](verification/mvp-e2e/beta-mobile-file-only-submission.png).

### 테스트 환경과 데이터 정리

| 대상 | 격리 방식 |
| --- | --- |
| Frontend | `http://localhost:5181`, 실제 `/api` 프록시 |
| Backend E2E | `http://localhost:8081`, 실행 전 생성한 프로젝트 JAR |
| PostgreSQL E2E | 리터럴 `rce_lms_e2e`; 실행 시작 시 이 DB의 스키마만 초기화 |
| Backend 통합 검사 | `rce_lms_test`; 스크립트의 DB 이름 제한 |
| E2E 파일 | `backend-data/e2e-uploads`, 일반 개발 파일과 분리 |
| STAFF | 테스트 DB에서 명시적으로 provision; 운영 STAFF 생성 API 추가 없음 |
| 계정·업무 fixture | 고유 학번·이름·UUID, 실제 API·UI 사용 |
| scenario 정리 | 생성한 사용자·과제·제출·파일의 소유 ID에 한정해 삭제 |
| 기존 API fixture | 일부 검사는 전용 DB에 남기므로 이번 검증 종료 후 별도 안전 정리를 수행 |
| 브라우저 저장소 | 쿠키와 달리 localStorage / sessionStorage / IndexedDB에 업무 DB를 만들지 않음 |

테스트 서버 8081/5181 종료를 확인한 후 리터럴 `rce_lms_e2e`의 현재 DB 이름을 검사하고, 그 DB의 업무 fixture만 정리했습니다. 잔여 계정 24개·과제 12개·제출 12개 등을 정리하여 업무 행 0건이며, 전용 업로드 경로의 테스트 파일 16개도 제거하여 파일 0개입니다. 해당 DB의 Flyway 이력 7개는 유지했습니다. 이는 일반 DB를 초기화하는 명령이 아닙니다. 다음 E2E 실행은 기존 스크립트가 fixture를 다시 준비합니다.

일반 개발 DB `rce_lms`는 9개 테이블 전체 행 지문이 작업 시작 시점과 일치합니다. 기존 계정 6개·과제 1개와 Flyway migration 파일 7개의 SHA-256을 그대로 보존했습니다.

### 재현 명령

프로젝트 루트에서 실행합니다. 기존 `.env`의 비밀 값은 스크립트가 읽으며 명령이나 보고서에 복사하지 않습니다. Java 21, Node.js 22.12 이상, Docker Compose와 Chromium 설치가 필요합니다. E2E 전용 8081 / 5181 포트는 비워 둡니다.

```sh
# 터미널에서 이 저장소의 루트 폴더를 연 뒤 실행합니다.
npm --prefix frontend run build
npm --prefix frontend run test:backend -- --rerun-tasks
npm --prefix frontend test
```

`test:backend`는 저장소의 Gradle Wrapper로 `test`와 `build`를 실행하며 별도 테스트 DB 설정을 적용합니다. E2E 명령은 실행 JAR를 만든 뒤 전용 backend와 Vite를 자동 시작합니다. frontend/backend 검증을 동시에 실행해 같은 backend 생성물을 변경하지 않습니다.

이번 인증 범위를 다시 실행하려면 다음을 사용합니다.

```sh
npm --prefix frontend test -- tests/auth-api.spec.ts tests/beta-browser-state.spec.ts
```

추가 보안 검사는 다음으로 재현합니다.

```sh
npm --prefix frontend test -- tests/beta-security.spec.ts
```

전체 실제 사용자 흐름은 다음으로 재현합니다.

```sh
npm --prefix frontend test -- tests/beta-critical-flow.spec.ts
```

중복 생성 class와 같은 빌드 산출물 문제가 재발하면 프로젝트의 생성물만 정리한 후 테스트 스크립트를 실행합니다. DB·업로드 폴더를 삭제하는 절차가 아닙니다.

```sh
(cd backend && ./gradlew clean)
npm --prefix frontend run test:backend -- --rerun-tasks
```

Playwright 실패 자료는 `frontend/test-results/e2e/`, backend HTML/XML 결과는 `backend/build/reports/tests/test/`와 `backend/build/test-results/test/`에 생성됩니다. 같은 명령의 다음 실행에서 자료가 교체될 수 있으므로 최종 판정에 필요한 결과를 별도로 보존합니다.

## Build

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| Frontend | PASS | TypeScript + Vite production build, 2.57초 |
| Backend Test | PASS | 최초 discovery 실패 복구 후 clean 재실행: 94개, 실패 0 / 오류 0 / 건너뜀 0 |
| Backend Build | PASS | test/build 49초, `/tmp/rce-beta-backend-retest.log` |
| E2E | PASS | 서로 다른 99개: 인증 8 + 핵심 흐름 1 + 보안 4 + 빈 화면·오류 2 + 최종 회귀 84 |

## Recommendation

**Private Beta 진행 가능 — READY FOR PRIVATE BETA.** 실제 UI를 통한 학생 생성부터 재채점까지 정상이고, 서버가 권한·분야·파일 접근을 차단하며, 재제출 점수 제거·비활성 세션 폐기·영속성과 최종 회귀를 모두 통과했습니다.

필수 영역의 BLOCKER/HIGH 실패가 없으며 추가 제품 기능이나 UI 변경 없이 검증을 완료했습니다. 이 판정은 로컬 격리 환경의 기능·권한 QA 결과입니다. 실제 운영 호스트·TLS 배포, 부하 시험, Chromium 외 브라우저 검증은 수행하지 않았습니다. Suggested Improvements: 이번 필수 흐름 검증에서 추가 기능을 제안하거나 구현하지 않았습니다.
