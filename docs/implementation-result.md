# RCE LMS 구현 결과

2026-10-08 문서 마무리 기준. 중단 시점의 변경사항과 2026-10-07 완료된 검증 결과를 복구하여 이어서 구현했습니다. 기존 React 페이지·테마·타이포그래피·Anime.js·프로필 자르기 UX를 유지했습니다. 마지막 재개에서는 통과한 구현과 전체 테스트를 반복하지 않고 실행·운영 문서, 문서 링크와 로컬 서버 상태를 확인했습니다.

2026-10-12 폴더 분리와 이후 운영 정리에 맞춰 아래 Architecture·Security·Frontend·Mock 설명을 갱신했습니다. 최신 cleanup 검증과 요구사항별 결과는 [운영 정리 감사 보고서](production-cleanup-audit.md)를 참고하세요. 이 문서의 Tests와 Build 수치는 기존 구현 완료 당시의 기록입니다. 폴더 분리 후 별도로 확인한 프론트엔드 빌드·백엔드 bootJar·관련 회귀 검사 17개 결과는 [구현 진행 기록](implementation-progress.md)의 2026-10-12 항목에 정리했습니다.

## Architecture

React/Vite의 소스·정적 파일·의존성·빌드 설정·Playwright 검사는 `frontend/`, Java 서버·Gradle 설정·Flyway SQL은 `backend/`에 분리했습니다. `compose.yaml`, `.env`/`.env.example`, `scripts/`, `docs/`, `deploy/`, 비공개 원본을 보관하는 `backend-data/`는 프로젝트 루트에 둡니다. 루트에는 `package.json`이 없으므로 프론트엔드 명령은 루트에서 `npm --prefix frontend …`로 실행하거나 `frontend/` 안에서 실행합니다. 프론트엔드 빌드 결과는 `frontend/dist/`입니다.

`compose.yaml`은 PostgreSQL을 실행합니다. 브라우저는 같은 출처의 `/api`를 호출하며 운영 환경은 `deploy/nginx.conf`의 HTTPS 프록시 예시를 사용합니다. PostgreSQL과 비공개 파일 저장소가 영속 데이터의 원본입니다. 현재 실행 방법은 [README](../README.md)를 참고하세요.

## Backend

Java 21, Spring Boot 4.1.1, Gradle Wrapper, JPA/Validation, PostgreSQL 및 Flyway로 인증·과제·제출·파일·학생 관리·검토·공지·랭킹·프로필·알림 설정 API를 구현했습니다. 공통 오류 응답과 Request/Response DTO를 사용합니다.

## Security

HttpOnly HTTP Session, 명시적인 SecurityContext 저장, 로그인 시 세션 ID 변경, SPA CSRF 토큰 발급·회전·헤더 검증, 운영 Secure/SameSite=Lax 쿠키를 적용했습니다. 요청마다 DB 활성 상태와 비밀번호 버전을 검사합니다. 비활성화와 비밀번호 변경/초기화는 기존 세션을 만료시킵니다. 비밀번호는 해시로 저장하고 BCrypt의 72바이트 경계도 검증합니다. API 응답은 no-store이며 권한·분야는 서버에서 검사합니다. Vite의 비공개 파일 직접 접근도 차단했습니다. `prod`·`production` 프로필은 세션·CSRF 쿠키 Secure를 `true`로 설정하므로 `SESSION_COOKIE_SECURE=false`를 적용하지 않습니다. 운영 프로필은 debug·SQL 출력을 끄고 외부 `FILE_STORAGE_PATH`를 필수로 요구합니다.

## Roles

MEMBER와 STAFF만 존재합니다. STAFF는 자신의 분야에 MEMBER만 생성하고 이름·활성 상태·비밀번호만 관리합니다. STAFF 생성·승격·분야 이동 API는 없습니다. 개발 계정은 `dev & !test & !prod & !production`에서만 생성하며 운영 STAFF는 [신뢰된 운영자의 별도 DB 프로비저닝](staff-provisioning.md) 절차를 사용합니다.

## Database

Flyway V1~V7: users, assignments, submissions, assignment_files, submission_files, file_cleanup_jobs, notices, profile_files, user_preferences. Hibernate는 validate만 사용합니다. Submission의 사용자/과제 조합은 UNIQUE이며 참조 삭제를 제한합니다. Ranking 테이블은 없습니다.

## Assignment

분야는 STAFF의 track에서 자동 지정합니다. 다른 분야의 목록·ID 접근을 차단하고, 제출물이 존재하는 과제 삭제는 409로 거부합니다. 본문에서 첨부파일을 자동 생성하지 않습니다.

## Submission

메모 또는 파일만으로 제출할 수 있습니다. 재제출은 같은 레코드를 갱신하고 status=PENDING, score/feedback/reviewedAt/reviewedBy=null로 초기화합니다. 마감 검사와 제출/검토 동시성 제어를 적용했습니다.

## Files

FileStorage 추상화와 LocalFileStorage를 사용합니다. UUID 저장 키, 파일명·경로·크기·개수·확장자·MIME·signature 검증, 프로필 이미지 디코딩 검증을 적용했습니다. 새 파일 저장 후 DB 실패 시 정리하고, 기존 파일은 커밋 후 삭제하며 실패는 정리 큐에 기록하여 재시도합니다. 인증된 `/api/files/{id}`만 다운로드를 제공하고 attachment/nosniff/no-store 헤더를 반환합니다.

## Notice

전역 공지와 자신의 분야 공지를 조회합니다. STAFF는 자기 분야 공지만 생성·수정·삭제할 수 있습니다. 전역 공지는 읽기 전용입니다. 기존 목록·상세 화면에 편집 UI를 연결했습니다.

## Ranking

같은 분야의 활성 MEMBER 전체를 포함합니다. REVIEWED이며 score가 존재하는 제출만 합산합니다. 미채점 학생도 합계·평균·채점 수 0으로 순위에 포함합니다. 합계→정확한 평균→채점 수 내림차순, 이름→내부 UUID 오름차순으로 정렬하고 순차 순위를 부여합니다. 응답에는 rank/name/totalScore/averageScore/reviewedCount/isMe만 반환합니다. 검토·재제출·계정 변경 후 UI를 갱신합니다.

## Frontend Integration

로그인·로그아웃·보호 경로·과제·제출·파일·운영진 관리·공지·랭킹·프로필·계정/비밀번호·알림 설정을 실제 API에 연결했습니다. 비동기 로딩·실패·재시도·빈 상태를 추가했습니다. 프로필 사진의 1:1 자르기, 512px 출력, 미리보기, 키보드·드래그 조작을 유지했습니다. 알림 설정은 현재 화면의 네 항목만 계정별로 저장합니다. 최종 `/dashboard` 레이아웃은 유지하고 비교 전용 `/prototypes`·`/dashboard/a`~`/dashboard/d`를 제거했습니다. 과제·공지·운영진 과제의 실제 0건과 검색 0건을 구분합니다.

## Removed Mock

mockAuth, 브라우저 세션 인증, localStorage 운영 데이터/마이그레이션, IndexedDB 파일 저장, 운영용 fixture, 클라이언트 랭킹 계산을 제거했습니다. LMSContext는 인증 계정별 API 결과와 요청 상태만 보유합니다. 정적 내비게이션·상태 라벨은 uiData.ts로 분리했습니다. 공개 랜딩의 가짜 과제·통계·공지·피드백과 비교 화면의 디자인 옵션·전용 컴포넌트·사용하지 않는 훅·export도 제거했습니다.

## Remaining Mock

런타임 Mock 데이터는 없습니다. 공개 랜딩은 기존 배치와 모션을 유지한 기능 안내이며 가짜 업무 데이터나 디자인 비교 페이지를 제공하지 않습니다. 개발 seed와 테스트 fixture는 각각 개발 프로필과 테스트 경로에 격리되어 운영 데이터로 사용되지 않습니다. 알림 발송 자체는 요청 범위인 설정 저장에 포함되지 않으므로 발송 기능을 제공한다고 표시하지 않습니다.

## Tests

다음은 2026-10-07 Phase 1~12 완료 시의 검증 기록입니다. 이후 cleanup의 전체 테스트 실행 결과로 해석하지 마세요. 최신 결과는 [운영 정리 감사 보고서](production-cleanup-audit.md)에 기록합니다.

- 백엔드 전체 89개: 실패/오류/건너뜀 0, 48초.
- 실제 PostgreSQL + 서버 + 브라우저 전체 90개: 모두 통과, 6.8분.
- 비공개 파일 접근 차단 추가 테스트 1개와 기존 파일 회귀 3개: 모두 통과, 18.7초. 검증된 브라우저 테스트는 총 91개입니다.
- 375/390/768/1024/1280/1440px 전체 경로, 키보드/포커스, reduced motion, 사진 crop, 서버 권한 및 개인정보 응답 검증 포함.
- 환경 파일 초기화: 임의 비밀 생성, 권한 0600, 기존 파일 보존 확인.
- Nginx 설정: 임시 테스트 인증서로 `nginx -t` 통과. 운영 인증서를 설치하거나 서버에 배포하지는 않았습니다.
- 소스/빌드 결과의 로컬 비밀 값 유출 검사 및 git diff --check 통과.

## Build

아래 상태와 시간은 Phase 1~12 완료 당시의 기록입니다.

```text
Frontend: PASS
Backend Tests: PASS (89)
Backend Build: PASS
Smoke Test: PASS
```

최종 프론트엔드 빌드 2.66초. 로컬 개발 서버의 실제 MEMBER/STAFF 로그인→CSRF→인증 조회→도메인 API 조회→로그아웃을 Vite 프록시를 통해 확인했습니다. 전체 제출→운영진 검토→점수→랭킹 흐름은 브라우저 통합 테스트로 검증했습니다.

## Remaining Work

Phase 1~12의 프로젝트 구현과 당시 로컬 검증을 완료했습니다. 이후 운영 정리의 완료 범위와 검증 상태는 [운영 정리 감사 보고서](production-cleanup-audit.md)에서 관리합니다. 실제 운영 배포에는 운영 DB·비공개 파일 볼륨, 비밀 환경변수, 도메인/TLS 인증서, STAFF 계정 프로비저닝이 필요합니다. 배포 대상이 제공되지 않아 외부 운영 서버 배포는 수행하지 않았습니다. 실제 이메일/알림 발송은 현재 요구 범위 밖입니다.
