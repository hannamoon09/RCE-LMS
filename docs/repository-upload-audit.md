# GitHub 업로드 전 감사

검사일: 2026-10-13 (Asia/Seoul)

## 현재 단계

- STEP 1 Repository 감사: 완료
- STEP 2 GitHub 업로드 준비: 완료
- STEP 3 GitHub Push: 완료 — 2026-10-14 `1f1b1b4` 업로드 및 원격 일치 확인
- STEP 4 배포 구성: Vercel + Railway 확정
- STEP 5~12 배포 구성·가이드: 코드·문서 준비 및 로컬 검증 완료 (2026-10-16 최종 정리)

실제 배포나 계정·대시보드 설정 변경은 수행하지 않았습니다. [배포 가이드](../DEPLOYMENT.md)와 [배포 준비 검증 기록](deployment-prep-verification.md)을 따라 사용자가 실제 서비스를 생성·배포하고 smoke test를 확인할 단계입니다.

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

기존 [MVP E2E 결과](mvp-e2e-report.md)는 Playwright 99개·backend 94개 PASS를 기록합니다. 최초 감사에서 기존 backend XML 결과의 94개 검사와 실패·오류·건너뜀 0을 확인했고, 신규 E2E 소스 3개의 기록된 SHA-256이 당시 파일과 일치했습니다. 전체 기존 테스트는 다시 실행하지 않았습니다. 이후 새 배포 설정과 STAFF 도구에 대해 수행한 격리 검증은 [별도 기록](deployment-prep-verification.md)에 있습니다.

## 최초 Push와 자동 배포 연결 확인 기록

감사 시작 시 GitHub의 `870d3f0` 커밋에 `Vercel: Deployment has completed` 상태와 과거 `Production` 환경 배포 기록이 있었습니다. 이는 과거 프런트엔드 배포 연결의 증거이며, 현재 LMS 전체가 운영 배포되었다는 뜻은 아닙니다.

사용자가 2026-10-14 Vercel Git 연결을 해제했다고 확인한 뒤, 원격 브랜치를 다시 확인하고 일반 Push를 진행했습니다. 원격 `main`이 `1f1b1b4cb067b3e9e6fa521663a7dd270289b2e1`과 일치함을 확인했습니다. 계정 설정은 Codex가 변경하지 않았습니다.

최초 Push 이후에만 배포 설정을 추가했습니다. Backend Health와 Vercel 설정을 준비한 뒤 사용자가 Git 연동을 다시 연결합니다. 순서는 [배포 가이드](../DEPLOYMENT.md)에 있습니다.
