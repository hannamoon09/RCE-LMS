package com.rce.lms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.rce.lms.assignment.AssignmentRepository;
import com.rce.lms.user.Role;
import com.rce.lms.user.Track;
import com.rce.lms.user.UserAccount;
import com.rce.lms.user.UserRepository;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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
class AssignmentIntegrationTest {
    private static final String PASSWORD = "Assignment-test-only-54!";
    private static final String DEADLINE = Instant.now().plusSeconds(7 * 86400).truncatedTo(java.time.temporal.ChronoUnit.SECONDS).toString();
    private static final JsonMapper JSON = JsonMapper.builder().build();
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired AssignmentRepository assignments;
    @Autowired PasswordEncoder passwords;
    final List<UserAccount> accounts = new ArrayList<>();
    final List<UUID> created = new ArrayList<>();
    UserAccount webStaff;
    UserAccount pwnStaff;
    UserAccount webMember;
    UserAccount pwnMember;

    @BeforeEach
    void accounts() {
        String hash = passwords.encode(PASSWORD);
        webStaff = account("웹 운영진", Role.STAFF, Track.WEB, hash);
        pwnStaff = account("포너블 운영진", Role.STAFF, Track.PWN, hash);
        webMember = account("웹 학습자", Role.MEMBER, Track.WEB, hash);
        pwnMember = account("포너블 학습자", Role.MEMBER, Track.PWN, hash);
    }

    @AfterEach
    void cleanup() {
        assignments.deleteAllById(created);
        users.deleteAll(accounts);
    }

    @Test
    void staffCreatesPersistentOwnTrackAssignmentAndMembersSeeOnlyTheirTrack() throws Exception {
        UUID webId = create(login(webStaff), "웹 과제");
        UUID pwnId = create(login(pwnStaff), "포너블 과제");
        assertThat(assignments.findById(webId).orElseThrow().getTargetTrack()).isEqualTo(Track.WEB);
        MockHttpSession web = login(webMember);
        mvc.perform(get("/api/assignments").session(web))
            .andExpect(status().isOk()).andExpect(jsonPath("$[*].id", hasItem(webId.toString())))
            .andExpect(jsonPath("$[*].id", not(hasItem(pwnId.toString()))));
        mvc.perform(get("/api/assignments/{id}", webId).session(web))
            .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("웹 과제"))
            .andExpect(jsonPath("$.author").value("웹 운영진"))
            .andExpect(jsonPath("$.difficulty").value("Medium"))
            .andExpect(jsonPath("$.deadline").value(DEADLINE))
            .andExpect(jsonPath("$.attachments", hasSize(0)))
            .andExpect(jsonPath("$.targetTrack").doesNotExist())
            .andExpect(jsonPath("$.authorId").doesNotExist());
        mvc.perform(get("/api/assignments/{id}", webId).session(login(pwnMember)))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("ASSIGNMENT_NOT_FOUND"));
    }

    @Test
    void staffCanUpdateAndDeleteOwnTrackButCannotReadOrMutateAnotherTrackById() throws Exception {
        MockHttpSession web = login(webStaff);
        MockHttpSession pwn = login(pwnStaff);
        UUID webId = create(web, "기존 제목");
        UUID pwnId = create(pwn, "보호할 포너블 과제");
        Instant createdAt = assignments.findById(webId).orElseThrow().getCreatedAt();
        mvc.perform(get("/api/admin/assignments").session(web).queryParam("track", "PWN"))
            .andExpect(status().isOk()).andExpect(jsonPath("$[*].id", hasItem(webId.toString())))
            .andExpect(jsonPath("$[*].id", not(hasItem(pwnId.toString()))));
        write(patch("/api/admin/assignments/{id}", webId), web, payload("수정 제목"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("수정 제목"))
            .andExpect(jsonPath("$.author").value("웹 운영진"));
        assertThat(assignments.findById(webId).orElseThrow().getCreatedAt()).isEqualTo(createdAt);
        mvc.perform(get("/api/assignments/{id}", pwnId).session(web)).andExpect(status().isNotFound());
        write(patch("/api/admin/assignments/{id}", pwnId), web, payload("타 분야 수정"))
            .andExpect(status().isNotFound());
        write(delete("/api/admin/assignments/{id}", pwnId), web, null).andExpect(status().isNotFound());
        assertThat(assignments.findById(pwnId).orElseThrow().getTitle()).isEqualTo("보호할 포너블 과제");
        write(delete("/api/admin/assignments/{id}", webId), web, null).andExpect(status().isNoContent());
        assertThat(assignments.existsById(webId)).isFalse();
        mvc.perform(get("/api/assignments/{id}", webId).session(web)).andExpect(status().isNotFound());
    }

    @Test
    void memberCannotUseAnyAdminAssignmentEndpoint() throws Exception {
        UUID id = create(login(webStaff), "관리자 전용");
        MockHttpSession member = login(webMember);
        mvc.perform(get("/api/admin/assignments").session(member)).andExpect(status().isForbidden());
        write(post("/api/admin/assignments"), member, payload("위조 생성")).andExpect(status().isForbidden());
        write(patch("/api/admin/assignments/{id}", id), member, payload("위조 수정")).andExpect(status().isForbidden());
        write(delete("/api/admin/assignments/{id}", id), member, null).andExpect(status().isForbidden());
        assertThat(assignments.findById(id).orElseThrow().getTitle()).isEqualTo("관리자 전용");
    }

    @Test
    void rejectsClientOwnedTrackAuthorAndInvalidEditorInputs() throws Exception {
        MockHttpSession staff = login(webStaff);
        String valid = payload("제목");
        for (String extra : List.of("\"targetTrack\":\"PWN\"", "\"author\":\"다른 운영진\"", "\"id\":\"forged\"")) {
            write(post("/api/admin/assignments"), staff, valid.substring(0, valid.length() - 1) + "," + extra + "}")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        }
        for (String input : List.of(payload(" "), payload("x".repeat(121)),
                JSON.writeValueAsString(Map.of("title", "제목", "description", "", "difficulty", "Medium", "deadline", DEADLINE)),
                JSON.writeValueAsString(Map.of("title", "제목", "description", "x".repeat(20001), "difficulty", "Medium", "deadline", DEADLINE)),
                valid.replace("Medium", "Extreme"), valid.replace(DEADLINE, "not-a-date"),
                "{\"title\":\"제목\",\"description\":\"설명\",\"difficulty\":\"Medium\"}")) {
            write(post("/api/admin/assignments"), staff, input).andExpect(status().isBadRequest());
        }
    }

    @Test
    void readRequiresLoginAndEveryMutationRequiresCsrf() throws Exception {
        mvc.perform(get("/api/assignments")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/assignments/{id}", UUID.randomUUID())).andExpect(status().isUnauthorized());
        MockHttpSession staff = login(webStaff);
        UUID id = create(staff, "CSRF 보호");
        mvc.perform(post("/api/admin/assignments").session(staff).contentType(MediaType.APPLICATION_JSON).content(payload("추가")))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        mvc.perform(patch("/api/admin/assignments/{id}", id).session(staff).contentType(MediaType.APPLICATION_JSON).content(payload("수정")))
            .andExpect(status().isForbidden());
        mvc.perform(delete("/api/admin/assignments/{id}", id).session(staff)).andExpect(status().isForbidden());
    }

    @Test
    void malformedAndMissingIdsAreHandledAndPastDeadlinesRemainEditable() throws Exception {
        MockHttpSession staff = login(webStaff);
        write(post("/api/admin/assignments"), staff, payload("지난 마감 신규 과제").replace(DEADLINE, "2020-01-01T00:00:00Z"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_DEADLINE"));
        mvc.perform(get("/api/assignments/not-a-uuid").session(staff)).andExpect(status().isBadRequest());
        write(patch("/api/admin/assignments/{id}", UUID.randomUUID()), staff, payload("없는 과제"))
            .andExpect(status().isNotFound());
        UUID id = create(staff, "마감 과제");
        write(patch("/api/admin/assignments/{id}", id), staff, payload("마감 후 수정").replace(DEADLINE, "2020-01-01T00:00:00Z"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.deadline").value("2020-01-01T00:00:00Z"));
    }

    private UserAccount account(String name, Role role, Track track, String hash) {
        UserAccount user = users.saveAndFlush(new UserAccount(
            String.valueOf(ThreadLocalRandom.current().nextLong(100000000000L, 999999999999L)), hash, name, role, track));
        accounts.add(user);
        return user;
    }

    private UUID create(MockHttpSession session, String title) throws Exception {
        var result = write(post("/api/admin/assignments"), session, payload(title)).andExpect(status().isCreated())
            .andExpect(jsonPath("$.createdAt").isNotEmpty()).andExpect(jsonPath("$.updatedAt").isNotEmpty()).andReturn();
        UUID id = UUID.fromString(JSON.readTree(result.getResponse().getContentAsString()).get("id").asText());
        created.add(id);
        return id;
    }

    private ResultActions write(MockHttpServletRequestBuilder request, MockHttpSession session, String body) throws Exception {
        Cookie token = csrf(session);
        request.session(session).cookie(token).header("X-XSRF-TOKEN", token.getValue());
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).content(body);
        return mvc.perform(request);
    }

    private String payload(String title) {
        return JSON.writeValueAsString(Map.of("title", title, "description", "분석과 실습을 진행합니다.",
            "difficulty", "Medium", "deadline", DEADLINE));
    }

    private Cookie csrf(MockHttpSession session) throws Exception {
        var request = get("/api/csrf");
        if (session != null) request.session(session);
        return mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getCookie("XSRF-TOKEN");
    }

    private MockHttpSession login(UserAccount user) throws Exception {
        Cookie token = csrf(null);
        var result = mvc.perform(post("/api/auth/login").cookie(token).header("X-XSRF-TOKEN", token.getValue())
                .contentType(MediaType.APPLICATION_JSON)
                .content(JSON.writeValueAsString(Map.of("studentId", user.getStudentId(), "password", PASSWORD))))
            .andExpect(status().isOk()).andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }
}
