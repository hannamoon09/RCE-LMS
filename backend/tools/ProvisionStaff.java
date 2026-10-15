import java.io.Console;
import java.net.URI;
import java.nio.CharBuffer;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Properties;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;

/** Trusted local operator utility; outside src/main and never included in bootJar. */
public final class ProvisionStaff {
    private static final Set<String> TRACKS = Set.of("WEB", "PWN", "REVERSING", "FORENSICS");

    public static void main(String[] args) {
        Console console = System.console();
        if (args.length != 0 || console == null || Runtime.version().feature() != 21) {
            System.err.println("인자 없이 JDK 21의 대화형 터미널에서 scripts/provision-staff.sh를 실행하세요.");
            System.exit(1);
        }
        try {
            run(console);
        } catch (Cancelled ignored) {
            console.printf("취소했습니다. 계정을 등록하지 않았습니다.%n");
        } catch (RegistrationFailed ignored) {
            System.exit(1);
        } catch (IllegalArgumentException error) {
            console.printf("입력 오류: %s%n", error.getMessage());
            System.exit(1);
        } catch (SQLException error) {
            // JDBC messages can contain server details or SQL values. Never print them or a stack trace.
            console.printf("DB 연결 또는 스키마 확인에 실패했습니다 (SQLSTATE %s). 연결 정보와 V1~V7 적용 상태를 확인하세요.%n",
                safeState(error));
            System.exit(1);
        }
    }

    private static void run(Console console) throws SQLException {
        console.printf("최초 운영진 발급 도구 — 기존 계정을 수정하지 않습니다. 취소하려면 Ctrl+C를 누르세요.%n");
        String url = line(console, "JDBC URL (비밀번호 제외): ");
        validateUrl(url);
        String username = line(console, "DB 사용자명: ");
        require(!username.isBlank(), "DB 사용자명을 입력하세요.");
        char[] databasePassword = password(console, "DB 비밀번호 (화면에 표시되지 않음): ");
        Properties properties = new Properties();
        properties.setProperty("user", username);
        properties.setProperty("password", new String(databasePassword));
        properties.setProperty("connectTimeout", "10");
        properties.setProperty("socketTimeout", "30");
        properties.setProperty("currentSchema", "public");
        Connection connection;
        try {
            connection = DriverManager.getConnection(url, properties);
        } finally {
            Arrays.fill(databasePassword, '\0');
            properties.remove("password");
        }
        try (connection) {
            String database = verifySchema(connection);
            String studentId = line(console, "새 STAFF 학번 (숫자 4~32자리): ");
            require(studentId.matches("[0-9]{4,32}"), "학번은 숫자 4~32자리여야 합니다.");
            String name = line(console, "이름 (최대 100자): ");
            require(!name.isBlank() && name.length() <= 100, "이름은 공백이 아닌 1~100자여야 합니다.");
            String track = line(console, "분야 (WEB / PWN / REVERSING / FORENSICS): ");
            require(TRACKS.contains(track), "분야를 표시된 대문자 값 중에서 선택하세요.");
            char[] initialPassword = password(console, "STAFF 초기 비밀번호 (8자 이상, 최대 72바이트): ");
            String hash;
            try {
                validatePassword(initialPassword);
                char[] repeated = password(console, "STAFF 초기 비밀번호 다시 입력: ");
                try {
                    require(Arrays.equals(initialPassword, repeated), "두 비밀번호가 일치하지 않습니다.");
                } finally {
                    Arrays.fill(repeated, '\0');
                }
                hash = PasswordEncoderFactories.createDelegatingPasswordEncoder().encode(CharBuffer.wrap(initialPassword));
            } finally {
                Arrays.fill(initialPassword, '\0');
            }
            UUID id = UUID.randomUUID();
            console.printf("%n등록 예정:%n  연결: %s%n  DB: %s%n  학번: %s%n  이름: %s%n  역할: STAFF%n  분야: %s%n  ID: %s%n",
                url, database, studentId, name, track, id);
            if (!"CREATE STAFF".equals(line(console, "이 DB에 새 계정을 등록하려면 CREATE STAFF 입력: "))) {
                throw new Cancelled();
            }
            insert(console, connection, id, studentId, hash, name, track);
        }
    }

    private static String verifySchema(Connection connection) throws SQLException {
        Set<String> versions = new HashSet<>();
        try (var statement = connection.prepareStatement("SELECT version, success FROM public.flyway_schema_history");
             var rows = statement.executeQuery()) {
            while (rows.next()) {
                require(rows.getBoolean("success"), "실패한 Flyway 기록이 있습니다. 먼저 migration 상태를 확인하세요.");
                versions.add(rows.getString("version"));
            }
        }
        require(versions.containsAll(Set.of("1", "2", "3", "4", "5", "6", "7")),
            "이 도구는 Flyway V1~V7이 적용된 RCE LMS DB에서만 실행할 수 있습니다.");
        try (var statement = connection.prepareStatement("SELECT current_database()");
             var rows = statement.executeQuery()) {
            rows.next();
            return rows.getString(1);
        }
    }

    private static void insert(Console console, Connection connection, UUID id, String studentId,
            String hash, String name, String track) throws SQLException {
        connection.setAutoCommit(false);
        boolean commitStarted = false;
        try {
            try (var statement = connection.prepareStatement("""
                INSERT INTO public.users
                    (id, student_id, password_hash, name, email, role, track, active,
                     joined_at, profile_image, credential_version)
                VALUES (?, ?, ?, ?, NULL, 'STAFF', ?, TRUE, CURRENT_TIMESTAMP, NULL, 0)
                """)) {
                statement.setObject(1, id);
                statement.setString(2, studentId);
                statement.setString(3, hash);
                statement.setString(4, name);
                statement.setString(5, track);
                if (statement.executeUpdate() != 1) throw new SQLException("Unexpected row count", "P0001");
            }
            commitStarted = true;
            connection.commit();
            console.printf("등록 완료: ID=%s, 학번=%s, 역할=STAFF, 분야=%s, 활성=true%n", id, studentId, track);
            console.printf("운영 HTTPS 화면에서 로그인한 뒤 계정 설정에서 비밀번호를 변경하세요.%n");
        } catch (SQLException error) {
            boolean rolledBack = false;
            try {
                connection.rollback();
                rolledBack = true;
            } catch (SQLException ignored) { }
            if (commitStarted) {
                console.printf("커밋 결과를 확인할 수 없습니다. 재실행 전에 ID %s 또는 학번 %s로 등록 여부를 확인하세요.%n", id, studentId);
            } else if ("23505".equals(error.getSQLState()) && rolledBack) {
                console.printf("중복 학번 또는 ID로 등록을 취소하고 롤백했습니다. 기존 계정은 변경하지 않았습니다.%n");
            } else {
                console.printf("등록 실패 (SQLSTATE %s). %s%n", safeState(error),
                    rolledBack ? "트랜잭션을 롤백했습니다." : "연결 상태를 확인하고 등록 여부를 확인하세요.");
            }
            throw new RegistrationFailed();
        }
    }

    private static void validateUrl(String url) {
        require(url.startsWith("jdbc:postgresql://"), "jdbc:postgresql://호스트:포트/DB 형식으로 입력하세요.");
        URI parsed;
        try {
            parsed = URI.create(url.substring(5));
        } catch (IllegalArgumentException ignored) {
            throw new IllegalArgumentException("JDBC URL 형식이 올바르지 않습니다.");
        }
        require(parsed.getHost() != null && parsed.getUserInfo() == null && parsed.getFragment() == null
            && parsed.getPort() >= -1 && parsed.getPort() <= 65535
            && parsed.getPath() != null && parsed.getPath().matches("/[A-Za-z0-9_-]+"),
            "JDBC URL에는 호스트·포트·DB 이름만 입력하세요. 사용자명·비밀번호를 넣지 마세요.");
        String query = parsed.getRawQuery();
        require(query == null || query.matches("sslmode=(disable|allow|prefer|require|verify-ca|verify-full)"),
            "JDBC URL 옵션은 sslmode만 허용합니다. 사용자명과 비밀번호는 별도 입력하세요.");
        boolean local = Set.of("localhost", "127.0.0.1", "[::1]").contains(parsed.getHost());
        require(local || Set.of("sslmode=require", "sslmode=verify-ca", "sslmode=verify-full").contains(query == null ? "" : query),
            "외부 DB 연결에는 ?sslmode=require 또는 검증 가능한 인증서의 verify-full 옵션을 붙이세요.");
    }

    private static void validatePassword(char[] password) {
        CharBuffer chars = CharBuffer.wrap(password);
        int bytes = StandardCharsets.UTF_8.encode(chars).remaining();
        require(password.length >= 8 && !CharBuffer.wrap(password).toString().isBlank() && bytes <= 72,
            "비밀번호는 공백이 아닌 8자 이상, UTF-8 기준 72바이트 이하여야 합니다.");
    }

    private static String line(Console console, String prompt) {
        String value = console.readLine("%s", prompt);
        if (value == null) throw new Cancelled();
        require(value.chars().noneMatch(Character::isISOControl), "제어 문자는 입력할 수 없습니다.");
        return value.strip();
    }

    private static char[] password(Console console, String prompt) {
        char[] value = console.readPassword("%s", prompt);
        if (value == null) throw new Cancelled();
        return value;
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new IllegalArgumentException(message);
    }

    private static String safeState(SQLException error) {
        String state = error.getSQLState();
        return state != null && state.matches("[A-Z0-9]{5}") ? state : "UNKNOWN";
    }

    private static final class Cancelled extends RuntimeException { }
    private static final class RegistrationFailed extends RuntimeException { }
}
