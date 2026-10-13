# 최초 운영진 계정 발급

운영 STAFF는 운영 DB 접근 권한을 가진 신뢰된 운영자가 별도로 발급합니다. 애플리케이션의 학생 생성 API는 로그인한 STAFF의 분야에 MEMBER만 생성합니다. STAFF 생성·승격·분야 변경 API나 전역 관리자 역할은 제공하지 않습니다.

로컬 개발에서는 [README의 개발 계정](../README.md#개발-계정)을 사용합니다. 운영 DB에 개발 계정을 만들기 위해 `dev` 프로필이나 `DEV_SEED_PASSWORD`를 사용하지 않습니다.

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
