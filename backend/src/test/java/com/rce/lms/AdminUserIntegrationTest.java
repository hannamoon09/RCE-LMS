package com.rce.lms;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.rce.lms.common.ApiException;
import com.rce.lms.user.*;
import jakarta.servlet.http.Cookie;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminUserIntegrationTest {
    private static final String PASSWORD = "Student-management-test-54!";
    private static final JsonMapper JSON = JsonMapper.builder().build();
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired AdminUserService service;
    @Autowired PasswordEncoder passwords;
    private final List<String> studentIds = new ArrayList<>();
    UserAccount staff;
    UserAccount colleague;
    UserAccount member;
    UserAccount foreign;
    MockHttpSession staffSession;

    @BeforeEach
    void fixture() throws Exception {
        String hash = passwords.encode(PASSWORD);
        staff = account(Role.STAFF, Track.WEB, hash);
        colleague = account(Role.STAFF, Track.WEB, hash);
        member = account(Role.MEMBER, Track.WEB, hash);
        foreign = account(Role.MEMBER, Track.PWN, hash);
        staffSession = login(staff, PASSWORD);
    }

    @AfterEach
    void cleanup() {
        for (String studentId : studentIds) users.findByStudentId(studentId).ifPresent(users::delete);
    }

    @Test
    void createsOwnTrackMemberWithHashedPasswordAndTheAccountCanLogIn() throws Exception {
        String studentId = studentId();
        String initialPassword = "Pass123!";
        var result = write(post("/api/admin/users"), staffSession, createBody(studentId, "  새 학습자  ", initialPassword))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("새 학습자"))
            .andExpect(jsonPath("$.studentId").value(studentId))
            .andExpect(jsonPath("$.role").value("MEMBER"))
            .andExpect(jsonPath("$.track").value("WEB"))
            .andExpect(jsonPath("$.active").value(true))
            .andExpect(jsonPath("$.password").doesNotExist())
            .andExpect(jsonPath("$.passwordHash").doesNotExist())
            .andExpect(jsonPath("$.initialPassword").doesNotExist()).andReturn();
        UserAccount created = users.findByStudentId(studentId).orElseThrow();
        assertThat(created.getPasswordHash()).startsWith("{bcrypt}").isNotEqualTo(initialPassword);
        assertThat(passwords.matches(initialPassword, created.getPasswordHash())).isTrue();
        assertThat(result.getResponse().getContentAsString()).doesNotContain(initialPassword);
        var session = login(created, initialPassword);
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(created.getId().toString()));
    }

    @Test
    void listContainsOnlyOwnTrackMembersEvenWhenClientAsksForAnotherTrack() throws Exception {
        var result = mvc.perform(get("/api/admin/users").session(staffSession).queryParam("track", "PWN")
                .queryParam("role", "STAFF"))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store")).andReturn();
        var response = JSON.readTree(result.getResponse().getContentAsString());
        List<String> ids = new ArrayList<>();
        for (var row : response) {
            ids.add(row.get("id").asString());
            assertThat(row.get("role").asString()).isEqualTo("MEMBER");
            assertThat(row.get("track").asString()).isEqualTo("WEB");
            assertThat(row.has("passwordHash")).isFalse();
        }
        assertThat(ids).contains(member.getId().toString()).doesNotContain(staff.getId().toString(), colleague.getId().toString(), foreign.getId().toString());
    }

    @Test
    void privilegedAndImmutableFieldsAreRejectedBySeparateWriteDtos() throws Exception {
        for (String field : List.of("role", "track", "active", "passwordHash", "id")) {
            var body = new LinkedHashMap<String, Object>(Map.of("name", "학습자", "studentId", studentId(), "initialPassword", PASSWORD));
            body.put(field, "STAFF");
            write(post("/api/admin/users"), staffSession, JSON.writeValueAsString(body))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        }
        for (String field : List.of("role", "track", "studentId", "passwordHash", "id", "email")) {
            write(patch("/api/admin/users/{id}", member.getId()), staffSession,
                    JSON.writeValueAsString(Map.of("name", "변경 시도", field, "forged")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        }
        assertThat(users.findById(member.getId()).orElseThrow().getName()).isEqualTo(member.getName());
    }

    @Test
    void membersCannotManageAccountsAndStaffCannotTargetStaffOrAnotherTrackMember() throws Exception {
        MockHttpSession memberSession = login(member, PASSWORD);
        mvc.perform(get("/api/admin/users").session(memberSession)).andExpect(status().isForbidden());
        write(post("/api/admin/users"), memberSession, createBody(studentId(), "금지", PASSWORD)).andExpect(status().isForbidden());
        write(patch("/api/admin/users/{id}", member.getId()), memberSession, "{\"active\":false}").andExpect(status().isForbidden());
        for (UUID target : List.of(staff.getId(), colleague.getId(), foreign.getId(), UUID.randomUUID())) {
            write(patch("/api/admin/users/{id}", target), staffSession, "{\"active\":false}")
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("USER_NOT_FOUND"));
        }
        assertThat(users.findById(foreign.getId()).orElseThrow().isActive()).isTrue();
    }

    @Test
    void duplicateStudentIdsReturnConflictWithoutOverwritingExistingAccounts() throws Exception {
        for (UserAccount existing : List.of(member, foreign, staff)) {
            write(post("/api/admin/users"), staffSession, createBody(existing.getStudentId(), "중복 생성", PASSWORD))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STUDENT_ID_EXISTS"));
            assertThat(users.findById(existing.getId()).orElseThrow().getName()).isEqualTo(existing.getName());
        }
    }

    @Test
    void concurrentDuplicateCreationHasOneWinnerAndOneUniformConflict() throws Exception {
        String studentId = studentId();
        var input = new AdminUserCreateRequest("동시 생성", studentId, PASSWORD);
        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService pool = Executors.newFixedThreadPool(2)) {
            Callable<String> create = () -> {
                start.await();
                try { return service.create(input, staff).studentId(); }
                catch (ApiException error) {
                    assertThat(error.getStatus().value()).isEqualTo(409);
                    return error.getCode();
                }
            };
            Future<String> one = pool.submit(create), two = pool.submit(create);
            start.countDown();
            assertThat(List.of(one.get(15, TimeUnit.SECONDS), two.get(15, TimeUnit.SECONDS)))
                .containsExactlyInAnyOrder(studentId, "STUDENT_ID_EXISTS");
        }
        assertThat(users.findByStudentId(studentId)).isPresent();
    }

    @Test
    void deactivationInvalidatesAnExistingSessionAndBlocksNewLogin() throws Exception {
        MockHttpSession memberSession = login(member, PASSWORD);
        write(patch("/api/admin/users/{id}", member.getId()), staffSession, "{\"active\":false}")
            .andExpect(status().isOk()).andExpect(jsonPath("$.active").value(false));
        mvc.perform(get("/api/auth/me").session(memberSession)).andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("SESSION_INVALID"));
        assertThat(memberSession.isInvalid()).isTrue();
        attemptLogin(member.getStudentId(), PASSWORD).andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
        write(patch("/api/admin/users/{id}", member.getId()), staffSession, "{\"active\":true}")
            .andExpect(status().isOk());
        login(member, PASSWORD);
    }

    @Test
    void partialEditAndPasswordResetPreserveIdentityAndOnlyTheNewPasswordAuthenticates() throws Exception {
        String newPassword = "가".repeat(24); // Exactly 72 UTF-8 bytes, accepted by BCrypt.
        write(patch("/api/admin/users/{id}", member.getId()), staffSession,
                JSON.writeValueAsString(Map.of("name", "  바뀐 이름  ", "newPassword", newPassword)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("바뀐 이름"))
            .andExpect(jsonPath("$.studentId").value(member.getStudentId()))
            .andExpect(jsonPath("$.role").value("MEMBER")).andExpect(jsonPath("$.track").value("WEB"))
            .andExpect(jsonPath("$.active").value(true)).andExpect(jsonPath("$.newPassword").doesNotExist());
        attemptLogin(member.getStudentId(), PASSWORD).andExpect(status().isUnauthorized());
        login(member, newPassword);
        assertThat(passwords.matches(newPassword, users.findById(member.getId()).orElseThrow().getPasswordHash())).isTrue();
    }

    @Test
    void emptyPatchesInvalidNamesAndInvalidPasswordLengthsAreRejectedWithoutPartialChanges() throws Exception {
        for (String body : List.of("{}", "{\"name\":null,\"active\":null,\"newPassword\":null}",
                "{\"name\":\"   \"}", "{\"name\":\"\"}")) {
            write(patch("/api/admin/users/{id}", member.getId()), staffSession, body)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        }
        for (String password : List.of("1234567", "        ", "x".repeat(73), "가".repeat(25))) {
            write(post("/api/admin/users"), staffSession, createBody(studentId(), "학습자", password)).andExpect(status().isBadRequest());
            write(patch("/api/admin/users/{id}", member.getId()), staffSession,
                    JSON.writeValueAsString(Map.of("name", "저장되면 안 됨", "active", false, "newPassword", password)))
                .andExpect(status().isBadRequest());
        }
        for (String name : List.of(" ", "x".repeat(101))) {
            write(post("/api/admin/users"), staffSession, createBody(studentId(), name, PASSWORD)).andExpect(status().isBadRequest());
        }
        for (String id : List.of("123", "1".repeat(33), "abcd", "2026-0001")) {
            write(post("/api/admin/users"), staffSession, createBody(id, "학습자", PASSWORD)).andExpect(status().isBadRequest());
        }
        UserAccount unchanged = users.findById(member.getId()).orElseThrow();
        assertThat(unchanged.getName()).isEqualTo(member.getName());
        assertThat(unchanged.isActive()).isTrue();
        assertThat(passwords.matches(PASSWORD, unchanged.getPasswordHash())).isTrue();
    }

    private UserAccount account(Role role, Track track, String hash) {
        return users.saveAndFlush(new UserAccount(studentId(), hash, "학생 관리 테스트", role, track));
    }

    private String studentId() {
        String id = String.valueOf(ThreadLocalRandom.current().nextLong(100000000000L, 999999999999L));
        studentIds.add(id);
        return id;
    }

    private static String createBody(String studentId, String name, String password) {
        return JSON.writeValueAsString(Map.of("studentId", studentId, "name", name, "initialPassword", password));
    }

    private ResultActions write(MockHttpServletRequestBuilder request, MockHttpSession session, String body) throws Exception {
        Cookie token = csrf(session);
        return mvc.perform(request.session(session).cookie(token).header("X-XSRF-TOKEN", token.getValue())
            .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private Cookie csrf(MockHttpSession session) throws Exception {
        var request = get("/api/csrf");
        if (session != null) request.session(session);
        return mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getCookie("XSRF-TOKEN");
    }

    private ResultActions attemptLogin(String studentId, String password) throws Exception {
        return write(post("/api/auth/login"), new MockHttpSession(),
            JSON.writeValueAsString(Map.of("studentId", studentId, "password", password)));
    }

    private MockHttpSession login(UserAccount user, String password) throws Exception {
        var result = attemptLogin(user.getStudentId(), password).andExpect(status().isOk()).andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }
}
