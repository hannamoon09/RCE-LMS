# RCE LMS 첫 배포 가이드

준비 시작: 2026-10-14 · 최종 정리: 2026-10-18 · 대상: 동아리 Private Beta

이 문서는 **사용자가 직접 클릭·입력·배포하는 안내서**입니다. 계정 생성, 요금제 선택, Secret 입력, 서비스 생성, Deploy, DNS 변경은 사용자가 수행합니다. 채팅에서는 아래 작업을 한 단계씩 진행합니다. 다음 단계로 넘어가기 전에 해당 단계의 확인 결과를 알려주세요. 비밀번호·토큰·쿠키 값은 채팅이나 스크린샷에 포함하지 않습니다.

Railway Backend와 PostgreSQL 배포는 완료했고, 2026-10-17 공개 `/api/health`의 HTTP 200 및 `UP` 응답까지 확인했습니다. Vercel은 최신 소스 배포 중 설정 스키마 오류가 발생해 2026-10-18 설정을 수정하고 로컬 검증을 마쳤습니다. 현재 다음 단계는 **수정 커밋을 사용자가 push해 Vercel 배포 결과를 확인하는 것**입니다. 최신 프런트엔드 배포와 운영 로그인·파일 영속성 smoke test는 아직 완료되지 않았습니다. 상세 근거는 [배포 준비 검증 기록](docs/deployment-prep-verification.md)에 구분했습니다.

## 배포 구성

```text
GitHub Private: hannamoon09/RCE-LMS (main)
  ├─ frontend/ → Vercel HTTPS
  │                 └─ /api/* → Railway Backend HTTPS
  └─ backend/  → Railway Spring Boot / Java 21 (1 instance)
                       ├─ Railway PostgreSQL (private network)
                       └─ Railway Volume /data/uploads
```

| 후보 | 판단 |
| --- | --- |
| **Vercel + Railway** | 추천. 현재 React·Spring Boot 분리와 `/api` 상대경로, 세션·CSRF 인증을 유지합니다. |
| Railway 중심 | 프런트엔드에도 정적 서버와 프록시 컨테이너를 운영하면 한 프로젝트로 모을 수 있지만 관리할 서버가 하나 더 생깁니다. |
| Render | Docker·PostgreSQL·영속 디스크를 제공하는 대안입니다. 지금 구성에서 서비스를 이전할 필요는 없습니다. |

Dockerfile은 Java 21과 Gradle Wrapper로 JAR를 만들고 JRE 21로 실행합니다. 빌드에 DB나 Secret이 필요하지 않습니다. Spring Boot의 Flyway가 **서버 시작 시** migration을 적용하고 Hibernate는 `validate`만 수행합니다.

Vercel은 공식 지원하는 [`vercel.mjs`](frontend/vercel.mjs)에서 `BACKEND_ORIGIN`을 읽고 `@vercel/config/v1`의 `routes.rewrite()`와 `routes.header()`로 규칙을 만듭니다. 이 SDK는 빌드용 의존성으로 버전을 고정했습니다. 정적 `vercel.json`에 환경변수 보간 문법을 추측해 넣지 않습니다. URL이 빠지거나 HTTP·비밀번호·경로·query를 포함하면 설정 평가가 실패하도록 했습니다. [Vercel 설정](https://vercel.com/docs/project-configuration/vercel-ts)

Railway의 기존 Config as Code는 신규 서비스에서 사용할 수 없고 기존 서비스도 2026-12-01 종료 예정으로 안내되어 있어, 이번에는 `railway.toml`을 추가하지 않습니다. Dockerfile과 아래 대시보드 설정을 사용합니다. [Railway 안내](https://docs.railway.com/config-as-code)

## 1. GitHub 확인

**Codex 준비:** 기존 이력을 유지해 `main`에 소스와 감사 결과를 업로드했습니다. 저장소는 Private입니다. [저장소 감사](docs/repository-upload-audit.md)

**사용자 확인:** [GitHub 저장소](https://github.com/hannamoon09/RCE-LMS)를 엽니다. `frontend`, `backend`, `scripts`, `compose.yaml`, 이 문서가 보여야 합니다. `.env`, `node_modules`, `dist`, `backend/build`, 업로드 원본은 없어야 합니다.

기존 Vercel Git 연결은 준비 중 사용자가 해제했다가 2026-10-17 다시 연결했습니다. Railway도 `main` 자동 배포가 켜져 있으므로 이후 push는 실제 배포를 시작할 수 있습니다. 새 GitHub 저장소를 만들거나 기존 `origin`을 바꿀 필요가 없습니다.

## 2. Railway 계정과 빈 프로젝트

**Codex 준비:** 필요한 서비스와 입력값을 정리했습니다.

**사용자 작업:**

1. [Railway](https://railway.com/dashboard)에 로그인합니다.
2. **New Project**를 선택하고 **Empty Project**로 빈 프로젝트를 만듭니다.
3. 프로젝트 이름은 `rce-lms`를 권장합니다. 이미 자동 생성된 이름을 사용 중이면 그대로 진행해도 됩니다.
4. 이후 모든 서비스는 이 프로젝트의 같은 환경(처음에는 `production`)에 둡니다.

여기까지 한 뒤 채팅에 알려주세요. 아직 서비스를 한꺼번에 추가할 필요가 없습니다. 버튼 이름이 다르면 화면을 보내주세요.

이 구성에는 **DB 볼륨과 업로드 볼륨 두 개**가 필요합니다. Railway Free의 프로젝트당 볼륨 1개 제한으로는 부족합니다. 서비스 추가 전 계정의 현재 요금·Trial 잔액·볼륨 제한을 확인하고, 필요한 요금제 선택과 결제는 직접 진행합니다. 무료 운영이 보장되는 구성은 아닙니다. [볼륨 제한](https://docs.railway.com/volumes/reference)

## 3. PostgreSQL 생성

**Codex 준비:** V1~V7 migration과 JDBC 환경변수 연결 방법을 확인했습니다. PostgreSQL 17에서 전체 배포 준비 검증을 완료했고, 사용자 DB 버전에 맞춰 PostgreSQL 18.6에서 기존 Backend 이미지의 기동·migration·읽기/쓰기를 추가 검증했습니다.

**사용자 작업:**

1. 앞서 만든 프로젝트 화면에서 **New**(또는 추가 메뉴)를 엽니다.
2. **Database → PostgreSQL**을 선택합니다.
3. 생성된 DB 서비스 이름을 확인합니다. 아래 표는 이름이 **Postgres**라고 가정합니다.
4. 서비스가 실행되면 **Variables**에서 `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `RAILWAY_PRIVATE_DOMAIN`이 있는지 확인합니다. 값은 채팅에 보내지 않습니다.
5. DB 서비스의 Volume이 연결되어 있는지 확인합니다. DB용 볼륨을 업로드 볼륨으로 재사용하지 않습니다.
6. **Settings → Source**에서 PostgreSQL 이미지와 버전을 확인합니다. 현재 사용자 DB는 `ghcr.io/railwayapp-templates/postgres-ssl:18`로 실행 중이며 이 버전을 유지합니다. PostgreSQL 17·18 이외의 major 버전이라면 먼저 호환성을 확인합니다. 초기화된 DB 볼륨에 다른 major 이미지로 덮어 실행하지 않습니다. [공식 PostgreSQL 이미지](https://github.com/railwayapp-templates/postgres-ssl)

Backend와 DB는 같은 프로젝트·환경, 가능하면 같은 리전에 둡니다. 애플리케이션 연결에는 공개 주소 대신 내부 네트워크를 사용합니다. [PostgreSQL](https://docs.railway.com/databases/postgresql)

## 4. Backend 서비스 생성과 빌드 설정

**Codex 준비:** [`backend/Dockerfile`](backend/Dockerfile), [`backend/.dockerignore`](backend/.dockerignore), 운영 HTTPS 전달 헤더 설정을 작성했습니다. `PORT`와 운영 Secure 쿠키는 기존 설정을 유지합니다.

**사용자 작업:**

1. 같은 프로젝트에서 **New → Empty Service**로 빈 서비스를 만듭니다. 이름은 `rce-lms-backend`로 정합니다.
2. 서비스의 **Settings → Source**에서 GitHub 저장소 연결 메뉴(**Connect Repo**)를 선택합니다.
3. GitHub 접근 승인이 나오면 본인 계정에서 `RCE-LMS` 저장소 접근을 승인합니다.
4. 저장소 `hannamoon09/RCE-LMS`, 브랜치 `main`을 선택합니다.
5. 아래 설정, 5절의 Variables, 6절의 Volume을 준비한 뒤 **변경사항 Details를 확인하고 Deploy**합니다. 설정 전 자동 빌드가 시작되면 해당 배포를 중단하고 설정부터 마무리합니다.

| Railway Backend 설정 | 입력값 |
| --- | --- |
| Root Directory | `/backend` |
| Builder | 이 폴더의 `Dockerfile` 자동 감지 |
| Build Command override | 비워 둠 — Dockerfile 사용 |
| Start Command override | 비워 둠 — Dockerfile의 `java -jar /app/app.jar` 사용 |
| Pre-deploy Command | 비워 둠 — 앱 시작 시 Flyway 실행 |
| Healthcheck Path | `/api/health` |
| Healthcheck Timeout | `300`초 |
| Replicas | `1` |
| Backend 메모리 한도 | 처음에는 `1 GiB` 이상을 확보하고 Metrics로 조정. 로컬 기동·파일 검증은 1 GiB에서 통과 |
| Serverless / App Sleeping | Private Beta에서는 비활성화 |
| Restart Policy | `On Failure` |

Root Directory에 저장소 루트 `/`를 지정하면 `backend/Dockerfile`을 기대한 방식으로 찾지 못할 수 있습니다. `build.gradle`과 `gradlew`가 있는 `/backend`를 사용하세요. DB 접속 테스트를 Docker Build Command에 넣지 않습니다. [모노레포](https://docs.railway.com/deployments/monorepo), [Dockerfile](https://docs.railway.com/builds/dockerfiles), [변경사항 적용](https://docs.railway.com/deployments/staged-changes)

## 5. Environment Variables 입력

**Codex 준비:** 저장소에는 빈 `.env.example`만 두고, 아래 값은 서비스 설정에서 주입하도록 했습니다.

Backend 서비스를 선택하고 **Variables → New Variable**에서 아래 필수 값을 하나씩 추가합니다. `${{Postgres.…}}`는 Railway가 DB 서비스 값을 참조하는 문법입니다. `Postgres`가 실제 DB 서비스 이름과 다르면 그 이름으로 바꿉니다. UI의 변수 참조 선택기를 사용해도 됩니다.

| 이름 | 서비스 | 필수 여부 | 입력값 / 출처 | 설명 |
| --- | --- | --- | --- | --- |
| `SPRING_PROFILES_ACTIVE` | Railway Backend | 필수 | `prod` | 개발 계정 seed 없이 운영 설정 활성화 |
| `DB_URL` | Railway Backend | 필수 | `jdbc:postgresql://${{Postgres.RAILWAY_PRIVATE_DOMAIN}}:5432/${{Postgres.PGDATABASE}}` | 내부 PostgreSQL JDBC 주소 |
| `DB_USERNAME` | Railway Backend | 필수 | `${{Postgres.PGUSER}}` | DB 사용자 참조 |
| `DB_PASSWORD` | Railway Backend | 필수 | `${{Postgres.PGPASSWORD}}` | DB 비밀번호 참조. 실제 값은 Git에 저장하지 않음 |
| `FILE_STORAGE_PATH` | Railway Backend | 필수 | `/data/uploads` | 6절의 Volume Mount Path와 동일 |
| `SESSION_COOKIE_SECURE` | Railway Backend | 명시 권장 | `true` | 운영 프로필은 설정값과 무관하게 Secure를 강제 |
| `SERVER_ADDRESS` | Railway Backend | 이미지 기본값 | `0.0.0.0` | Dockerfile에 설정됨. `127.0.0.1`로 변경하지 않음 |
| `PORT` | Railway Backend | Railway 자동 제공 | Railway가 지정한 값 | 앱이 `${PORT:8080}`으로 읽음. 직접 고정할 필요 없음 |
| `BACKEND_ORIGIN` | Vercel Frontend | 필수 | Backend의 공개 HTTPS origin | 예: `https://서비스.up.railway.app` 형태. `/api` 경로는 넣지 않음 |
| `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `RAILWAY_PRIVATE_DOMAIN` | Railway Postgres | DB 서비스가 제공 | 생성된 DB 서비스의 Variables | Backend에서 참조하는 원본. Frontend에 복사하지 않음 |

`DATABASE_URL`의 `postgresql://…` 문자열을 `DB_URL`에 그대로 넣지 마세요. Spring JDBC에는 `jdbc:postgresql://…` 형식과 별도 사용자·비밀번호가 필요합니다. DB 이름도 확인합니다. [공식 JDBC 예시](https://docs.railway.com/guides/keycloak-authentication), [변수 참조 문법](https://docs.railway.com/variables/reference)

다음은 **로컬 전용이므로 운영 서비스에 넣지 않습니다**: `DEV_SEED_PASSWORD`, `DB_NAME`, `DB_PORT`, `TEST_DB_URL`, `TEST_DB_USERNAME`, `TEST_DB_PASSWORD`, `API_PROXY_TARGET`. 로컬 `.env` 파일 전체를 대시보드에 복사하지 않습니다. `DB_PASSWORD` 등 서버 비밀에 `VITE_` 접두사를 붙이면 프런트엔드에 노출될 수 있습니다.

Vercel의 `BACKEND_ORIGIN`은 **Production 환경**에 먼저 설정합니다. Preview를 사용하려면 별도 테스트 백엔드·DB·볼륨 주소를 Preview에 설정하세요. 운영 Backend 주소를 모든 Preview에 공유하지 않습니다. 주소가 없는 Preview 빌드는 의도적으로 실패합니다.

## 6. 업로드용 Persistent Volume

**Codex 준비:** 운영 파일 경로는 환경변수로 주입되며, 파일 다운로드는 인증된 `/api/files` 경로를 사용합니다.

**사용자 작업:**

1. Railway 프로젝트에서 **Backend 서비스**를 선택합니다.
2. 서비스에 볼륨을 추가하는 메뉴를 엽니다. 프로젝트의 **New → Volume** 또는 Backend의 컨텍스트 메뉴에서 **Attach Volume**을 사용할 수 있습니다. 메뉴가 다르면 화면을 확인합니다.
3. 연결 대상을 `rce-lms-backend`로 정합니다.
4. **Mount Path에 `/data/uploads`**를 입력합니다.
5. Backend **Variables**로 돌아가 `FILE_STORAGE_PATH=/data/uploads`인지 확인합니다.
6. DB용 볼륨과 별도로 Backend에 이 볼륨이 연결된 것을 확인하고 변경사항을 적용합니다.

이미지는 Railway의 root 소유 볼륨에 쓸 수 있도록 기본 실행 사용자를 유지합니다. 새 볼륨에서 빌드 시점의 `chown`만으로 권한을 해결할 수는 없습니다. 별도의 실행 사용자 변경은 이번 구성에 포함하지 않습니다.

Volume 연결 없이 같은 경로에 쓰면 재배포 시 파일이 사라질 수 있습니다. 볼륨은 서비스 실행 시 마운트되므로 build/pre-deploy 단계에 업로드를 만들지 않습니다. 볼륨을 쓰는 서비스는 단일 인스턴스로 운영하고 재배포 때 짧은 중단을 예상합니다. [Railway Volume](https://docs.railway.com/volumes)

## 7. Backend 첫 배포

**사용자 작업:**

1. DB가 실행 중이고 Backend의 변수·Root Directory·Healthcheck·Volume이 모두 맞는지 확인합니다.
2. 미적용 변경사항의 **Details**를 확인한 뒤 **Deploy**합니다.
3. **Build Logs**에서 Java 21 / Gradle `bootJar` 성공을 확인합니다.
4. **Deploy Logs**에서 `prod` 활성화, DB 연결 성공, Flyway migration 성공, 서버 시작을 확인합니다. 새 DB는 V1~V7이 적용됩니다. 기존 DB는 이미 적용된 migration을 다시 만들지 않습니다.
5. Healthcheck를 통과하고 실행 상태가 정상으로 바뀔 때까지 기다립니다.

`ddl-auto=create`, `create-drop`, Flyway clean, 기존 migration 삭제로 문제를 해결하지 않습니다. 첫 운영 서버에는 자동 생성되는 STAFF나 개발 비밀번호가 없습니다.

## 8. Backend HTTPS와 Health, 최초 STAFF

**사용자 작업:**

1. Backend **Settings → Networking → Public Networking**에서 **Generate Domain**을 선택합니다.
2. Target Port를 묻는다면 로그의 실제 수신 포트/`PORT` 값으로 지정합니다(기본은 `8080`).
3. 생성된 `https://…up.railway.app` 주소를 브라우저에서 열되, 뒤에 `/api/health`를 붙입니다.
4. `{"status":"UP"}`가 보여야 합니다. 이 경로는 DB에 `SELECT 1`까지 수행합니다.
5. `/api/csrf`도 JSON을 반환하는지 확인합니다. 이때 Railway 호스트에서 받은 쿠키는 나중의 Vercel 로그인용 쿠키와 별개입니다.
6. HTTPS **origin만** 기록해 9절의 `BACKEND_ORIGIN`에 사용합니다. 내부 `.railway.internal` 주소는 Vercel에서 접근할 수 없습니다.

Railway Healthcheck는 배포 시작 때의 준비 여부 검사입니다. 계속 실행되는 상시 장애 감시는 별도로 설정해야 합니다. [Healthcheck](https://docs.railway.com/deployments/healthchecks)

최초 운영진 계정은 [STAFF 발급 안내](docs/staff-provisioning.md)의 터미널 도구로 만듭니다. 준비된 명령은 저장소 루트에서 다음과 같습니다.

```sh
bash scripts/provision-staff.sh
```

이 도구는 사용자가 직접 실행하며, DB/계정 비밀번호를 숨김 입력으로 받습니다. DB의 공개 연결 주소는 이 로컬 발급 작업에만 사용하고 Backend의 `DB_URL`은 계속 내부 주소를 사용합니다. 자세한 주소 구성, 대상 확인과 계정 등록은 링크된 문서를 따라갑니다. 개발 seed를 운영에서 켜지 않습니다.

## 9. Vercel 프로젝트 연결

**Codex 준비:** `frontend/vercel.mjs`에 빌드·출력·프록시·SPA 직접 접속 규칙을 작성했습니다.

**사용자 작업:**

1. [Vercel 대시보드](https://vercel.com/dashboard)에 로그인합니다.
2. 기존 RCE 프로젝트를 계속 사용한다면 그 프로젝트의 **Settings**를 엽니다. Git 연결이 없는 경우에만 아래 빌드 설정과 환경변수를 먼저 저장한 다음 **Git → Connect Git Repository**에서 `RCE-LMS`를 연결합니다. 연결이 배포를 시작할 수 있으므로 Backend Health 확인 후 진행합니다. 이미 연결된 현재 프로젝트는 재연결하지 않습니다.
3. 새 프로젝트를 만들 경우 **Add New → Project → Import Git Repository**에서 `RCE-LMS`를 선택합니다.
4. Root Directory를 **`frontend`**로 지정합니다.
5. 아래 빌드 설정을 확인합니다.
6. **Environment Variables**에 `BACKEND_ORIGIN`을 추가하고 Backend 공개 HTTPS origin을 입력합니다. 처음에는 **Production**을 선택합니다. 새 프로젝트라면 Deploy 전에 입력합니다.

| Vercel 설정 | 값 |
| --- | --- |
| Git Repository | `hannamoon09/RCE-LMS` |
| Production Branch | `main` |
| Root Directory | `frontend` |
| Framework Preset | `Vite` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js Version | `22.x` (Vite 요구사항: 22.12 이상) |
| Include source files outside Root Directory | 사용하지 않음 |

`package.json`의 `build`는 `tsc -b && vite build`입니다. 루트 디렉터리에는 `package.json`이 없으므로 Root Directory 설정이 중요합니다. 프런트엔드 빌드에서 백엔드나 테스트 서버를 실행하지 않습니다.

## 10. Frontend 첫 배포

현재 프로젝트는 사용자 터미널에서 저장소 루트의 `git push origin main`으로 수정 커밋을 올립니다. Vercel **Deployments**에서 새 커밋이 선택됐는지 확인합니다. 이전 실패 커밋을 **Redeploy**하면 수정 코드가 포함되지 않습니다. 자동 배포가 시작되지 않으면 **Create Deployment**에서 최신 `main` 커밋을 선택합니다. Railway도 자동 재배포될 수 있으므로 완료 상태를 함께 확인합니다.

1. push로 자동 배포가 시작됐다면 그 배포의 진행 상태를 확인합니다. 새 프로젝트 또는 수동 배포인 경우에만 위 설정을 저장한 뒤 **Deploy**를 누릅니다. Source가 최신 `main` 커밋인지 확인합니다.
2. 빌드 로그에서 TypeScript와 Vite가 성공했는지 확인합니다.
3. 발급된 Vercel HTTPS 주소를 엽니다. 기존 브라우저 쿠키의 영향을 피하려면 새 시크릿 창을 사용합니다.
4. 랜딩과 `/login`이 보이는지, `/login` 주소를 직접 입력하고 새로고침해도 보이는지 확인합니다.
5. 아직 실제 학생 계정은 추가하지 말고 아래 smoke test를 먼저 진행합니다.

## 11. `/api` Rewrite 확인

Vercel 주소 뒤에 `/api/health`를 붙여 `{"status":"UP"}`인지 확인합니다. `/api/csrf`도 JSON이어야 합니다. HTML 랜딩 페이지나 `index.html`이 나오면 API rewrite가 적용되지 않은 상태입니다.

규칙은 다음 순서입니다.

1. `/api` 및 `/api/*` → `BACKEND_ORIGIN`의 같은 `/api` 경로
2. 그 외 프런트엔드 경로 → SPA `index.html` (정적 파일은 정상 제공)

React 코드에는 Railway 호스트를 넣지 않습니다. `BACKEND_ORIGIN`을 변경하면 **새 Vercel 배포**가 필요합니다. 브라우저 Network 탭의 Request URL은 계속 Vercel 호스트여야 합니다.

외부 rewrite는 기본적으로 캐시하지 않으며 이 설정도 API 응답에 `no-store`를 명시합니다. `x-vercel-enable-rewrite-caching`이나 API `s-maxage`를 추가하지 않습니다. [외부 rewrite](https://vercel.com/docs/routing/rewrites)

별도 Vercel Function 프록시는 추가하지 않았습니다. Function의 4.5MB 제한은 현재 파일당 10MiB 정책과 맞지 않습니다. 외부 rewrite의 120초 timeout과 실제 계정의 업로드 동작은 아래에서 확인합니다. **클라우드 프록시의 최대 multipart 크기와 다중 Set-Cookie 전달은 로컬 검증만으로 보증할 수 없습니다.** [Vercel 제한](https://vercel.com/docs/limits), [Function 제한](https://vercel.com/docs/functions/limitations)

## 12. Session / CSRF 확인

Vercel HTTPS 화면에서 브라우저 개발자 도구를 엽니다. Network와 Application(또는 Storage)의 Cookies를 확인합니다. 토큰 값을 복사해 공유하지 않습니다.

| 순서 | 확인할 것 |
| --- | --- |
| `/api/csrf` 요청 | 200, Vercel 호스트에 `XSRF-TOKEN` 쿠키 저장 |
| STAFF 로그인 | `POST /api/auth/login` 200, 요청에 `X-XSRF-TOKEN` 헤더 존재 |
| 로그인 응답 | Vercel 호스트에 `JSESSIONID` 저장, 쿠키 발급/삭제 헤더가 프록시에서 누락되지 않음 |
| 로그인 뒤 CSRF 갱신 | `/api/csrf` 재호출 후 다음 변경 요청 정상 |
| `/api/auth/me` | 200, 로그인한 STAFF와 분야 일치 |
| 페이지 새로고침 | 같은 사용자 유지 |
| 로그아웃 | `POST /api/auth/logout` 204, 이후 `/api/auth/me` 401 |

`JSESSIONID`: Secure·HttpOnly·SameSite=Lax·Path=/, Domain 지정 없음. `XSRF-TOKEN`: Secure·SameSite=Lax·Path=/이며 프런트엔드가 읽으므로 HttpOnly가 아닙니다. API 응답은 `Cache-Control: no-store`여야 하며 캐시 HIT로 사용자 데이터를 돌려주면 안 됩니다.

현재 세션은 Backend 메모리에 저장합니다. **Backend 재배포 후 다시 로그인하는 것은 정상**이며 DB 데이터나 업로드 파일이 없어지는 것과 다릅니다. JWT로 바꾸거나 CORS를 `*`로 열어서 해결하지 않습니다.

## 13. 최소 Smoke Test와 영속성 확인

**Codex 준비:** 로컬 검증과 아래 점검 절차를 제공합니다. 실제 Vercel/Railway 결과는 아직 미확인입니다.

**사용자 작업:** 본인 관리하의 Beta Test STAFF와 MEMBER를 사용합니다. 실제 학생 과제나 제출을 수정하지 않습니다. STAFF 분야 안에 `[BETA SMOKE]`로 시작하는 테스트 과제 하나를 만들고, 다른 시크릿 창에서 MEMBER로 접속합니다.

| 순서 | 작업 | 성공 조건 |
| --- | --- | --- |
| 1 | HTTPS 주소 접속 → CSRF → STAFF 로그인 → `/api/auth/me` | 올바른 계정과 역할 |
| 2 | Dashboard와 과제 목록 열기 | API 오류 없이 실제 목록/빈 상태 표시 |
| 3 | 테스트 MEMBER 생성, 테스트 과제 생성 | STAFF와 같은 분야에 생성 |
| 4 | MEMBER 로그인 → 메모·작은 TXT 파일 제출 | 제출 및 다운로드 성공, 내용 일치 |
| 5 | STAFF에서 제출 검토·테스트 점수 입력 | MEMBER에게 피드백·점수 표시 |
| 6 | 순위 확인 | 테스트 계정의 점수 반영 |
| 7 | 양쪽 로그아웃 | 보호 화면 재접속 시 로그인 필요 |
| 8 | 다시 로그인해 파일 다운로드·점수 기록 | 재배포 전 비교 기준 확보 |
| 9 | 사용자가 Railway Backend 재배포 | 새로 로그인한 뒤 계정·과제·제출·점수·파일 유지 |
| 10 | 운영 개시 전 DB 서비스 재시작 점검 | 다시 정상 연결되고 같은 데이터와 Flyway 이력 유지 |

8~10번은 학생을 초대하기 전이나 공지한 점검 시간에 수행합니다. DB/Volume 삭제·재생성, DROP, TRUNCATE, Reset은 사용하지 않습니다. 제출물이 있는 과제 삭제가 제한되는 현재 동작도 그대로 유지합니다. 테스트 자료는 구분된 이름으로 남겨두거나 지원되는 관리 절차로만 정리합니다.

운영 개시 전 **업로드 상한 추가 확인**도 같은 테스트 과제에서 한 번 수행합니다. 개인정보 없는 TXT 파일을 사용해 10MiB 파일 1개, 최대 5개(총 50MiB + multipart 부가 데이터)를 업로드하고 다운로드 내용을 비교합니다. 현재 서버 제한은 파일당 10MiB·최대 5개·전체 요청 52MB입니다. 느린 연결에서 120초를 넘거나 프록시가 크기를 거절하면 실제 제한을 확인한 뒤 해결하며 성공으로 표시하지 않습니다.

기존 로컬 Playwright 99개 전체 검사와 `scripts/e2e-test.sh`를 운영 주소/DB에 연결해 실행하지 않습니다.

### 배포 성공 체크

- [ ] GitHub 소스·Secret 제외 확인
- [ ] Vercel Frontend HTTPS 정상
- [ ] Railway Backend 및 PostgreSQL 정상
- [ ] Flyway 정상, `ddl-auto=validate`
- [ ] Backend Volume이 `/data/uploads`에 연결됨
- [ ] Vercel `/api/health`·CSRF·Session 로그인 정상
- [ ] 파일 업로드·다운로드 및 최대 크기 점검 성공
- [ ] Backend 재배포 후 파일과 DB 데이터 유지
- [ ] DB 재시작 후 데이터 유지
- [ ] 로그아웃 및 로그인하지 않은 API 접근 차단 정상

모든 실제 항목을 확인하기 전에는 배포 성공으로 판정하지 않습니다.

## 14. 자동 배포와 운영 백업

첫 smoke test 성공 후에 GitHub `main` 연결을 유지하면 다음 흐름으로 운영합니다.

```text
코드 수정 → 로컬 Build/Test → Git Commit → main Push
                                  ├─ Vercel Frontend 배포
                                  └─ Railway Backend 배포
```

Vercel Production Branch와 Railway Service Source Branch가 모두 `main`인지 확인합니다. 실제 DB migration을 바꾸는 릴리스는 이전 migration을 수정하지 않고 새 파일을 추가합니다. 두 서비스의 배포 완료 순서는 보장되지 않으므로 API 변경은 이전 프런트엔드와도 호환되도록 계획합니다.

평소 로컬 확인 명령(저장소 루트):

```sh
npm --prefix frontend run build
npm --prefix frontend run test:backend
```

흐름·권한·파일 처리를 수정했다면 해당 로컬 E2E도 실행합니다. 이 테스트는 로컬 전용 DB를 사용하며 운영 Secret을 로컬 테스트 `.env`에 넣지 않습니다. GitHub Actions는 이번 필수 구성에 추가하지 않았습니다.

Railway에서 **PostgreSQL Volume과 업로드 Volume 각각**의 **Backups**를 열어 원하는 자동 백업 주기를 설정합니다. 계정의 비용·보존기간을 확인하고, 정기적으로 복원 가능 여부도 점검합니다. 두 볼륨은 독립적이므로 자동 백업 시각이 같다고 데이터·파일의 일관성이 보장되지는 않습니다. 일관된 복구 지점이 필요하면 쓰기를 잠시 중단한 상태에서 DB와 파일을 함께 백업하고 같은 시점의 쌍으로 복원합니다. [백업 안내](https://docs.railway.com/volumes/backups)

## 15. 문제 발생 시 먼저 확인할 곳

| 문제 | 먼저 확인 |
| --- | --- |
| Frontend Build 실패 | Vercel Root가 `frontend`인지, Node 22.x인지, `npm ci`/lockfile이 맞는지, 첫 TypeScript 오류 |
| Root Directory `frontend` does not exist | 배포 Source 커밋 확인. 과거 `870d3f0`에는 `frontend/`가 없으므로 최신 `main`을 배포. 현재 Root 설정 `frontend`는 유지 |
| `headers[0]` missing required property `headers` | 2026-10-18 SDK helper 수정이 포함된 최신 커밋인지 확인. `33a1ca4` 재배포로는 수정이 반영되지 않음. `@vercel/config`와 lockfile도 함께 필요 |
| BACKEND_ORIGIN 설정 오류 | Production 변수에 HTTPS origin만 있는지. `/api`, 비밀번호, 공백, query 제거 후 재배포 |
| Backend Build 실패 | Root `/backend`, Dockerfile 감지, Gradle 다운로드·컴파일 로그. DB Secret은 이미지 빌드에 필요 없음 |
| DB Connection 실패 | 같은 프로젝트·환경인지, `jdbc:postgresql://` 형식과 서비스 참조 이름·DB 이름 확인 |
| Flyway 실패 | Deploy Logs의 첫 migration 오류와 현재 버전 확인. checksum 오류를 기존 SQL 삭제/초기화로 해결하지 않음 |
| 502 / 503 | Backend 실행·health·DB 상태, `PORT`, `SERVER_ADDRESS`, Railway 공개 도메인의 Target Port 확인 |
| `/api` 404 또는 HTML | Vercel 최신 설정 배포 여부, `BACKEND_ORIGIN`에 `/api`가 중복되지 않았는지, rewrite 순서 확인 |
| 로그인 성공 후 `/api/auth/me` 401 | 브라우저 요청이 모두 Vercel 호스트인지, JSESSIONID 저장/전송 여부, Backend 재시작·복제본 수 확인 |
| CSRF 403 | 같은 호스트의 XSRF-TOKEN, X-XSRF-TOKEN 헤더, 로그인 후 CSRF 재발급 확인. 새 시크릿 창에서도 재현되는지 확인 |
| Cookie가 저장되지 않음 | HTTPS인지, 응답 Set-Cookie·브라우저 차단 사유 확인. Secure를 끄거나 Domain을 임의 추가하지 않음 |
| 업로드 후 파일 사라짐 | Volume이 DB가 아닌 Backend에 연결됐는지, Mount Path와 FILE_STORAGE_PATH 일치 여부 |
| Permission denied / 파일 저장 실패 | 실행 사용자 변경 여부, Volume 쓰기 권한과 잔여 용량, FILE_STORAGE_PATH 확인 |
| Vercel에서 Backend 연결 실패 | Vercel 변수는 공개 HTTPS 주소인지. `.railway.internal`이나 localhost는 사용할 수 없음 |
| 업로드 413 / timeout | 파일당 10MiB·5개·전체 52MB 제한과 외부 rewrite 120초 확인. 서버 로그에 요청이 도달했는지 확인 |
| STAFF 로그인 불가 | seed 계정은 운영에 없음. 발급 도구의 성공 여부·분야·학번 확인. 비밀번호/해시는 채팅에 보내지 않음 |
| 재배포 후 로그아웃됨 | 현재 메모리 세션 구조의 정상 동작. 다시 로그인해 DB·파일 보존을 확인 |

문제를 전달할 때 서비스 이름, 시각, HTTP 상태, 비밀을 가린 첫 오류 부분을 보내주세요. Variables 전체 화면, 쿠키 값, DB 비밀번호는 보내지 않습니다.
