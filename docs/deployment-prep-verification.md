# 배포 준비 검증 기록

최종 기록일: 2026-10-18 (Asia/Seoul)

판정: **Railway Backend·DB 배포 및 공개 Health 확인 완료 / Vercel 설정 수정·로컬 검증 완료 / 수정 커밋 push 및 실제 Vercel 배포 확인 대기**.

중단 전에 완료한 Backend·DB·전체 E2E 검증 결과를 보존했습니다. 10월 16일에는 사용자 DB 버전에 맞춰 PostgreSQL 18 호환성을, 10월 18일에는 실패한 Vercel 설정과 추가된 의존성의 프런트엔드 빌드만 추가 검증했습니다. 최초 저장소 감사와 빌드 근거는 [저장소 감사](repository-upload-audit.md), 실제 클릭·입력 절차는 [DEPLOYMENT.md](../DEPLOYMENT.md)에 있습니다.

## 최종 업로드 점검

2026-10-16 변경된 추적 파일 5개와 새 파일 7개를 대상으로 실제 로컬 Secret 값의 복사 여부와 주요 토큰·개인키 패턴을 검사해 발견 사항 0건을 확인했습니다. 추적·미추적·무시 파일 목록을 구분했으며 `.env`, 의존성, 빌드·테스트 결과, 업로드 원본은 커밋 후보에 없습니다. 문서의 로컬 파일 링크와 변경분 공백 검사도 통과했습니다.

2026-10-18 수정 대상은 설정·의존성·문서 5개뿐입니다. 로컬 Secret 값 및 주요 토큰·개인키 패턴 발견 0건, 미추적 커밋 후보 0건을 확인했습니다. `.env`, `node_modules`, `dist`는 계속 무시되며 변경분 공백 검사도 통과했습니다.

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

`frontend/vercel.mjs`는 공식 named `config` export를 사용합니다. `BACKEND_ORIGIN`은 설정 평가 시 읽고 프런트엔드 JS 번들에 주입하지 않습니다.

10월 17일 실제 Git 배포(`33a1ca4`)에서는 `headers[0] missing required property headers`로 빌드 전에 실패했습니다. 아래 기존 Node 평가·스키마 검사는 Vercel의 Git 배포 사전 처리까지 검증한 것이 아니었으며, 이 오류를 검출하지 못했습니다.

- 잘못되거나 비어 있는 origin **15가지** 거부, 오류 메시지에 입력된 인증정보 미노출 확인.
- 유효한 origin **3종 × 경로 9개 = 27개** 라우팅 검증 통과.
- API 경로의 캐시 금지 헤더 **15개 경우** 검증 통과.
- `node --check` 통과.
- 공식 `@vercel/routing-utils@6.6.0` 변환기로 API·SPA 규칙 확인.
- 검증 중 끝 슬래시 경로 누락을 발견해 `/api/(.*)` 규칙으로 수정하고 재검증. `/api`, `/api/`, 중첩 API를 모두 프록시하고 프런트 경로는 SPA로 처리.
- 공식 설정 스키마에서 사용 중인 속성 6개의 제약 검증 통과. 전체 스키마의 사용하지 않는 `experimentalTriggers`에 Draft 버전 불일치가 있어, 해당 미사용 속성 분기를 제외하고 적용 속성만 검사했습니다.

10월 18일에는 세 rewrite와 두 header 항목을 `@vercel/config@0.12.0`의 `routes.rewrite()`·`routes.header()` 호출로 변경하고 `package.json`/lockfile에 빌드용 의존성을 고정했습니다. Vercel 공식 예제에서도 동적 일반 객체의 `destination` 누락 오류 이후 같은 helper 방식으로 변경했습니다. [공식 예제 오류](https://github.com/vercel/examples/pull/1428#issuecomment-4034962877), [후속 수정](https://github.com/vercel/examples/pull/1429/files)

이 사례를 근거로 동적 헤더 참조와 rewrite를 함께 수정했습니다. 구체적인 클라우드 사전 추출기의 내부 원인은 확인하지 못했으므로 추론으로 남깁니다. 공유 배열 자체가 잘못된 JavaScript인 것은 아닙니다.

수정 후 검증:

- 앞의 origin 거부 15가지, 라우팅 27개, API 캐시 헤더 15개 경우와 사용 속성 스키마 검사 통과.
- 별도 검토에서 공개 Vercel CLI와 같은 esbuild 번들링·자식 프로세스 IPC 방식으로 기존 HEAD와 수정본을 비교했습니다. origin 3종 모두 설정 JSON 및 변환된 라우팅이 동일했고, 경로 27개·잘못된 origin 4종·오류의 인증정보 미노출·사용 속성 스키마 검사를 통과했습니다(Node 26.10.0 / esbuild 0.27.0). 이 방식에서는 기존 설정도 통과하므로 실제 Git 사전 처리 오류의 재현 검사는 아닙니다.
- Node **22.23.3**에서 `npm ci` 및 `npm run build` 성공(TypeScript + Vite **7.3.6**).
- Backend 코드·설정·migration 변경 없음. 기존 Backend·DB·전체 E2E 검사는 반복하지 않음.

수정본은 아직 실제 Vercel Git 배포에서 확인하지 않았습니다. 배포 완료 후 프록시가 쿠키와 큰 multipart를 전달하는 결과를 확인해야 합니다.

## 사용자 배포 진행 상황

- 10월 16일 화면: Railway `sincere-presence` Backend 및 Postgres 모두 Online, 각각 별도 볼륨 연결.
- 10월 17일 읽기 전용 HTTP 확인: `https://sincere-presence-production.up.railway.app/api/health` → **200**, `{"status":"UP"}`. 해당 health는 실제 DB `SELECT 1`을 수행합니다.
- Vercel `rce-lms` 프로젝트는 `frontend`, Vite, `npm ci`, `npm run build`, `dist`, Node 22.x로 설정된 화면을 확인했습니다. `BACKEND_ORIGIN` 저장 결과와 Root 밖 파일 포함 옵션의 최종 상태는 아직 직접 확인하지 못했습니다.
- 사용자 화면의 현재 Production은 이전 `870d3f0` 배포입니다. 최신 `33a1ca4` 배포는 위 설정 오류로 실패했습니다.
- 이후 push는 Vercel과 Railway 자동 배포를 시작할 수 있으므로, 실제 배포는 사용자가 수행한다는 원래 요청에 따라 수정 커밋 push를 다음 사용자 단계로 남겼습니다.

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

- 수정 커밋의 실제 Vercel 배포 성공, 최신 화면의 HTTPS 접속. Railway Backend·DB의 Online 및 공개 Health는 확인했지만 업로드 볼륨의 실제 파일 쓰기·보존은 아직 미확인.
- Vercel → Railway의 `/api` 전달, 로그인·CSRF·복수 Set-Cookie·로그아웃.
- 현재 정책 상한인 파일당 10MiB·최대 5개 업로드와 다운로드. 로컬의 작은 파일 성공이 클라우드 상한 성공을 의미하지 않습니다.
- 실제 Backend 재배포 후 DB·파일 유지, DB 서비스 재시작 후 데이터 유지.
- 최소 STAFF/MEMBER 과제·제출·검토·순위 흐름과 백업 설정.

기존 99개 로컬 E2E를 운영 DB에서 실행하지 않습니다. 실제 확인이 끝나기 전에는 Production 성공 판정을 내리지 않습니다.
