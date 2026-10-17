# 변경 기록

## 1.0.0 — 2026-10-18

RCE LMS의 첫 버전 릴리스입니다. 동아리 Private Beta 운영을 위한 기존 기능과 배포 구성을 묶었습니다.

- React 프런트엔드와 Spring Boot·PostgreSQL을 연결한 계정, 과제, 제출, 파일, 검토, 순위, 공지, 프로필 기능.
- Spring Security 세션·CSRF 인증, STAFF/MEMBER 역할 및 분야별 접근 제어.
- Flyway V1~V7, 운영 환경의 개발 계정 자동 생성 차단, 별도 최초 STAFF 발급 도구.
- Vercel의 같은 출처 `/api` 프록시와 Railway의 Java 21 Docker 빌드·PostgreSQL·업로드 볼륨 배포 구성.
- Vercel SDK helper를 사용한 동적 rewrite/header 설정 오류 수정.

이번 릴리스 커밋은 프런트엔드·백엔드 버전을 `1.0.0`으로 맞추고 실행 스크립트의 JAR 경로와 문서를 갱신합니다. 애플리케이션 기능·의존성 버전·DB migration은 기존 배포 커밋 `032b31d`와 같습니다.

### 확인 범위

기존 로컬 Backend 94개·Playwright 99개 검사 및 별도 배포 설정 검증 결과를 보존합니다. 운영 환경에서는 Vercel·Railway 배포, HTTPS, `/api/health`, CSRF, 최초 STAFF 로그인과 대시보드 접근을 확인했습니다.

운영 환경의 MEMBER 제출→STAFF 검토→순위, 파일 업로드 상한, 재배포 후 DB·파일 보존, 백업·복구 확인은 남아 있습니다. `1.0.0` 표시는 버전 기준점이며 이 점검들이 완료됐다는 의미는 아닙니다. 상세 근거는 [배포 검증 기록](docs/deployment-prep-verification.md)에 있습니다.

Backend 세션은 메모리에 저장하므로 재배포 후 다시 로그인해야 합니다.
