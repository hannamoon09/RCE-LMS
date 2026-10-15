# 최초 운영진 계정 발급

운영 STAFF는 운영 DB 접근 권한을 가진 신뢰된 운영자가 별도로 발급합니다. 애플리케이션의 학생 생성 API는 로그인한 STAFF의 분야에 MEMBER만 생성합니다. STAFF 생성·승격·분야 변경 API나 전역 관리자 역할은 제공하지 않습니다.

로컬 개발에서는 [README의 개발 계정](../README.md#개발-계정)을 사용합니다. 운영 DB에 개발 계정을 만들기 위해 `dev` 프로필이나 `DEV_SEED_PASSWORD`를 사용하지 않습니다.

## 처음 발급할 때: 로컬 터미널 도구

[provision-staff.sh](../scripts/provision-staff.sh)는 아래의 해시 생성·파라미터 INSERT 절차를 대신 실행하는 운영자 전용 도구입니다. 웹사이트의 기능이나 공개 API가 아니며, [Java 도구 소스](../backend/tools/ProvisionStaff.java)는 운영 JAR에 포함되지 않습니다. 이 도구는 기존 계정을 수정하거나 승격하지 않고, 마지막 확인을 입력한 경우에만 STAFF 한 명을 등록합니다.

먼저 Railway backend가 정상 시작하여 운영 DB에 Flyway V1~V7을 적용했는지 확인합니다. 준비된 프로젝트 소스와 **JDK 21**이 있는 본인 컴퓨터의 Terminal에서 실행하세요. Railway 웹 로그 화면이나 채팅창에 비밀번호를 입력하지 않습니다.

1. Railway 프로젝트의 **Postgres → Settings → Networking**에서 외부 연결용 Public Access/TCP Proxy를 확인합니다. 외부 연결이 없다면 발급 작업을 위해 추가합니다. 공개 호스트와 공개 포트, DB 이름, DB 사용자명과 DB 비밀번호를 Railway 화면에서 직접 확인합니다. 로컬 도구에는 `postgres.railway.internal` 주소를 사용할 수 없습니다. 앱 서비스의 기존 private DB 연결 설정은 바꾸지 않습니다. [Railway PostgreSQL 연결 안내](https://docs.railway.com/databases/postgresql)
2. Terminal에서 프로젝트 폴더로 이동하고 아래 명령을 실행합니다. macOS에서는 첫 줄이 설치된 JDK 21을 선택합니다. 다른 환경에서는 `JAVA_HOME`을 설치한 JDK 21 폴더로 설정한 다음 두 번째 명령을 실행합니다.

   ```sh
   export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
   bash scripts/provision-staff.sh
   ```

3. 도구가 묻는 연결 정보와 새 STAFF 정보를 입력합니다. 첫 JDBC URL에는 아래처럼 **공개 호스트·공개 포트·DB 이름만** 넣습니다. 꺾쇠괄호 부분을 실제 값으로 바꾸고, 사용자명이나 비밀번호는 URL에 넣지 않습니다.

   ```text
   jdbc:postgresql://<공개호스트>:<공개포트>/<DB이름>?sslmode=require
   ```

   DB 비밀번호와 STAFF 초기 비밀번호는 입력해도 글자가 표시되지 않습니다. 이는 정상입니다. STAFF 비밀번호는 두 번 입력하며, DB 비밀번호와 별개의 새 비밀번호를 정합니다. 분야는 `WEB`, `PWN`, `REVERSING`, `FORENSICS` 중 하나를 대문자로 입력합니다.

4. 표시된 연결 주소·DB·학번·이름·분야를 확인합니다. 정확하면 **`CREATE STAFF`**를 입력합니다. 다른 문자를 입력하거나 그 전에 `Ctrl+C`를 누르면 등록을 취소합니다. 기존 학번이 있으면 롤백하며 기존 계정은 변경하지 않습니다. 성공 화면에는 ID·학번·분야만 표시하고 비밀번호나 해시는 표시하지 않습니다.
5. 아래의 **발급 후 확인** 절차로 실제 HTTPS 로그인과 비밀번호 변경을 확인합니다. 외부 DB 접근을 발급용으로만 추가했다면 발급이 끝난 후 그 Public Access/TCP Proxy만 제거할 수 있습니다. 다른 관리 도구가 사용하는 외부 연결인지 먼저 확인하세요.

도구는 `.env`를 읽지 않으며, 비밀번호를 명령 인자·파일에 저장하지 않습니다. 실행 전에 현재 소스로 `bootJar`를 빌드하고 해당 JAR의 라이브러리만 권한이 제한된 임시 폴더에 풀어 사용한 뒤 정리합니다. 서버를 시작하거나 migration을 실행하지 않습니다. 오류에 SQL 값이나 JDBC 상세 메시지를 출력하지 않습니다.

외부 연결은 TLS 옵션 `sslmode=require`, `verify-ca`, `verify-full`만 허용합니다. `require`는 전송을 암호화하지만 서버 인증서의 신원을 검증하지 않습니다. 운영 환경에 검증 가능한 인증서가 준비되어 있다면 `verify-full`을 사용하세요. `localhost` 등 루프백 주소에서는 전용 로컬 테스트 DB 확인을 위해 TLS 없는 연결도 허용합니다.

| 화면 메시지 | 다음 행동 |
| --- | --- |
| JDK 21 필요 | JDK 21을 설치하거나 `JAVA_HOME`을 JDK 21 폴더로 지정 |
| DB 연결 또는 스키마 확인 실패 | 공개 호스트·공개 포트·DB 사용자명·비밀번호와 backend의 Flyway 완료 여부 확인 |
| 중복 학번 또는 ID | 기존 계정을 확인하고 필요하면 다른 새 학번으로 다시 실행. 기존 계정을 덮어쓰지 않음 |
| 입력 오류 / 비밀번호 불일치 | 조건에 맞게 처음부터 다시 입력. INSERT 전 오류이므로 신규 계정 없음 |
| 커밋 결과를 확인할 수 없음 | 화면의 ID 또는 학번으로 DB에 등록됐는지 먼저 확인한 후 후속 작업 결정 |

아래 내용은 도구가 수행하는 절차와 별도 신뢰 DB 클라이언트를 사용할 때의 기준입니다.

## 준비할 값

Flyway 마이그레이션이 적용된 운영 DB에서 작업합니다. 다음 값은 운영자가 확인합니다.

| 값 | 조건 |
| --- | --- |
| `id` | 새로 생성한 UUID |
| `student_id` | 기존 계정과 중복되지 않는 숫자 4~32자리. 앞의 0을 보존하도록 문자열로 취급 |
| `name` | 공백만으로 구성되지 않은 이름, 앞뒤 공백 제거 후 최대 100자 |
| `track` | 담당 분야 하나: `WEB`, `PWN`, `REVERSING`, `FORENSICS` |
| 초기 비밀번호 | 공백만으로 구성되지 않은 8자 이상, UTF-8 기준 최대 72바이트. 계정마다 별도로 생성 |
| `password_hash` | 아래 서버와 같은 인코더로 생성한 전체 해시 문자열 |

## 비밀번호 해시

백엔드의 `SecurityConfiguration.passwordEncoder()`는 Spring Security의 `PasswordEncoderFactories.createDelegatingPasswordEncoder()`를 사용합니다. 신뢰된 운영 도구에서도 백엔드와 같은 의존성을 사용하여 다음과 같이 해시를 생성합니다. `initialPassword`는 보안 입력으로 전달받은 값이며 코드에 하드코딩하지 않습니다.

```java
var encoder = org.springframework.security.crypto.factory.PasswordEncoderFactories
    .createDelegatingPasswordEncoder();
String passwordHash = encoder.encode(initialPassword);
```

현재 저장 형식은 `{bcrypt}` 접두사를 포함합니다. 접두사를 제거하거나 평문을 `password_hash`에 저장하지 않습니다. 평문 비밀번호는 셸 인자·명령 이력·SQL·로그·Git에 남기지 않고, 생성한 해시도 운영 계정 자료로 취급합니다.

## 계정 등록

신뢰된 DB 클라이언트의 파라미터 바인딩으로 다음 INSERT를 트랜잭션 안에서 실행합니다. `$1`~`$5`는 PostgreSQL 파라미터 표기이며 일반 psql 프롬프트에 그대로 붙여 넣는 명령은 아닙니다. JDBC PreparedStatement를 사용한다면 각각 `?`로 바꿉니다. 문자열 연결로 값을 SQL에 삽입하지 않습니다.

```sql
INSERT INTO users (
    id, student_id, password_hash, name, email,
    role, track, active, joined_at, profile_image, credential_version
) VALUES (
    $1::uuid, $2, $3, $4, NULL,
    'STAFF', $5, TRUE, CURRENT_TIMESTAMP, NULL, 0
)
RETURNING id, student_id, name, role, track, active;
```

파라미터 순서는 새 UUID, 학번, 전체 비밀번호 해시, 이름, 담당 분야입니다. 반환된 계정과 분야를 확인한 후 커밋합니다. 중복 학번 오류가 발생하면 기존 계정을 확인하고 롤백합니다. 기존 MEMBER를 덮어쓰거나 STAFF로 승격하는 upsert를 사용하지 않습니다. 프로필 이미지·알림 설정 행은 미리 만들 필요가 없습니다.

## 발급 후 확인

1. 초기 비밀번호를 해당 운영진에게 비공개 경로로 전달합니다.
2. 운영 HTTPS 화면에서 로그인하고 자신의 분야가 맞는지 확인합니다.
3. 계정 설정에서 본인이 사용할 비밀번호로 변경하고 다시 로그인합니다. 최초 변경은 자동 강제되지 않으므로 발급 절차에 포함합니다.
4. 발급 일시·담당 운영자·계정 ID·분야를 운영 기록에 남깁니다. 비밀번호와 해시는 기록에 포함하지 않습니다.

계정 비활성화가 필요하면 신뢰된 운영자가 해당 계정의 `active`를 `false`로 변경합니다. 이미 발급된 세션도 다음 요청에서 거부됩니다. STAFF 비밀번호를 운영자가 복구해야 하는 경우에는 같은 인코더로 만든 새 해시를 저장하면서 `credential_version`도 1 증가시켜 기존 세션을 무효화합니다. 이 작업도 별도의 신뢰된 DB 운영 절차이며 일반 STAFF 화면에는 제공하지 않습니다.
