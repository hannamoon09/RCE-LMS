# GitHub 업로드 전 감사

검사일: 2026-10-13 (Asia/Seoul)

## 현재 단계

- STEP 1 Repository 감사: 완료
- STEP 2 GitHub 업로드 준비: 완료
- STEP 3 GitHub Push: 사용자 작업 대기 — 기존 Vercel Git 연결 상태 확인 필요
- STEP 4~12 배포 구성·가이드: GitHub Push 이후 진행

실제 배포나 계정·대시보드 설정 변경은 수행하지 않았습니다. 아직 Railway/Vercel 배포 준비가 완료되었다는 의미가 아닙니다.

## Git과 원격 저장소

- 기존 저장소와 `main` 브랜치를 유지했습니다. 새 `git init`, history 삭제, reset, force push를 사용하지 않았습니다.
- 기존 `origin`: `https://github.com/hannamoon09/RCE-LMS.git`
- GitHub 인증 조회로 Private 저장소, 기본 브랜치 `main`, push 권한을 확인했습니다. 새 저장소를 생성할 필요가 없습니다.
- 감사 시작 시 로컬 `main`과 원격 `main`은 모두 `870d3f0cd102a9e06c0a63ecde0565f95fc9cb18`이었습니다.
- 이전 프런트엔드 중심 구조에서 `frontend/`, `backend/`로 분리한 현재 변경사항을 보존합니다.

## 업로드 대상 검사

추적 파일, 추적되지 않은 파일, 무시되는 파일을 구분한 뒤 업로드 후보를 검사했습니다.

| 항목 | 결과 |
| --- | --- |
| Frontend/Backend source | 포함 |
| `frontend/package.json`, lockfile | 포함, 의존성 명세 일치 |
| Gradle Wrapper/JAR/properties, 실행 권한 | 포함, 정상 |
| Flyway V1~V7 | 포함, 계정 데이터 INSERT 없음 |
| `compose.yaml`, README, 테스트 코드 | 포함 |
| `.env.example` | 포함, 값은 비어 있음 |
| 실제 `.env` | 제외 |
| 업로드 원본, 로컬 DB·덤프 | 업로드 후보에 없음, 제외 규칙 보완 |
| 의존성·빌드·임시 테스트 결과·로그 | 제외 |
| IDE·OS 파일, 개인키·백업 파일 | 제외 규칙 보완 |

`.gitignore`는 SQL 전체를 제외하지 않습니다. Flyway migration과 필요한 소스는 유지합니다. 실제 로컬 Secret이나 업로드 파일은 삭제하지 않았습니다.

## Secret과 개인정보

결과: **PASS — 검사 범위에서 실제 Secret 유출을 발견하지 못함**.

- 현재 업로드 후보 텍스트와 기존 브랜치 이력 3개 커밋을 검사했습니다.
- 개인키, 주요 서비스 토큰, 인증정보가 포함된 URL, 리터럴 비밀번호 패턴을 확인했습니다.
- 로컬 `.env`의 DB 비밀번호와 개발 seed 비밀번호가 후보 파일이나 기존 커밋에 복사되어 있지 않은지 실제 값 대조로 확인했습니다. 값은 보고서에 기록하지 않았습니다.
- 백엔드·Compose의 접속 비밀번호는 환경변수로 주입합니다. 운영 DB 데이터나 파일 원본은 저장소에 없습니다.
- 현재 테스트 코드의 비밀번호·학번·이메일은 격리된 검사 fixture입니다. 기존 이력의 mock 인증 정보도 명시적인 데모 데이터이며 운영 자격증명으로 판단할 근거가 없습니다.
- 검증 PNG 25개를 모두 확인했습니다. 개발/E2E 데이터이며 실제 학생 개인정보·사진·평문 비밀번호를 발견하지 못했습니다. 자세한 취급 기준은 [검증 자료 안내](verification/README.md)에 있습니다.
- 보고서의 개인 컴퓨터 절대경로는 제거했습니다.
- 기존 커밋의 작성자/커미터 이메일 메타데이터는 기존 이력과 함께 보존했습니다.

이 결과는 패턴 검사, 로컬 Secret 대조와 수동 검토에 근거합니다. 앞으로 추가되는 파일이나 모든 종류의 알려지지 않은 Secret을 보증하는 것은 아닙니다.

## 빌드·검증 근거

이번 감사에서 실행한 빌드:

- `npm --prefix frontend run build`: TypeScript/Vite production build PASS.
- Java 21로 `backend/gradlew bootJar --rerun-tasks` 실행: PASS, 실제 task 4개 실행.
- JAR에 migration 7개 포함, 테스트 클래스와 테스트 설정 미포함을 확인했습니다.
- `LocalFileStorage.java`의 `PathResource` 사용에 폐기 예정 경고 1개가 있으며 빌드는 통과했습니다.

기존 [MVP E2E 결과](mvp-e2e-report.md)는 Playwright 99개·backend 94개 PASS를 기록합니다. 기존 backend XML 결과의 94개 검사와 실패·오류·건너뜀 0을 확인했고, 신규 E2E 소스 3개의 기록된 SHA-256이 현재 파일과 일치합니다. 이번 감사에서 DB·브라우저 테스트를 다시 실행하지는 않았습니다.

## Push 전에 필요한 사용자 작업

GitHub의 현재 `main` 커밋에 `Vercel: Deployment has completed` 상태와 과거 `Production` 환경 배포 기록이 있습니다. 이는 과거 프런트엔드 배포 연결의 증거이며, 현재 LMS 전체가 운영 배포되었다는 뜻은 아닙니다. 지금도 자동 배포가 활성화되어 있는지는 GitHub 기록만으로 확정할 수 없습니다.

사용자가 실제 배포를 직접 수행하도록, Push 전에 Vercel에서 이 저장소에 연결된 프로젝트의 Git 연결을 확인하고 필요하면 잠시 해제합니다. 계정 설정은 Codex가 변경하지 않습니다. 연결 해제 또는 이미 해제된 상태가 확인되면 원격 브랜치를 다시 확인한 뒤 일반 Push를 진행합니다.

배포 준비를 마친 후 사용자가 Git 연동을 다시 설정합니다. 현재 단계에서는 배포 설정을 먼저 추가하거나 자동 배포를 실행하지 않습니다.
