# RCE LMS

기존 React LMS 화면에 Spring Boot API와 PostgreSQL을 연결한 학습 관리 시스템입니다. 로고, 레이아웃, Tailwind 토큰, Radix 컴포넌트, Anime.js 모션과 모바일·키보드 동작을 유지합니다. 계정·과제·제출·파일·공지·순위·프로필·알림 설정은 서버 데이터를 사용합니다.

GitHub 업로드 전 파일·Secret·기존 이력 검사와 현재 진행 상태는 [저장소 업로드 감사](docs/repository-upload-audit.md)에 기록합니다.

현재 버전은 **1.0.0**입니다. 변경 내역은 [CHANGELOG.md](CHANGELOG.md), 실제 배포 확인 범위와 남은 점검은 [배포 검증 기록](docs/deployment-prep-verification.md)을 참고하세요.

## 로컬 실행

Node.js 22.12 이상, Java 21 JDK, Docker와 Docker Compose가 필요합니다. `JAVA_HOME`은 Java 21을 가리켜야 하며 Gradle은 저장소의 9.5.1 Wrapper를 사용합니다. PostgreSQL 17은 Compose로 실행합니다.

프로젝트 루트에서 한 번 실행합니다.

```sh
npm --prefix frontend ci
npm --prefix frontend run setup:dev
docker compose up -d --wait postgres
```

`setup:dev`는 로컬 실행에 필요한 `.env`와 임의의 개발용 비밀번호를 준비하며 파일 권한을 `0600`으로 지정합니다. 기존 `.env`는 덮어쓰지 않습니다. `.env`는 Git에서 제외하며, 생성된 값을 공개 문서나 코드에 복사하지 않습니다.

두 터미널에서 각각 실행합니다.

```sh
bash scripts/backend-dev.sh
```

```sh
npm --prefix frontend run dev -- --port 5173 --strictPort
```

브라우저에서 [로컬 LMS](http://localhost:5173)를 엽니다. Vite의 `/api` 요청은 `localhost:8080`의 Spring Boot로 전달됩니다. 백엔드 상태는 [health API](http://localhost:8080/api/health)에서 확인할 수 있습니다. 개발 백엔드 스크립트는 `.env`를 읽고 `dev` 프로필을 사용합니다.

### 개발 계정

`dev & !test & !prod & !production` 조건과 `DEV_SEED_PASSWORD` 설정을 모두 만족할 때만 다음 개발용 계정을 만듭니다. `prod` 또는 `production`이 함께 활성화되면 개발 seed는 실행되지 않습니다. 비밀번호는 로컬 `.env`의 해당 값이며 저장 시 서버에서 해시합니다. 기존 학번이 있으면 계정을 덮어쓰거나 비밀번호를 초기화하지 않습니다.

| 학번 | 역할 | FIELD |
| --- | --- | --- |
| `20260000` | STAFF | WEB / 웹해킹 |
| `20260001` | MEMBER | WEB / 웹해킹 |
| `20260002` | MEMBER | PWN / 포너블 |
| `20260003` | MEMBER | REVERSING / 리버싱 |
| `20260004` | MEMBER | FORENSICS / 포렌식 |

개발 seed 비밀번호는 12자 이상, UTF-8 기준 72바이트 이하입니다. 개발 seed는 로컬 개발 전용이며 운영 환경에서는 실행되지 않습니다. 운영 실행에는 `prod` 또는 `production` 프로필을 명시합니다. 최초 운영진 계정은 [신뢰된 운영자 계정 발급 절차](docs/staff-provisioning.md)를 따릅니다. 회원가입·소셜 로그인·전역 관리자·운영진 승격 API는 없습니다.

### 환경 변수

`.env.example`에는 이름만 기록되어 있습니다. 백엔드 운영 시에는 배포 환경의 비밀 설정을 통해 주입하고, 프론트엔드 번들에 넣지 않습니다.

| 이름 | 용도 |
| --- | --- |
| `DB_NAME` | Compose에서 생성할 개발 데이터베이스 이름 |
| `DB_PORT` | 로컬 PostgreSQL 연결 포트 |
| `DB_URL` | Spring JDBC PostgreSQL 연결 URL |
| `DB_USERNAME`, `DB_PASSWORD` | 데이터베이스 접속 계정·비밀번호 |
| `SPRING_PROFILES_ACTIVE` | 개발 스크립트는 `dev`, 운영 실행은 `prod` 또는 `production` 지정 |
| `DEV_SEED_PASSWORD` | 개발 계정 최초 생성 전용. `prod`·`production`·`test`에서는 사용하지 않음 |
| `FILE_STORAGE_PATH` | 비공개 업로드 원본 디렉터리. 운영 프로필에서는 필수이며 웹 루트 밖의 영속 경로 지정 |
| `SESSION_COOKIE_SECURE` | 로컬 HTTP 개발에서만 `false` 사용. `prod`·`production`은 이 값과 무관하게 세션·CSRF 쿠키 Secure를 `true`로 설정 |
| `PORT` | 백엔드 포트. 기본 `8080` |
| `SERVER_ADDRESS` | 백엔드 바인딩 주소. 생성되는 로컬 환경은 `127.0.0.1` |
| `API_PROXY_TARGET` | Vite 개발 프록시 대상. 기본 `http://localhost:8080` |
| `TEST_DB_URL` | 백엔드 검사 전용 JDBC URL. 경로가 `/rce_lms_test`로 끝나야 함 |
| `BACKEND_ORIGIN` | Vercel 설정 평가 시 사용할 Railway 공개 HTTPS origin. `/api` 경로 없이 지정하며 `VITE_` 접두사를 붙이지 않음 |

## 검증과 빌드

프로젝트 루트에서 최초 브라우저 설치 후 전체 검사를 실행합니다.

```sh
(cd frontend && npx playwright install chromium)
npm --prefix frontend run test:backend
npm --prefix frontend test
npm --prefix frontend run build
```

- `npm --prefix frontend run test:backend`: 실제 PostgreSQL `rce_lms_test`를 사용해 통합·단위 검사와 Gradle 빌드를 실행합니다. 일반 개발 DB를 검사 대상으로 사용하지 않습니다. 루트에서 `bash scripts/backend-test.sh`로도 실행할 수 있습니다.
- `npm --prefix frontend test`: 백엔드 실행 JAR를 빌드하고, 폐기 가능한 `rce_lms_e2e` DB의 스키마를 초기화합니다. 백엔드 `8081`과 Vite `5181`을 별도로 실행하여 API·브라우저 회귀 검사를 순차 수행합니다. 두 포트는 비워 두세요.
- `npm --prefix frontend run build`: TypeScript 검사와 Vite production build를 실행하여 `frontend/dist/`를 생성합니다.

`frontend/` 안에서 실행할 때는 `--prefix frontend`를 빼고 기존 `npm` 명령을 그대로 사용합니다. 루트에는 `package.json`이 없습니다.

필요한 검사만 실행할 수도 있습니다.

```sh
npm --prefix frontend test -- tests/profile-api.spec.ts
npm --prefix frontend run test:backend -- --tests com.rce.lms.AuthIntegrationTest
```

배포용 백엔드 JAR만 만들려면 프로젝트 루트에서 실행합니다.

```sh
cd backend
./gradlew bootJar
```

결과는 `backend/build/libs/rce-lms-backend-1.0.0.jar`입니다. 전체 백엔드 검증은 루트에서 앞의 `npm --prefix frontend run test:backend` 명령을 사용합니다.

2026-10-07 검증 결과: 백엔드 전체 89개 검사 통과, 브라우저 전체 90개 검사 통과 후 추가 보안 검사 1개와 관련 파일 검사 3개 통과로 서로 다른 브라우저 검사 총 91개를 확인했습니다. 최종 프론트엔드 빌드, 개발 환경 초기화 동작, Nginx 설정 문법 검사도 통과했습니다. 이는 2026-10-12 폴더 분리 전 완료한 검증 기록입니다. 폴더 분리 후에는 프론트엔드 빌드·백엔드 bootJar와 관련 회귀 검사 17개를 확인했습니다. 이 수치는 이전 단계의 기록이며 현재 cleanup 검증 결과는 [운영 정리 감사 보고서](docs/production-cleanup-audit.md)를 확인하세요. 단계별 근거는 [구현 진행 기록](docs/implementation-progress.md)에 있습니다. 현재 브라우저 실패 자료 경로는 `frontend/test-results/e2e/`, 백엔드 HTML 보고서는 `backend/build/reports/tests/test/`, 보존된 화면 검증 자료는 [docs/verification](docs/verification/)에 있습니다.

2026-10-13 실사용 MVP E2E 검증을 완료했습니다. 기존 완료 검사를 보존하며 Playwright 99개와 backend 94개를 확인했고, 학생 생성→파일 제출→92/80점 채점→재제출 점수 제거→96점 재채점 및 서버 권한·세션 폐기를 통과했습니다. 결과와 재현 방법은 [MVP E2E 보고서](docs/mvp-e2e-report.md)를 참고하세요. 판정은 `READY FOR PRIVATE BETA`이며 실제 운영 배포는 별도입니다.

## 구조와 데이터

```text
frontend/                  React / Vite / TypeScript 프론트엔드
  src/auth/                서버 세션 복구, 로그인·로그아웃, 보호 경로
  src/api/                 CSRF 공통 클라이언트와 도메인 API
  src/data/                도메인 타입·selector·계정별 API 캐시
  src/components/, src/pages/  기존 학습자·운영진 UI
  src/motion/              기존 Anime.js 및 reduced-motion 처리
  public/                  정적 공개 파일
  tests/                   실제 API 기반 Playwright 검사
  package.json, package-lock.json  프론트엔드 의존성과 실행 명령
  vite.config.ts, tsconfig*.json, tailwind.config.*  빌드·스타일 설정
  playwright*.config.ts    브라우저 검사 설정
  dist/, node_modules/, test-results/  생성 파일과 검사 결과
backend/                   Spring Boot 4.1.1 / Java 21 / JPA / Security
  Dockerfile               Railway용 Java 21 빌드·실행 이미지
  src/main/resources/db/migration/  Flyway SQL
scripts/                   공통 로컬 환경·백엔드·검사 실행
docs/                      API 계약·구현 기록·화면 검증 자료
deploy/nginx.conf          동일 출처 HTTPS 배포 예시
DEPLOYMENT.md              Railway + Vercel 첫 배포 단계별 안내
compose.yaml               PostgreSQL 개발 환경
.env, .env.example         공통 로컬 환경 설정과 변수 이름 예시
backend-data/              비공개 로컬 업로드 원본
```

프론트엔드와 백엔드는 각각의 폴더에서 관리하고, Docker·환경 변수·운영 문서·공통 스크립트는 프로젝트 루트에 둡니다. `.env`, 의존성, 빌드 결과와 업로드 원본은 Git에 포함하지 않습니다.

Flyway가 스키마를 생성·변경하고 Hibernate는 `ddl-auto=validate`로 일치 여부만 검사합니다. 마이그레이션 적용 후 기존 SQL을 수정하는 대신 새 버전 파일을 추가합니다.

| 마이그레이션 | 테이블·변경 |
| --- | --- |
| V1 | `users`: 학번, 비밀번호 해시, 역할, 분야, 활성 상태, 프로필 |
| V2 | `assignments`: 서버가 결정한 작성자·대상 분야·마감 |
| V3 | `submissions`: 사용자·과제 조합 하나, 검토 상태·점수·피드백 |
| V4 | `assignment_files`, `submission_files`, `file_cleanup_jobs` |
| V5 | `notices`: 분야별 또는 전체 공지 |
| V6 | `profile_files`, 프로필 이미지 FK, `users.credential_version` |
| V7 | `user_preferences`: 사용자별 네 가지 알림 수신 설정 |

순위는 조회 시 제출 점수를 집계하며 별도 순위 테이블에 저장하지 않습니다. 파일 원본은 외부 디렉터리, 메타데이터는 PostgreSQL에 저장합니다.

## 인증과 권한

HTTP 세션을 사용합니다. `JSESSIONID`는 HttpOnly·SameSite=Lax이며 `prod`·`production` 프로필에서는 세션과 CSRF 쿠키의 Secure 설정을 항상 활성화합니다. 로컬 환경의 `SESSION_COOKIE_SECURE=false`를 그대로 전달해도 이 운영 설정은 유지됩니다. 세션 비활성 만료 시간은 30분이고 로그인 시 세션 ID를 교체합니다. JWT와 브라우저 저장소 기반 인증은 사용하지 않습니다.

클라이언트는 `GET /api/csrf`로 토큰을 준비하고, 변경 요청에 `XSRF-TOKEN` 쿠키의 원본 값을 `X-XSRF-TOKEN` 헤더로 보냅니다. 로그인·로그아웃 후 토큰을 다시 준비합니다. 인증이 필요한 API의 401 응답은 프론트엔드 인증 상태를 해제합니다. API 응답은 `Cache-Control: no-store`를 사용합니다.

서버는 매 요청마다 계정의 활성 상태·현재 역할·비밀번호 버전을 확인합니다. 비활성화 또는 비밀번호 재설정 후 이전 세션은 다음 요청에서 무효화됩니다. 본인 비밀번호 변경 성공 시 현재 세션도 종료되어 새 비밀번호로 로그인합니다.

- MEMBER는 자신의 FIELD 과제를 조회하고 본인 제출물을 등록·조회합니다. 설정·프로필은 본인 정보만 변경합니다.
- STAFF는 자신의 FIELD 과제·공지·학생·제출 검토를 관리합니다. 학생 생성은 항상 MEMBER와 운영진의 FIELD로 고정됩니다. 학번·역할·분야 변경은 일반 API에서 허용하지 않습니다.
- 다른 FIELD의 리소스 ID는 접근 가능한 정보로 노출하지 않습니다. 전체 공지(`track=null`)는 모든 계정이 읽지만 일반 STAFF는 수정·삭제할 수 없습니다.

## 기능과 API

| 기능 | 동작·세부 계약 |
| --- | --- |
| 과제 | 기존 목록·상세·검색·필터·작성 모달. 제출물이 있는 과제는 삭제 불가. [Assignment API](docs/assignment-api.md) |
| 제출 | 파일 또는 메모 중 하나 이상 필요. 마감 전 재제출은 같은 레코드를 갱신하며 검토·점수·피드백을 모두 초기화. [Submission API](docs/submission-api.md) |
| 파일 | PDF·MD·TXT·ZIP·PNG·JPEG·WebP, 파일당 10 MiB, 최대 5개. 이름·형식·내용 검사, 인증된 다운로드, 교체 실패 시 정리. [File API](docs/file-api.md) |
| 운영 | 자신의 FIELD 학생 생성·이름 수정·활성 변경·비밀번호 재설정, 정수 0~100점과 선택 피드백. [Admin API](docs/admin-api.md), [Review API](docs/admin-review-api.md) |
| 공지 | 중요 표시·검색·상세 및 STAFF 분야 공지 작성·수정·삭제. [Notice API](docs/notice-api.md) |
| 순위 | 현재 FIELD의 활성 MEMBER만 포함. 미채점도 0점으로 포함하고 총점·정밀 평균·검토 수·이름·내부 UUID 순으로 정렬. 응답에 학번·이메일·UUID 미포함. [Ranking API](docs/ranking-api.md) |
| 프로필 | 이름·선택 이메일·현재 비밀번호를 확인한 비밀번호 변경. 기존 자르기 UI에서 512×512 PNG를 업로드. [Profile API](docs/profile-api.md) |
| 알림 설정 | 과제·공지·피드백·이메일 네 설정을 사용자별로 저장. 이메일·푸시 등의 실제 발송 기능은 포함하지 않음. [Preferences API](docs/preferences-api.md) |

파일 다운로드 권한은 종류별로 확인합니다. 과제 자료는 동일 FIELD, 제출 파일은 작성자 또는 동일 FIELD STAFF, 현재 프로필 이미지는 본인 또는 동일 FIELD 계정만 접근할 수 있습니다. 원본 저장 경로·storage key는 응답에 포함하지 않습니다. 정상 교체·삭제 후의 파일 제거는 영속 cleanup queue로 재시도합니다.

## 화면과 기존 Mock 제거

공개 `/`, `/login`, 학습자 `/dashboard`, `/assignments`, `/notices`, `/submissions`, `/rankings`, `/profile`, `/settings`, 운영진 `/admin/*` 경로를 유지합니다. 최종 대시보드는 `/dashboard`에서 제공하며 디자인 비교 전용 `/prototypes`, `/dashboard/a`~`/dashboard/d`와 해당 내비게이션·컴포넌트는 제거했습니다. 로그인 후 원래 내부 경로와 검색 조건으로 복귀하며 외부 주소로 리다이렉트하지 않습니다.

운영 데이터의 localStorage·sessionStorage·IndexedDB 저장, 데모 인증, 고정 사용자·과제·공지·제출 fixture와 클라이언트 순위 계산을 제거했습니다. 오래된 브라우저 데이터는 사용하거나 서버로 가져오지 않습니다. 정적 내비게이션·상태 라벨과 공개 랜딩의 기능 안내는 유지합니다. 랜딩의 가짜 과제·공지·점수·피드백 예시는 제거하고 기존 배치와 모션 안에서 기능만 설명합니다. 데이터가 없으면 실제 빈 상태를, API가 실패하면 오류·재시도 화면을 표시합니다. 상세 변경은 [Mock 제거 기록](docs/mock-cleanup.md), 원래 화면 분석은 [Frontend inspection](docs/frontend-inspection.md)에 있습니다.

기존 색상·폰트·레이아웃·모션 설명은 [UI 디자인 문서](docs/ui-design.md)로 보존했습니다.

## 운영 배포

Private Beta의 권장 구성은 **Vercel Frontend + Railway Backend/PostgreSQL/Volume**입니다. 처음 배포할 때는 [DEPLOYMENT.md](DEPLOYMENT.md)를 따라갑니다. Railway Root Directory는 `/backend`, Vercel Root Directory는 `frontend`입니다. Vercel의 [`vercel.mjs`](frontend/vercel.mjs)가 환경변수 `BACKEND_ORIGIN`으로 `/api`를 전달합니다. 실제 계정·Secret·배포 버튼은 사용자가 설정하고 실행합니다.

자가 호스팅용 [Nginx 예시](deploy/nginx.conf)도 보존되어 있습니다. `frontend/dist/`만 `/srv/rce-lms/frontend/dist`에서 서비스하고 `/api/`를 내부 Spring Boot로 전달하는 구성입니다. 어느 방식에서도 브라우저의 API 요청은 같은 출처를 사용하며 전체 CORS 허용 설정을 추가하지 않습니다. 저장소 전체나 업로드 디렉터리를 정적 경로로 공개하지 않습니다.

운영 DB의 `DB_URL`·`DB_USERNAME`·`DB_PASSWORD`와 웹 루트 밖의 영속 `FILE_STORAGE_PATH`를 배포 환경의 비밀 설정으로 주입한 뒤, 프로젝트 루트 기준으로 실행합니다. 개발용 `.env`나 개발 백엔드 스크립트를 운영에 사용하지 않습니다.

```sh
SPRING_PROFILES_ACTIVE=prod java -jar backend/build/libs/rce-lms-backend-1.0.0.jar
```

`production`도 같은 운영 설정을 적용하는 별칭입니다. 두 운영 프로필에서는 개발 seed가 실행되지 않고 세션·CSRF 쿠키 Secure가 활성화되며, debug와 SQL 출력이 꺼집니다. `FILE_STORAGE_PATH`는 필수이고, Flyway와 Hibernate `ddl-auto=validate`, 실제 Session/CSRF 검증은 유지됩니다. 첫 STAFF는 서버를 시작하기만 해서는 생성되지 않으며 운영자가 [계정 발급 절차](docs/staff-provisioning.md)의 로컬 터미널 도구를 명시적으로 실행합니다. `.env`, 비밀번호, 데이터베이스 덤프와 파일 원본은 공개 `frontend/dist/`에 넣지 않습니다. Backend는 Railway의 공개 HTTPS endpoint를 통해 Vercel과 통신하고 DB는 내부 네트워크로 연결합니다. 최초 계정 발급 등 신뢰된 운영 작업의 공개 DB 접속은 별도 절차를 따릅니다.

기본 세션 저장소는 백엔드 프로세스 메모리입니다. 재시작하면 다시 로그인해야 합니다. 다중 인스턴스 간 공유 세션은 현재 구성에 포함되어 있지 않습니다.

PostgreSQL 영속 볼륨과 `FILE_STORAGE_PATH`의 원본을 함께 백업합니다. 쓰기 작업을 잠시 멈추거나 일관된 스냅샷 절차를 사용해 같은 시점의 메타데이터·파일 쌍을 확보하고, 복구 시 둘을 함께 복원합니다. DB만 복원하면 파일 참조가 실제 원본과 어긋날 수 있습니다. `file_cleanup_jobs`도 DB 백업에 포함하며 배포 시 업로드 디렉터리를 덮어쓰지 않습니다.

사용자가 Vercel·Railway 배포와 최초 STAFF 로그인을 완료했습니다. 운영 환경의 파일 업로드·재배포 후 영속성 및 전체 최소 업무 흐름은 추가 확인이 필요합니다. 확인된 결과와 미확인 항목은 [배포 검증 기록](docs/deployment-prep-verification.md)에 구분했습니다.

Phase 1~12 구현 기록은 [구현 보고서](docs/implementation-result.md), 이후 Mock·개발 데이터·보안 설정 정리와 최신 검증 결과 및 개발 도구 의존성 감사는 [운영 정리 감사 보고서](docs/production-cleanup-audit.md)에 정리합니다.
