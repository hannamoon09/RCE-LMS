package com.rce.lms;

import static org.assertj.core.api.Assertions.*;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.rce.lms.assignment.*;
import com.rce.lms.file.FileStorage;
import com.rce.lms.submission.SubmissionRepository;
import com.rce.lms.user.*;
import jakarta.servlet.http.Cookie;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.*;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class FileApiIntegrationTest {
    private static final String PASSWORD = "File-api-test-only-54!";
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final Path STORAGE = temporaryDirectory();
    @DynamicPropertySource
    static void storage(DynamicPropertyRegistry registry) { registry.add("app.file-storage-path", () -> STORAGE.toString()); }
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired AssignmentRepository assignments;
    @Autowired SubmissionRepository submissions;
    @Autowired FileStorage storage;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    final List<UserAccount> accounts = new ArrayList<>();
    final List<UUID> assignmentIds = new ArrayList<>();
    UserAccount staff;
    UserAccount member;
    UserAccount peer;
    UserAccount foreignMember;
    UserAccount foreignStaff;
    Assignment assignment;

    @BeforeEach
    void fixture() {
        String hash = passwords.encode(PASSWORD);
        staff = account(Role.STAFF, Track.WEB, hash);
        member = account(Role.MEMBER, Track.WEB, hash);
        peer = account(Role.MEMBER, Track.WEB, hash);
        foreignMember = account(Role.MEMBER, Track.PWN, hash);
        foreignStaff = account(Role.STAFF, Track.PWN, hash);
        assignment = assignments.saveAndFlush(new Assignment(new AssignmentRequest("파일 과제", "실습 자료", "Medium",
            Instant.now().plusSeconds(86400)), staff));
        assignmentIds.add(assignment.getId());
    }

    @AfterEach
    void cleanup() throws IOException {
        for (UUID assignmentId : assignmentIds) {
            var keys = new ArrayList<>(jdbc.queryForList("SELECT storage_key FROM assignment_files WHERE assignment_id = ?", String.class, assignmentId));
            keys.addAll(jdbc.queryForList("SELECT f.storage_key FROM submission_files f JOIN submissions s ON f.submission_id = s.id WHERE s.assignment_id = ?", String.class, assignmentId));
            jdbc.update("DELETE FROM submission_files WHERE submission_id IN (SELECT id FROM submissions WHERE assignment_id = ?)", assignmentId);
            jdbc.update("DELETE FROM submissions WHERE assignment_id = ?", assignmentId);
            jdbc.update("DELETE FROM assignment_files WHERE assignment_id = ?", assignmentId);
            for (String key : keys) storage.delete(key);
        }
        assignments.deleteAllById(assignmentIds);
        users.deleteAll(accounts);
        try (var files = Files.walk(STORAGE)) {
            assertThat(files.filter(Files::isRegularFile).toList()).as("No file bytes remain after scoped test cleanup").isEmpty();
        }
    }

    @Test
    void staffCreatesAssignmentWithPrivateAttachmentAndOwnTrackMembersDownloadIt() throws Exception {
        JsonNode created = json(upload(HttpMethod.POST, "/api/admin/assignments", login(staff), assignmentData(List.of()), textFile("실습 안내.md", "# 실습 가이드"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.attachments", hasSize(1)))
            .andExpect(jsonPath("$.attachments[0].storageKey").doesNotExist()).andReturn());
        UUID id = UUID.fromString(created.get("id").asString());
        assignmentIds.add(id);
        UUID fileId = UUID.fromString(created.get("attachments").get(0).get("id").asString());
        mvc.perform(get("/api/assignments/{id}", id).session(login(member)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.attachments[0].id").value(fileId.toString()));
        mvc.perform(get("/api/files/{id}", fileId).session(login(member)))
            .andExpect(status().isOk()).andExpect(header().string("Content-Disposition", startsWith("attachment;")))
            .andExpect(header().string("X-Content-Type-Options", "nosniff"))
            .andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(content().contentType("text/markdown"))
            .andExpect(content().bytes("# 실습 가이드".getBytes(StandardCharsets.UTF_8)));
        mvc.perform(get("/api/files/{id}", fileId).session(login(foreignMember))).andExpect(status().isNotFound());
        mvc.perform(get("/api/files/{id}", fileId).session(login(foreignStaff))).andExpect(status().isNotFound());
        mvc.perform(get("/api/files/{id}", fileId)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/files/{id}", UUID.randomUUID()).session(login(member))).andExpect(status().isNotFound());
    }

    @Test
    void fileOnlySubmissionIsPrivateToOwnerAndOwnTrackStaff() throws Exception {
        MockHttpSession owner = login(member);
        JsonNode saved = json(upload(HttpMethod.POST, submissionUrl(), owner, Map.of("retainedFileIds", List.of()), textFile("보고서.txt", "파일만 제출"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.content").value(nullValue()))
            .andExpect(jsonPath("$.files", hasSize(1))).andExpect(jsonPath("$.status").value("PENDING")).andReturn());
        UUID fileId = fileId(saved, "files", 0);
        mvc.perform(get("/api/files/{id}", fileId).session(owner)).andExpect(status().isOk())
            .andExpect(content().bytes("파일만 제출".getBytes(StandardCharsets.UTF_8)));
        mvc.perform(get("/api/files/{id}", fileId).session(login(staff))).andExpect(status().isOk());
        mvc.perform(get("/api/files/{id}", fileId).session(login(peer))).andExpect(status().isNotFound());
        mvc.perform(get("/api/files/{id}", fileId).session(login(foreignStaff))).andExpect(status().isNotFound());
        mvc.perform(get("/api/submissions/me").session(owner)).andExpect(status().isOk())
            .andExpect(jsonPath("$[0].files[0].id").value(fileId.toString()));
        write(delete("/api/admin/assignments/{id}", assignment.getId()), login(staff), null)
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ASSIGNMENT_HAS_SUBMISSIONS"));
        mvc.perform(get("/api/files/{id}", fileId).session(owner)).andExpect(status().isOk());
    }

    @Test
    void resubmissionCanRetainThenReplaceFilesAndJsonResubmissionClearsThem() throws Exception {
        MockHttpSession owner = login(member);
        JsonNode first = json(upload(HttpMethod.POST, submissionUrl(), owner, Map.of(), textFile("처음.txt", "첫 파일"))
            .andExpect(status().isOk()).andReturn());
        UUID firstFile = fileId(first, "files", 0);
        String firstKey = jdbc.queryForObject("SELECT storage_key FROM submission_files WHERE id = ?", String.class, firstFile);
        JsonNode retained = json(upload(HttpMethod.POST, submissionUrl(), owner, Map.of("retainedFileIds", List.of(firstFile)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(first.get("id").asString())).andReturn());
        assertThat(fileId(retained, "files", 0)).isEqualTo(firstFile);
        assertThat(storage.load(firstKey).exists()).isTrue();
        JsonNode second = json(upload(HttpMethod.POST, submissionUrl(), owner, Map.of("content", "새 제출"), textFile("교체.txt", "교체 파일"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.files", hasSize(1))).andReturn());
        UUID secondFile = fileId(second, "files", 0);
        String secondKey = jdbc.queryForObject("SELECT storage_key FROM submission_files WHERE id = ?", String.class, secondFile);
        assertThat(Files.exists(STORAGE.resolve(firstKey))).isFalse();
        mvc.perform(get("/api/files/{id}", firstFile).session(owner)).andExpect(status().isNotFound());
        write(post(submissionUrl()), owner, Map.of("content", "메모만 남긴 최종 제출"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.files", hasSize(0)));
        assertThat(Files.exists(STORAGE.resolve(secondKey))).isFalse();
        mvc.perform(get("/api/files/{id}", secondFile).session(owner)).andExpect(status().isNotFound());
    }

    @Test
    void assignmentJsonEditPreservesAttachmentsAndMultipartDeleteRemovesPhysicalBytes() throws Exception {
        MockHttpSession admin = login(staff);
        JsonNode withFile = json(upload(HttpMethod.PATCH, assignmentUrl(), admin, assignmentData(List.of()), textFile("자료.txt", "과제 자료"))
            .andExpect(status().isOk()).andReturn());
        UUID fileId = fileId(withFile, "attachments", 0);
        String key = jdbc.queryForObject("SELECT storage_key FROM assignment_files WHERE id = ?", String.class, fileId);
        Map<String, Object> plain = new HashMap<>(assignmentData(List.of()));
        plain.remove("retainedFileIds");
        plain.put("title", "설명만 수정");
        write(patch(assignmentUrl()), admin, plain).andExpect(status().isOk())
            .andExpect(jsonPath("$.attachments[0].id").value(fileId.toString()));
        upload(HttpMethod.PATCH, assignmentUrl(), admin, assignmentData(List.of(fileId)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.attachments[0].id").value(fileId.toString()));
        write(delete(assignmentUrl()), admin, null).andExpect(status().isNoContent());
        assertThat(Files.exists(STORAGE.resolve(key))).isFalse();
        mvc.perform(get("/api/files/{id}", fileId).session(login(member))).andExpect(status().isNotFound());
    }

    @Test
    void forgedRetainedFilesRollbackUploadsAndKeepPriorSubmission() throws Exception {
        MockHttpSession owner = login(member);
        JsonNode original = json(upload(HttpMethod.POST, submissionUrl(), owner, Map.of("content", "원본"), textFile("원본.txt", "보존 파일"))
            .andExpect(status().isOk()).andReturn());
        UUID originalFile = fileId(original, "files", 0);
        MockHttpSession other = login(peer);
        upload(HttpMethod.POST, submissionUrl(), other, Map.of("retainedFileIds", List.of(originalFile)), textFile("실패.txt", "정리 대상"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_RETAINED_FILES"));
        assertThat(submissions.countByUserIdAndAssignmentId(peer.getId(), assignment.getId())).isZero();
        upload(HttpMethod.POST, submissionUrl(), owner, Map.of("retainedFileIds", List.of(originalFile, originalFile)))
            .andExpect(status().isBadRequest());
        upload(HttpMethod.POST, submissionUrl(), owner, Map.of())
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("EMPTY_SUBMISSION"));
        mvc.perform(get(submissionUrl()).session(owner)).andExpect(status().isOk())
            .andExpect(jsonPath("$.content").value("원본")).andExpect(jsonPath("$.files[0].id").value(originalFile.toString()));
        try (var files = Files.walk(STORAGE)) { assertThat(files.filter(Files::isRegularFile).count()).isEqualTo(1); }
    }

    @Test
    void combinedRetainedAndNewFilesCannotExceedFive() throws Exception {
        MockHttpSession owner = login(member);
        JsonNode first = json(upload(HttpMethod.POST, submissionUrl(), owner, Map.of(), textFile("one.txt", "1"), textFile("two.txt", "2"),
                textFile("three.txt", "3"), textFile("four.txt", "4"), textFile("five.txt", "5"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.files", hasSize(5))).andReturn());
        List<UUID> ids = new ArrayList<>();
        for (JsonNode file : first.get("files")) ids.add(UUID.fromString(file.get("id").asString()));
        upload(HttpMethod.POST, submissionUrl(), owner, Map.of("retainedFileIds", ids), textFile("six.txt", "6"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("FILE_LIMIT"));
        mvc.perform(get(submissionUrl()).session(owner)).andExpect(status().isOk()).andExpect(jsonPath("$.files", hasSize(5)));
        try (var files = Files.walk(STORAGE)) { assertThat(files.filter(Files::isRegularFile).count()).isEqualTo(5); }
    }

    @Test
    void multipartMutationsEnforceRoleTrackDeadlineCsrfAndUnknownFieldRules() throws Exception {
        upload(HttpMethod.PATCH, assignmentUrl(), login(member), assignmentData(List.of()), textFile("blocked.txt", "x"))
            .andExpect(status().isForbidden());
        upload(HttpMethod.PATCH, assignmentUrl(), login(foreignStaff), assignmentData(List.of()), textFile("blocked.txt", "x"))
            .andExpect(status().isNotFound());
        upload(HttpMethod.POST, submissionUrl(), login(foreignMember), Map.of(), textFile("blocked.txt", "x"))
            .andExpect(status().isNotFound());
        upload(HttpMethod.POST, submissionUrl(), login(staff), Map.of(), textFile("blocked.txt", "x"))
            .andExpect(status().isForbidden());
        MockHttpSession owner = login(member);
        upload(HttpMethod.POST, submissionUrl(), owner, Map.of("userId", peer.getId()), textFile("blocked.txt", "x"))
            .andExpect(status().isBadRequest());
        mvc.perform(multipart(submissionUrl()).file(data(Map.of())).file(textFile("csrf.txt", "x")).session(owner))
            .andExpect(status().isForbidden());
        jdbc.update("UPDATE assignments SET deadline = ? WHERE id = ?", java.sql.Timestamp.from(Instant.now().minusSeconds(1)), assignment.getId());
        upload(HttpMethod.POST, submissionUrl(), owner, Map.of(), textFile("late.txt", "x"))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ASSIGNMENT_CLOSED"));
        try (var files = Files.walk(STORAGE)) { assertThat(files.filter(Files::isRegularFile).count()).isZero(); }
    }

    private ResultActions upload(HttpMethod method, String url, MockHttpSession session, Object input, MockMultipartFile... files) throws Exception {
        var request = multipart(method, url).file(data(input));
        for (MockMultipartFile file : files) request.file(file);
        Cookie token = csrf(session);
        return mvc.perform(request.session(session).cookie(token).header("X-XSRF-TOKEN", token.getValue()));
    }
    private MockMultipartFile data(Object input) {
        return new MockMultipartFile("data", "", MediaType.APPLICATION_JSON_VALUE, JSON.writeValueAsBytes(input));
    }
    private MockMultipartFile textFile(String name, String body) {
        return new MockMultipartFile("files", name, name.endsWith(".md") ? "text/markdown" : "text/plain", body.getBytes(StandardCharsets.UTF_8));
    }
    private Map<String, Object> assignmentData(List<UUID> retained) {
        return Map.of("title", "첨부 과제", "description", "본문은 첨부파일과 별개입니다.", "difficulty", "High",
            "deadline", Instant.now().plusSeconds(86400).toString(), "retainedFileIds", retained);
    }
    private String assignmentUrl() { return "/api/admin/assignments/" + assignment.getId(); }
    private String submissionUrl() { return "/api/assignments/" + assignment.getId() + "/submission"; }
    private JsonNode json(MvcResult result) { return JSON.readTree(result.getResponse().getContentAsByteArray()); }
    private UUID fileId(JsonNode node, String field, int index) { return UUID.fromString(node.get(field).get(index).get("id").asString()); }
    private UserAccount account(Role role, Track track, String hash) {
        UserAccount user = users.saveAndFlush(new UserAccount(String.valueOf(ThreadLocalRandom.current().nextLong(100000000000L, 999999999999L)), hash, "파일 테스트", role, track));
        accounts.add(user);
        return user;
    }
    private ResultActions write(MockHttpServletRequestBuilder request, MockHttpSession session, Object body) throws Exception {
        Cookie token = csrf(session);
        request.session(session).cookie(token).header("X-XSRF-TOKEN", token.getValue());
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).content(JSON.writeValueAsBytes(body));
        return mvc.perform(request);
    }
    private Cookie csrf(MockHttpSession session) throws Exception {
        var request = get("/api/csrf");
        if (session != null) request.session(session);
        return mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getCookie("XSRF-TOKEN");
    }
    private MockHttpSession login(UserAccount user) throws Exception {
        Cookie token = csrf(null);
        var result = mvc.perform(post("/api/auth/login").cookie(token).header("X-XSRF-TOKEN", token.getValue())
                .contentType(MediaType.APPLICATION_JSON).content(JSON.writeValueAsBytes(Map.of("studentId", user.getStudentId(), "password", PASSWORD))))
            .andExpect(status().isOk()).andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }
    private static Path temporaryDirectory() {
        try { return Files.createTempDirectory("rce-lms-file-api-"); }
        catch (IOException error) { throw new IllegalStateException(error); }
    }
}
