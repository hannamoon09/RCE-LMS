package com.rce.lms;

import static org.assertj.core.api.Assertions.assertThat;

import com.rce.lms.user.Role;
import com.rce.lms.user.Track;
import com.rce.lms.user.UserAccount;
import com.rce.lms.user.UserRepository;
import java.net.HttpCookie;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.web.server.context.WebServerApplicationContext;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.MapPropertySource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Uses real HTTP and two independent application lifecycles against the dedicated test database. */
class ProductionRestartIntegrationTest {
    private static final JsonMapper JSON = new JsonMapper();
    private static final String PASSWORD = "Production-restart-test-only-42!";
    @TempDir Path storage;

    @ParameterizedTest
    @ValueSource(strings = {"prod,dev", "dev,prod", "production,dev", "dev,production"})
    void productionRemainsSeedFreeAndSecureWhenDevelopmentIsAlsoSelected(String profiles) throws Exception {
        try (var application = start(profiles)) {
            assertProductionConfiguration(application);
            var browser = new ApiSession(application);
            browser.csrf();
            browser.exchange("POST", "/api/auth/login", Map.of("studentId", "20260000", "password", PASSWORD), false, 403);
            browser.exchange("GET", "/api/auth/me", null, false, 401);
            assertThat(application.getBean(UserRepository.class).findByStudentId("20260000")).isEmpty();
        }
    }

    @Test
    void committedUsersAssignmentsSubmissionsScoresAndNoticesSurviveActualBackendRestart() throws Exception {
        UUID staffId = null;
        UUID memberId = null;
        String memberStudentId = studentId();
        String assignmentId;
        String submissionId;
        String noticeId;
        String originalSession;

        try {
            try (var application = start("prod")) {
                assertProductionConfiguration(application);
                var users = application.getBean(UserRepository.class);
                var passwords = application.getBean(PasswordEncoder.class);
                // An explicit, test-owned STAFF fixture models operator provisioning; no runtime bootstrap is used.
                var staff = users.saveAndFlush(new UserAccount(studentId(), passwords.encode(PASSWORD),
                    "재시작 검증 운영진", Role.STAFF, Track.WEB));
                staffId = staff.getId();

                var staffBrowser = new ApiSession(application);
                staffBrowser.login(staff.getStudentId());
                var member = staffBrowser.json("POST", "/api/admin/users", Map.of(
                    "studentId", memberStudentId, "name", "재시작 검증 학습자", "initialPassword", PASSWORD), 201);
                memberId = UUID.fromString(member.get("id").asString());
                assignmentId = staffBrowser.json("POST", "/api/admin/assignments", Map.of(
                    "title", "재시작 후 유지할 과제", "description", "실제 PostgreSQL 영속성 검증",
                    "difficulty", "Low", "deadline", Instant.now().plusSeconds(86400).toString()), 201).get("id").asString();
                noticeId = staffBrowser.json("POST", "/api/admin/notices", Map.of(
                    "title", "재시작 후 유지할 공지", "body", "서버에서 보관하는 공지", "category", "안내", "important", false),
                    201).get("id").asString();

                var memberBrowser = new ApiSession(application);
                memberBrowser.login(memberStudentId);
                submissionId = memberBrowser.json("POST", "/api/assignments/" + assignmentId + "/submission",
                    Map.of("content", "재시작 후에도 유지되는 제출 내용"), 200).get("id").asString();
                staffBrowser.json("PATCH", "/api/admin/submissions/" + submissionId + "/review",
                    Map.of("score", 87, "feedback", "재시작 후에도 유지되는 피드백"), 200);
                assertScore(memberBrowser.json("GET", "/api/assignments/" + assignmentId + "/submission", null, 200), submissionId);
                assertRanking(memberBrowser.json("GET", "/api/rankings/me", null, 200));
                originalSession = memberBrowser.cookies.get("JSESSIONID");
            }

            // The servlet container, connection pool and JPA context above are closed before a new backend starts.
            try (var restarted = start("prod")) {
                assertProductionConfiguration(restarted);
                var memberBrowser = new ApiSession(restarted);
                memberBrowser.cookies.put("JSESSIONID", originalSession);
                memberBrowser.exchange("GET", "/api/auth/me", null, false, 401);
                // Sessions intentionally expire across process restarts; persisted users can authenticate again.
                memberBrowser.login(memberStudentId);
                assertThat(memberBrowser.json("GET", "/api/auth/me", null, 200).get("id").asString()).isEqualTo(memberId.toString());
                assertThat(memberBrowser.json("GET", "/api/assignments/" + assignmentId, null, 200)
                    .get("title").asString()).isEqualTo("재시작 후 유지할 과제");
                assertScore(memberBrowser.json("GET", "/api/assignments/" + assignmentId + "/submission", null, 200), submissionId);
                assertThat(memberBrowser.json("GET", "/api/notices/" + noticeId, null, 200)
                    .get("body").asString()).isEqualTo("서버에서 보관하는 공지");
                assertRanking(memberBrowser.json("GET", "/api/rankings/me", null, 200));

                // A distinct client has no cookies or cached business data and sees the same committed rows.
                var freshBrowser = new ApiSession(restarted);
                freshBrowser.login(memberStudentId);
                assertScore(freshBrowser.json("GET", "/api/assignments/" + assignmentId + "/submission", null, 200), submissionId);
                assertRanking(freshBrowser.json("GET", "/api/rankings/me", null, 200));
                freshBrowser.json("POST", "/api/auth/logout", null, 204);
                freshBrowser.exchange("GET", "/api/auth/me", null, false, 401);
            }
        } finally {
            removeOwnedFixtures(staffId, memberId);
        }
    }

    private ConfigurableApplicationContext start(String profiles) {
        String url = testDatabaseUrl();
        var application = new SpringApplication(LmsApplication.class);
        // Override connection/port/storage only; production security and profile config are loaded unchanged.
        application.addInitializers(context -> context.getEnvironment().getPropertySources().addFirst(
            new MapPropertySource("isolated-production-test", Map.of(
                "spring.datasource.url", url,
                "spring.datasource.username", databaseUsername(),
                "spring.datasource.password", databasePassword(),
                "server.port", "0",
                "server.address", "127.0.0.1",
                "FILE_STORAGE_PATH", storage.toAbsolutePath().toString(),
                "DEV_SEED_PASSWORD", PASSWORD,
                "SESSION_COOKIE_SECURE", "false",
                "app.file-cleanup-delay-ms", "86400000"))));
        return application.run("--spring.profiles.active=" + profiles, "--spring.main.banner-mode=off");
    }

    private void assertProductionConfiguration(ConfigurableApplicationContext application) {
        var environment = application.getEnvironment();
        assertThat(application.containsBean("developmentSeed")).isFalse();
        assertThat(environment.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
        assertThat(environment.getProperty("spring.flyway.enabled", Boolean.class)).isTrue();
        assertThat(environment.getProperty("debug", Boolean.class)).isFalse();
        assertThat(environment.getProperty("server.servlet.session.cookie.secure", Boolean.class)).isTrue();
        assertThat(environment.getProperty("server.servlet.session.cookie.http-only", Boolean.class)).isTrue();
        assertThat(environment.getProperty("app.session-cookie-secure", Boolean.class)).isTrue();
        assertThat(environment.getProperty("app.file-storage-path")).isEqualTo(storage.toAbsolutePath().toString());
        assertThat(application.getBean(JdbcTemplate.class).queryForObject("SELECT current_database()", String.class))
            .isEqualTo("rce_lms_test");
    }

    private static void assertScore(JsonNode submission, String id) {
        assertThat(submission.get("id").asString()).isEqualTo(id);
        assertThat(submission.get("content").asString()).isEqualTo("재시작 후에도 유지되는 제출 내용");
        assertThat(submission.get("status").asString()).isEqualTo("REVIEWED");
        assertThat(submission.get("score").asInt()).isEqualTo(87);
        assertThat(submission.get("feedback").asString()).isEqualTo("재시작 후에도 유지되는 피드백");
    }

    private static void assertRanking(JsonNode ranking) {
        int matches = 0;
        for (var row : ranking) {
            if (row.get("isMe").asBoolean()) {
                assertThat(row.get("totalScore").asInt()).isEqualTo(87);
                assertThat(row.get("reviewedCount").asInt()).isEqualTo(1);
                matches++;
            }
        }
        assertThat(matches).isEqualTo(1);
    }

    private static String studentId() {
        return Long.toString(ThreadLocalRandom.current().nextLong(100000000000L, 999999999999L));
    }

    private static String testDatabaseUrl() {
        String url = System.getenv().getOrDefault("TEST_DB_URL", "jdbc:postgresql://localhost:5432/rce_lms_test");
        if (!url.endsWith("/rce_lms_test")) throw new IllegalStateException("Restart verification requires rce_lms_test");
        return url;
    }

    private static String databaseUsername() {
        return System.getenv().getOrDefault("TEST_DB_USERNAME", System.getenv("DB_USERNAME"));
    }

    private static String databasePassword() {
        return System.getenv().getOrDefault("TEST_DB_PASSWORD", System.getenv("DB_PASSWORD"));
    }

    private static void removeOwnedFixtures(UUID staffId, UUID memberId) throws Exception {
        if (staffId == null) return;
        // Test-only, primary-key-scoped cleanup still works if application startup or an assertion failed.
        try (var connection = DriverManager.getConnection(testDatabaseUrl(), databaseUsername(), databasePassword())) {
            connection.setAutoCommit(false);
            try {
                try (var remove = connection.prepareStatement("DELETE FROM submissions WHERE user_id = ?")) {
                    remove.setObject(1, memberId);
                    remove.executeUpdate();
                }
                for (String table : List.of("assignments", "notices")) {
                    try (var remove = connection.prepareStatement("DELETE FROM " + table + " WHERE author_id = ?")) {
                        remove.setObject(1, staffId);
                        remove.executeUpdate();
                    }
                }
                try (var remove = connection.prepareStatement("DELETE FROM users WHERE id = ? OR id = ?")) {
                    remove.setObject(1, staffId);
                    remove.setObject(2, memberId);
                    remove.executeUpdate();
                }
                connection.commit();
            } catch (Exception error) {
                connection.rollback();
                throw error;
            }
        }
    }

    private static final class ApiSession {
        private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
        private final String base;
        private final Map<String, String> cookies = new LinkedHashMap<>();

        private ApiSession(ConfigurableApplicationContext application) {
            base = "http://127.0.0.1:" + ((WebServerApplicationContext) application).getWebServer().getPort();
        }

        private void csrf() throws Exception {
            var response = exchange("GET", "/api/csrf", null, false, 200);
            // Resolving an existing token does not reissue its cookie. Validate attributes whenever
            // a cookie is actually received (including from an earlier unauthenticated response).
            assertThat(JSON.readTree(response.body()).get("headerName").asString()).isEqualTo("X-XSRF-TOKEN");
            assertThat(JSON.readTree(response.body()).get("token").asString()).isNotBlank();
            assertThat(cookies.get("XSRF-TOKEN")).isNotBlank();
        }

        private void login(String studentId) throws Exception {
            csrf();
            var response = exchange("POST", "/api/auth/login", Map.of("studentId", studentId, "password", PASSWORD), true, 200);
            assertThat(response.headers().allValues("Set-Cookie")).anySatisfy(cookie -> {
                assertThat(cookie).startsWith("JSESSIONID=").contains("Secure", "HttpOnly", "SameSite=Lax", "Path=/");
            });
            csrf();
        }

        private JsonNode json(String method, String path, Map<String, Object> body, int status) throws Exception {
            var response = exchange(method, path, body, !method.equals("GET"), status);
            return status == 204 ? null : JSON.readTree(response.body());
        }

        private HttpResponse<String> exchange(String method, String path, Map<String, Object> body,
                boolean withCsrf, int expectedStatus) throws Exception {
            var request = HttpRequest.newBuilder(URI.create(base + path)).timeout(Duration.ofSeconds(20));
            if (!cookies.isEmpty()) request.header("Cookie", cookies.entrySet().stream()
                .map(cookie -> cookie.getKey() + "=" + cookie.getValue()).collect(Collectors.joining("; ")));
            if (withCsrf) request.header("X-XSRF-TOKEN", cookies.get("XSRF-TOKEN"));
            request.header("Content-Type", "application/json");
            var payload = body == null ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body));
            var response = client.send(request.method(method, payload).build(), HttpResponse.BodyHandlers.ofString());
            assertThat(response.statusCode()).as("%s %s: %s", method, path, response.body()).isEqualTo(expectedStatus);
            assertThat(response.headers().firstValue("Cache-Control")).contains("no-store");
            // Transport secure-cookie attributes are asserted above. Explicit replay over loopback HTTP
            // exercises the real security filter chain without weakening the production configuration.
            for (var header : response.headers().allValues("Set-Cookie")) {
                if (header.startsWith("XSRF-TOKEN=")) {
                    assertThat(header).contains("Secure", "SameSite=Lax", "Path=/");
                }
                for (var cookie : HttpCookie.parse(header)) {
                    if (cookie.getMaxAge() == 0) cookies.remove(cookie.getName());
                    else cookies.put(cookie.getName(), cookie.getValue());
                }
            }
            return response;
        }
    }
}
