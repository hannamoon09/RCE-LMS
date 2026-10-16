# 배포 준비 검증 기록

최종 기록일: 2026-10-16 (Asia/Seoul)

판정: **코드·문서 배포 준비 완료 / 사용자 Railway DB 생성 완료 / Backend·Frontend 배포 대기**.

중단 전에 완료한 검증 결과를 보존하고, 재개 후에는 기존 성공 검사를 반복하지 않았습니다. 사용자 DB가 PostgreSQL 18로 생성되어 해당 버전의 호환성만 추가 검증했습니다. 최초 저장소 감사와 빌드 근거는 [저장소 감사](repository-upload-audit.md), 실제 클릭·입력 절차는 [DEPLOYMENT.md](../DEPLOYMENT.md)에 있습니다.

## 최종 업로드 점검

2026-10-16 변경된 추적 파일 5개와 새 파일 7개를 대상으로 실제 로컬 Secret 값의 복사 여부와 주요 토큰·개인키 패턴을 검사해 발견 사항 0건을 확인했습니다. 추적·미추적·무시 파일 목록을 구분했으며 `.env`, 의존성, 빌드·테스트 결과, 업로드 원본은 커밋 후보에 없습니다. 문서의 로컬 파일 링크와 변경분 공백 검사도 통과했습니다.

## Backend 이미지와 영속성

`docker build --progress=plain -t rce-lms-deploy-check:20261014 backend`가 완료된 이미지를 사용했습니다. Dockerfile은 Java 21 JDK 빌드 단계와 Java 21 JRE 실행 단계로 구성되며, DB 접속·Secret 없이 `bootJar`를 만듭니다. `.dockerignore`는 필요한 production 빌드 입력만 허용합니다.

기존 개발 DB와 별개의 PostgreSQL 17, 네트워크, DB 볼륨, 업로드 볼륨을 만들어 다음 **26개 assertion**을 통과했습니다. Backend 메모리 한도는 1 GiB, 앱 포트는 기본값과 다른 `18080`, 호스트 접근은 루프백에만 바인딩했습니다.

- Docker 기본 `prod` 프로필, `PORT=18080`으로 정상 기동.
- `/api/health`가 실제 PostgreSQL 연결과 함께 정상 응답.
- Flyway migration 7개 적용 및 개발 계정 0개. 개발 seed 비밀번호를 주입해도 seed 미실행.
- 신뢰된 프록시의 `X-Forwarded-Proto: https` 처리 시 HSTS 활성화, 일반 HTTP에서는 HSTS 미설정.
- `SESSION_COOKIE_SECURE=false`를 주입해도 운영 세션·CSRF 쿠키는 Secure 유지.
- 실제 BCrypt STAFF 로그인, 세션·CSRF 쿠키 속성 확인.
- 실제 multipart TXT 파일 업로드와 인증된 다운로드 성공, 파일 응답 `no-store` 확인.
- Backend 컨테이너 삭제 후 같은 DB·업로드 볼륨으로 새 컨테이너 생성.
- 이전 메모리 세션은 401, 새 로그인 성공. 사용자·과제·파일 메타데이터와 파일 원본 바이트 유지.
- 재기동 후에도 migration 7개 유지.

검증에서 생성한 컨테이너·네트워크·볼륨은 모두 정리했습니다. 기존 개발 DB/업로드와 실제 운영 DB는 수정하지 않았습니다. 이 검증은 Railway 자체를 배포한 결과가 아닙니다.

## PostgreSQL 18 추가 호환성 확인

2026-10-16 사용자 화면에서 Railway Postgres의 이미지 `ghcr.io/railwayapp-templates/postgres-ssl:18`, Online 상태, `postgres-volume` 연결을 확인했습니다. 이미 초기화된 DB의 major 버전은 변경하지 않습니다.

기존 Backend 이미지 `rce-lms-deploy-check:20261014`를 재빌드 없이 사용해, 별도의 로컬 `postgres:18-alpine`(실제 서버 버전 **18.6**)에서 다음을 포함한 **9개 assertion**을 통과했습니다.

- `prod` 기동, `PORT=18080`, `/api/health` 200 및 `UP` 응답.
- Hibernate 스키마 검증과 Flyway migration 7개 적용 성공.
- 개발 seed 환경변수를 주입해도 사용자 0개 유지.
- DB 제약조건을 만족하는 임시 사용자 쓰기·읽기 성공, 트랜잭션 롤백 후 사용자 0개 유지.

검사용 컨테이너·네트워크·DB 볼륨과 이번에 받은 DB 이미지를 정리했습니다. 기존 개발 DB와 Railway에는 접근하지 않았습니다. 이 결과는 PostgreSQL 18 자체의 호환성 확인이며 Railway 이미지의 SSL 설정·내부 네트워크 연결·실제 배포 성공은 Backend 배포 때 확인합니다.

## Vercel 설정

`frontend/vercel.mjs`는 추가 npm 의존성 없이 공식 named `config` export를 사용합니다. `BACKEND_ORIGIN`은 설정 평가 시 읽고 프런트엔드 JS 번들에 주입하지 않습니다.

- 잘못되거나 비어 있는 origin **15가지** 거부, 오류 메시지에 입력된 인증정보 미노출 확인.
- 유효한 origin **3종 × 경로 9개 = 27개** 라우팅 검증 통과.
- API 경로의 캐시 금지 헤더 **15개 경우** 검증 통과.
- `node --check` 통과.
- 공식 `@vercel/routing-utils@6.6.0` 변환기로 API·SPA 규칙 확인.
- 검증 중 끝 슬래시 경로 누락을 발견해 `/api/(.*)` 규칙으로 수정하고 재검증. `/api`, `/api/`, 중첩 API를 모두 프록시하고 프런트 경로는 SPA로 처리.
- 공식 설정 스키마에서 사용 중인 속성 6개의 제약 검증 통과. 전체 스키마의 사용하지 않는 `experimentalTriggers`에 Draft 버전 불일치가 있어, 해당 미사용 속성 분기를 제외하고 적용 속성만 검사했습니다.

Vercel 프로젝트 생성·계정 설정·클라우드 배포를 수행하지 않았습니다. 프록시가 실제로 쿠키와 큰 multipart를 전달하는 결과는 배포 후 확인해야 합니다.

## 최초 STAFF 발급 도구

`scripts/provision-staff.sh`와 `backend/tools/ProvisionStaff.java`는 운영 API·자동 seed와 분리된 로컬 운영자 도구입니다. 운영 JAR 및 Docker 이미지에는 도구를 넣지 않습니다.

로컬 전용 `rce_lms_test`에서 실제 대화형 터미널로 다음을 확인했습니다.

- 잘못된 URL의 오류 처리: stack trace나 입력 Secret 노출 없이 종료.
- 최종 확인 취소: 계정 0건 생성.
- `CREATE STAFF` 확인: 활성 STAFF 한 건 생성, 저장한 BCrypt를 앱과 같은 인코더로 검증.
- 동일 학번 재등록: 롤백, 기존 해시를 포함한 전체 행 불변.
- DB/초기 비밀번호가 터미널 출력에 노출되지 않음.
- 임시 라이브러리 폴더 정리, `bash -n` 통과, 운영 JAR에 도구 미포함.

검사에서 만든 계정만 삭제했고, 검사 전후 업무 테이블 9개의 전체 행 지문이 일치했습니다. 실제 운영 계정은 생성하지 않았습니다.

## 실제 배포 후 남은 확인

아래 항목은 **미실행**이며 [가이드의 smoke test](../DEPLOYMENT.md#13-최소-smoke-test와-영속성-확인)로 사용자가 확인합니다.

- 실제 Railway Backend·업로드 Volume과 Vercel 프로젝트 설정, HTTPS 접속. DB Online·DB 볼륨 연결은 사용자 화면으로 확인했으며, Backend에서의 DB 연결은 아직 미확인.
- Vercel → Railway의 `/api` 전달, 로그인·CSRF·복수 Set-Cookie·로그아웃.
- 현재 정책 상한인 파일당 10MiB·최대 5개 업로드와 다운로드. 로컬의 작은 파일 성공이 클라우드 상한 성공을 의미하지 않습니다.
- 실제 Backend 재배포 후 DB·파일 유지, DB 서비스 재시작 후 데이터 유지.
- 최소 STAFF/MEMBER 과제·제출·검토·순위 흐름과 백업 설정.

기존 99개 로컬 E2E를 운영 DB에서 실행하지 않습니다. 실제 확인이 끝나기 전에는 Production 성공 판정을 내리지 않습니다.
