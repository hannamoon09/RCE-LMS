package com.rce.lms;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.rce.lms.file.FileStorage;
import com.rce.lms.user.*;
import jakarta.servlet.http.Cookie;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
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
class ProfileIntegrationTest {
    private static final String PASSWORD = "Profile-test-only-54!";
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final Path STORAGE = temporaryDirectory();
    @DynamicPropertySource
    static void storage(DynamicPropertyRegistry registry) { registry.add("app.file-storage-path", () -> STORAGE.toString()); }
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired ProfileFileRepository profileFiles;
    @Autowired FileStorage storage;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    final List<UserAccount> accounts = new ArrayList<>();
    UserAccount member, peer, staff, foreignMember, foreignStaff;
    MockHttpSession session;

    @BeforeEach
    void fixture() throws Exception {
        String hash = passwords.encode(PASSWORD);
        member = account(Role.MEMBER, Track.WEB, hash);
        peer = account(Role.MEMBER, Track.WEB, hash);
        staff = account(Role.STAFF, Track.WEB, hash);
        foreignMember = account(Role.MEMBER, Track.PWN, hash);
        foreignStaff = account(Role.STAFF, Track.PWN, hash);
        session = login(member, PASSWORD);
    }

    @AfterEach
    void cleanup() throws IOException {
        for (UserAccount user : accounts) {
            List<String> keys = jdbc.queryForList("SELECT storage_key FROM profile_files WHERE owner_id = ?", String.class, user.getId());
            jdbc.update("UPDATE users SET profile_image = NULL WHERE id = ?", user.getId());
            jdbc.update("DELETE FROM profile_files WHERE owner_id = ?", user.getId());
            for (String key : keys) storage.delete(key);
        }
        users.deleteAll(accounts);
        try (var files = Files.walk(STORAGE)) {
            assertThat(files.filter(Files::isRegularFile).toList()).isEmpty();
        }
    }

    @Test
    void profileEditPersistsAndReturnsTheSameCanonicalUserAsAuthAndAdmin() throws Exception {
        mvc.perform(get("/api/me").session(session)).andExpect(status().isOk())
            .andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(jsonPath("$.id").value(member.getId().toString()))
            .andExpect(jsonPath("$.profileImage").isEmpty());
        String body = write(patch("/api/me"), session, Map.of("name", "  새 이름  ", "email", "  member@example.org  "))
            .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("새 이름"))
            .andExpect(jsonPath("$.email").value("member@example.org"))
            .andExpect(jsonPath("$.studentId").value(member.getStudentId()))
            .andExpect(jsonPath("$.role").value("MEMBER")).andExpect(jsonPath("$.track").value("WEB"))
            .andExpect(jsonPath("$.credentialVersion").doesNotExist())
            .andExpect(jsonPath("$.passwordHash").doesNotExist()).andReturn().getResponse().getContentAsString();
        mvc.perform(get("/api/auth/me").session(session)).andExpect(content().json(body));
        UserAccount saved = users.findById(member.getId()).orElseThrow();
        assertThat(saved.getName()).isEqualTo("새 이름");
        assertThat(saved.getEmail()).isEqualTo("member@example.org");
        write(patch("/api/me"), session, Map.of("name", "새 이름", "email", "   "))
            .andExpect(status().isOk()).andExpect(jsonPath("$.email").isEmpty());
        write(patch("/api/me"), login(staff, PASSWORD), Map.of("name", "운영진 이름"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("STAFF"));
    }

    @Test
    void rejectsInvalidProfilesPrivilegedFieldsAndRequestsWithoutAuthenticationOrCsrf() throws Exception {
        for (Object body : List.of(Map.of(), Map.of("email", "member@example.org"), Map.of("name", " "),
                Map.of("name", "x".repeat(101)), Map.of("name", "학생", "email", "not-an-email"),
                Map.of("name", "학생", "email", "a".repeat(250) + "@x.org"))) {
            write(patch("/api/me"), session, body).andExpect(status().isBadRequest());
        }
        for (String field : List.of("id", "studentId", "role", "track", "active", "profileImage", "passwordHash", "credentialVersion")) {
            write(patch("/api/me"), session, Map.of("name", "변경 불가", field, "forged"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        }
        mvc.perform(get("/api/me")).andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/me").session(session).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"금지\"}"))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        assertThat(users.findById(member.getId()).orElseThrow().getName()).isEqualTo(member.getName());
    }

    @Test
    void uploadedImageMetadataIsConsistentAndOnlyOwnerOrOwnTrackCanDownload() throws Exception {
        byte[] bytes = png(512, 512);
        JsonNode uploaded = json(upload(session, image("프로필.png", bytes)).andExpect(status().isOk()).andReturn());
        JsonNode metadata = uploaded.get("profileImage");
        UUID id = UUID.fromString(metadata.get("id").asString());
        Set<String> fields = new HashSet<>();
        metadata.propertyNames().forEach(fields::add);
        assertThat(fields).containsExactlyInAnyOrder("id", "name", "size", "type");
        assertThat(metadata.get("size").asLong()).isEqualTo(bytes.length);
        assertThat(metadata.get("name").asString()).isEqualTo("프로필.png");
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk())
            .andExpect(jsonPath("$.profileImage.id").value(id.toString()));
        mvc.perform(get("/api/me").session(session)).andExpect(status().isOk())
            .andExpect(jsonPath("$.profileImage.id").value(id.toString()));
        JsonNode rows = json(mvc.perform(get("/api/admin/users").session(login(staff, PASSWORD))).andExpect(status().isOk()).andReturn());
        JsonNode adminMember = null;
        for (JsonNode row : rows) if (row.get("id").asString().equals(member.getId().toString())) adminMember = row;
        assertThat(adminMember).isNotNull();
        assertThat(adminMember.get("profileImage")).isEqualTo(metadata);
        for (UserAccount viewer : List.of(member, peer, staff)) {
            mvc.perform(get("/api/files/{id}", id).session(login(viewer, PASSWORD)))
                .andExpect(status().isOk()).andExpect(content().bytes(bytes)).andExpect(content().contentType("image/png"))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"));
        }
        for (UserAccount viewer : List.of(foreignMember, foreignStaff))
            mvc.perform(get("/api/files/{id}", id).session(login(viewer, PASSWORD))).andExpect(status().isNotFound());
        mvc.perform(get("/api/files/{id}", id)).andExpect(status().isUnauthorized());
        // No metadata ID can expose a detached profile, even to its former owner.
        jdbc.update("UPDATE users SET profile_image = NULL WHERE id = ?", member.getId());
        mvc.perform(get("/api/files/{id}", id).session(session)).andExpect(status().isNotFound());
    }

    @Test
    void replaceAndDeleteCommitMetadataAndCleanOldBytesWithIdempotentDelete() throws Exception {
        UUID first = imageId(upload(session, image("first.png", png(256, 256))).andExpect(status().isOk()).andReturn());
        String oldKey = profileFiles.findById(first).orElseThrow().getStorageKey();
        assertThat(storage.load(oldKey).exists()).isTrue();
        UUID second = imageId(upload(session, image("second.png", png(512, 512))).andExpect(status().isOk()).andReturn());
        String newKey = profileFiles.findById(second).orElseThrow().getStorageKey();
        assertThat(second).isNotEqualTo(first);
        assertThat(profileFiles.findById(first)).isEmpty();
        assertThat(Files.exists(STORAGE.resolve(oldKey))).isFalse();
        mvc.perform(get("/api/files/{id}", first).session(session)).andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM profile_files WHERE owner_id = ?", Long.class, member.getId())).isEqualTo(1);
        for (int attempt = 0; attempt < 2; attempt++)
            write(delete("/api/me/profile-image"), session, null).andExpect(status().isOk()).andExpect(jsonPath("$.profileImage").isEmpty());
        assertThat(profileFiles.findById(second)).isEmpty();
        assertThat(Files.exists(STORAGE.resolve(newKey))).isFalse();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM file_cleanup_jobs WHERE storage_key IN (?, ?)", Long.class, oldKey, newKey)).isZero();
    }

    @Test
    void invalidImagesAndMultipleUploadsKeepExistingImageAndDoNotLeakBytes() throws Exception {
        UUID existing = imageId(upload(session, image("valid.png", png(256, 256))).andExpect(status().isOk()).andReturn());
        for (MockMultipartFile file : List.of(image("bad.png", "not a png".getBytes()), image("small.png", png(128, 128)),
                image("wide.png", png(512, 256)), image("../unsafe.png", png(256, 256)),
                new MockMultipartFile("file", "bad.txt", "text/plain", "text".getBytes()),
                new MockMultipartFile("file", "mismatch.png", "image/jpeg", png(256, 256))))
            upload(session, file).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_FILE"));
        upload(session, image("large.png", new byte[5 * 1024 * 1024 + 1])).andExpect(status().isPayloadTooLarge());
        upload(session, image("one.png", png(256, 256)), image("two.png", png(256, 256)))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("TOO_MANY_FILES"));
        Cookie token = csrf(session);
        mvc.perform(multipart("/api/me/profile-image").session(session).cookie(token).header("X-XSRF-TOKEN", token.getValue()))
            .andExpect(status().isBadRequest());
        mvc.perform(multipart("/api/me/profile-image").session(session).file(image("csrf.png", png(256, 256))))
            .andExpect(status().isForbidden());
        assertThat(users.findById(member.getId()).orElseThrow().getProfileImage().getId()).isEqualTo(existing);
        try (var files = Files.walk(STORAGE)) { assertThat(files.filter(Files::isRegularFile).count()).isEqualTo(1); }
    }

    @Test
    void changingPasswordRevokesCurrentAndOtherSessionsAndOnlyNewPasswordAuthenticates() throws Exception {
        MockHttpSession secondSession = login(member, PASSWORD);
        String changed = "Changed-profile-password-8!";
        write(patch("/api/me/password"), session, Map.of("currentPassword", PASSWORD, "newPassword", changed))
            .andExpect(status().isNoContent()).andExpect(cookie().maxAge("JSESSIONID", 0)).andExpect(cookie().maxAge("XSRF-TOKEN", 0));
        assertThat(session.isInvalid()).isTrue();
        assertThat(users.findById(member.getId()).orElseThrow().getCredentialVersion()).isEqualTo(1);
        mvc.perform(get("/api/me").session(secondSession)).andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("SESSION_INVALID"));
        assertThat(secondSession.isInvalid()).isTrue();
        attemptLogin(member, PASSWORD).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/me").session(login(member, changed))).andExpect(status().isOk());
    }

    @Test
    void invalidPasswordChangesPreserveHashSessionAndCredentialVersion() throws Exception {
        write(patch("/api/me/password"), session, Map.of("currentPassword", "incorrect", "newPassword", "Changed-password-1!"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("CURRENT_PASSWORD_INCORRECT"));
        write(patch("/api/me/password"), session, Map.of("currentPassword", PASSWORD, "newPassword", PASSWORD))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("PASSWORD_UNCHANGED"));
        for (String next : List.of("1234567", "        ", "x".repeat(73), "가".repeat(25)))
            write(patch("/api/me/password"), session, Map.of("currentPassword", PASSWORD, "newPassword", next)).andExpect(status().isBadRequest());
        write(patch("/api/me/password"), session, Map.of("currentPassword", PASSWORD, "newPassword", "Good-password-1!", "id", peer.getId()))
            .andExpect(status().isBadRequest());
        assertThat(session.isInvalid()).isFalse();
        UserAccount unchanged = users.findById(member.getId()).orElseThrow();
        assertThat(unchanged.getCredentialVersion()).isZero();
        assertThat(passwords.matches(PASSWORD, unchanged.getPasswordHash())).isTrue();
        mvc.perform(get("/api/me").session(session)).andExpect(status().isOk());
    }

    @Test
    void staffPasswordResetRevokesAllExistingMemberSessionsBeforeCsrfValidation() throws Exception {
        MockHttpSession otherSession = login(member, PASSWORD);
        String changed = "Staff-reset-password-7!";
        write(patch("/api/admin/users/{id}", member.getId()), login(staff, PASSWORD), Map.of("newPassword", changed))
            .andExpect(status().isOk());
        mvc.perform(patch("/api/me").session(session).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"stale\"}"))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("SESSION_INVALID"));
        mvc.perform(get("/api/auth/me").session(otherSession)).andExpect(status().isUnauthorized());
        assertThat(session.isInvalid()).isTrue();
        assertThat(otherSession.isInvalid()).isTrue();
        attemptLogin(member, PASSWORD).andExpect(status().isUnauthorized());
        login(member, changed);
    }

    @Test
    void currentPasswordMustMatchAllBytesAtTheBcryptBoundary() throws Exception {
        for (String boundaryPassword : List.of("x".repeat(72), "가".repeat(24))) {
            member = users.findById(member.getId()).orElseThrow();
            member.setPasswordHash(passwords.encode(boundaryPassword));
            users.saveAndFlush(member);
            MockHttpSession owner = login(member, boundaryPassword);
            long version = member.getCredentialVersion();
            String changed = "Changed-profile-boundary-1!";
            write(patch("/api/me/password"), owner, Map.of("currentPassword", boundaryPassword + "z", "newPassword", changed))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("CURRENT_PASSWORD_INCORRECT"));
            assertThat(owner.isInvalid()).isFalse();
            UserAccount unchanged = users.findById(member.getId()).orElseThrow();
            assertThat(unchanged.getCredentialVersion()).isEqualTo(version);
            assertThat(unchanged.getPasswordHash()).isEqualTo(member.getPasswordHash());
            write(patch("/api/me/password"), owner, Map.of("currentPassword", boundaryPassword, "newPassword", changed))
                .andExpect(status().isNoContent());
            assertThat(owner.isInvalid()).isTrue();
            login(member, changed);
        }
    }

    private ResultActions upload(MockHttpSession session, MockMultipartFile... files) throws Exception {
        var request = multipart("/api/me/profile-image");
        for (MockMultipartFile file : files) request.file(file);
        Cookie token = csrf(session);
        return mvc.perform(request.session(session).cookie(token).header("X-XSRF-TOKEN", token.getValue()));
    }
    private MockMultipartFile image(String name, byte[] bytes) { return new MockMultipartFile("file", name, "image/png", bytes); }
    private static byte[] png(int width, int height) throws IOException {
        var output = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB), "png", output);
        return output.toByteArray();
    }
    private UUID imageId(MvcResult result) { return UUID.fromString(json(result).get("profileImage").get("id").asString()); }
    private JsonNode json(MvcResult result) { return JSON.readTree(result.getResponse().getContentAsByteArray()); }
    private UserAccount account(Role role, Track track, String hash) {
        UserAccount user = users.saveAndFlush(new UserAccount(String.valueOf(ThreadLocalRandom.current().nextLong(100000000000L, 999999999999L)), hash, "프로필 테스트", role, track));
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
    private ResultActions attemptLogin(UserAccount user, String password) throws Exception {
        Cookie token = csrf(null);
        return mvc.perform(post("/api/auth/login").cookie(token).header("X-XSRF-TOKEN", token.getValue())
            .contentType(MediaType.APPLICATION_JSON).content(JSON.writeValueAsBytes(Map.of("studentId", user.getStudentId(), "password", password))));
    }
    private MockHttpSession login(UserAccount user, String password) throws Exception {
        return (MockHttpSession) attemptLogin(user, password).andExpect(status().isOk()).andReturn().getRequest().getSession(false);
    }
    private static Path temporaryDirectory() {
        try { return Files.createTempDirectory("rce-lms-profile-"); }
        catch (IOException error) { throw new IllegalStateException(error); }
    }
}
