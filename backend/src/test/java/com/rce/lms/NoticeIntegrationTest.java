package com.rce.lms;

import static org.assertj.core.api.Assertions.*;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.rce.lms.notice.*;
import com.rce.lms.user.*;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class NoticeIntegrationTest {
    private static final String PASSWORD = "Notice-test-only-54!";
    private static final JsonMapper JSON = JsonMapper.builder().build();
    @Autowired MockMvc mvc;
    @Autowired NoticeRepository notices;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwords;
    @Autowired JdbcTemplate jdbc;
    final List<UserAccount> accounts = new ArrayList<>();
    final List<UUID> noticeIds = new ArrayList<>();
    UserAccount webStaff, peerStaff, pwnStaff, webMember, pwnMember;
    Notice own, foreign, global;

    @BeforeEach
    void fixture() {
        String hash = passwords.encode(PASSWORD);
        webStaff = account("웹 운영진", Role.STAFF, Track.WEB, hash);
        peerStaff = account("다른 웹 운영진", Role.STAFF, Track.WEB, hash);
        pwnStaff = account("포너블 운영진", Role.STAFF, Track.PWN, hash);
        webMember = account("웹 학습자", Role.MEMBER, Track.WEB, hash);
        pwnMember = account("포너블 학습자", Role.MEMBER, Track.PWN, hash);
        own = notice("웹 분야 공지", webStaff, false);
        foreign = notice("포너블 분야 공지", pwnStaff, false);
        global = notice("전체 공지", webStaff, true);
        // Global notices are provisioned separately; there is intentionally no global-write API.
        jdbc.update("UPDATE notices SET track = NULL WHERE id = ?", global.getId());
    }

    @AfterEach
    void cleanup() {
        notices.deleteAllById(noticeIds);
        users.deleteAll(accounts);
    }

    @Test
    void everyAuthenticatedRoleSeesGlobalAndOwnTrackOnly() throws Exception {
        for (UserAccount user : List.of(webMember, webStaff, pwnMember, pwnStaff)) {
            MockHttpSession session = login(user);
            UUID allowed = user.getTrack() == Track.WEB ? own.getId() : foreign.getId();
            UUID denied = user.getTrack() == Track.WEB ? foreign.getId() : own.getId();
            mvc.perform(get("/api/notices").session(session).queryParam("track", user.getTrack() == Track.WEB ? "PWN" : "WEB"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[*].id", hasItems(global.getId().toString(), allowed.toString())))
                .andExpect(jsonPath("$[*].id", not(hasItem(denied.toString()))));
            mvc.perform(get("/api/notices/{id}", global.getId()).session(session))
                .andExpect(status().isOk()).andExpect(jsonPath("$.track").value(nullValue()));
            mvc.perform(get("/api/notices/{id}", allowed).session(session)).andExpect(status().isOk());
            mvc.perform(get("/api/notices/{id}", denied).session(session))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOTICE_NOT_FOUND"));
        }
    }

    @Test
    void staffCreatesAutomaticTrackAndAuthorThenOwnTrackPeerCanEditAndDelete() throws Exception {
        var response = write(post("/api/admin/notices"), login(webStaff), payload("  새 공지  "))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.title").value("새 공지"))
            .andExpect(jsonPath("$.body").value("첫 문단\n\n두 번째 문단"))
            .andExpect(jsonPath("$.category").value("운영 안내")).andExpect(jsonPath("$.important").value(false))
            .andExpect(jsonPath("$.track").value("WEB")).andExpect(jsonPath("$.author").value("웹 운영진"))
            .andExpect(jsonPath("$.authorId").doesNotExist()).andReturn();
        UUID id = UUID.fromString(JSON.readTree(response.getResponse().getContentAsByteArray()).get("id").asString());
        noticeIds.add(id);
        Instant createdAt = notices.findById(id).orElseThrow().getCreatedAt();
        MockHttpSession peer = login(peerStaff);
        write(patch("/api/admin/notices/{id}", id), peer, Map.of("title", "수정 공지", "body", "본문 수정", "category", "과제 안내", "important", true))
            .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("수정 공지"))
            .andExpect(jsonPath("$.author").value("웹 운영진")).andExpect(jsonPath("$.important").value(true))
            .andExpect(jsonPath("$.track").value("WEB"));
        assertThat(notices.findById(id).orElseThrow().getCreatedAt()).isEqualTo(createdAt);
        write(delete("/api/admin/notices/{id}", id), peer, null).andExpect(status().isNoContent());
        assertThat(notices.existsById(id)).isFalse();
        mvc.perform(get("/api/notices/{id}", id).session(peer)).andExpect(status().isNotFound());
    }

    @Test
    void globalNoticesAndForeignTrackNoticesAreImmutableToStaff() throws Exception {
        MockHttpSession web = login(webStaff);
        for (Notice protectedNotice : List.of(global, foreign)) {
            write(patch("/api/admin/notices/{id}", protectedNotice.getId()), web, payload("허용되지 않은 수정"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOTICE_NOT_FOUND"));
            write(delete("/api/admin/notices/{id}", protectedNotice.getId()), web, null).andExpect(status().isNotFound());
            assertThat(notices.findById(protectedNotice.getId()).orElseThrow().getTitle()).isEqualTo(protectedNotice.getTitle());
        }
        write(patch("/api/admin/notices/{id}", global.getId()), login(pwnStaff), payload("전체 공지 수정"))
            .andExpect(status().isNotFound());
        assertThat(notices.findById(global.getId()).orElseThrow().getTrack()).isNull();
    }

    @Test
    void rejectsUnknownPrivilegeFieldsAndInvalidEditorData() throws Exception {
        MockHttpSession staff = login(webStaff);
        for (String field : List.of("track", "author", "authorId", "id", "createdAt", "updatedAt")) {
            Map<String, Object> body = new HashMap<>(payload("공지"));
            body.put(field, "PWN");
            write(post("/api/admin/notices"), staff, body).andExpect(status().isBadRequest());
            write(patch("/api/admin/notices/{id}", own.getId()), staff, body).andExpect(status().isBadRequest());
        }
        Map<String, Object> nullTrack = new HashMap<>(payload("전체 공지 위조"));
        nullTrack.put("track", null);
        write(post("/api/admin/notices"), staff, nullTrack).andExpect(status().isBadRequest());
        for (Map<String, Object> invalid : List.of(payload(" "), payload("x".repeat(121)),
                Map.<String, Object>of("title", "공지", "body", " ", "category", "안내", "important", false),
                Map.<String, Object>of("title", "공지", "body", "x".repeat(20001), "category", "안내", "important", false),
                Map.<String, Object>of("title", "공지", "body", "본문", "category", " ", "important", false),
                Map.<String, Object>of("title", "공지", "body", "본문", "category", "x".repeat(51), "important", false),
                Map.<String, Object>of("title", "공지", "body", "본문", "category", "안내"))) {
            write(post("/api/admin/notices"), staff, invalid).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        }
    }

    @Test
    void anonymousMemberMutationsAndMissingCsrfAreDenied() throws Exception {
        mvc.perform(get("/api/notices")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/notices/{id}", global.getId())).andExpect(status().isUnauthorized());
        MockHttpSession member = login(webMember);
        write(post("/api/admin/notices"), member, payload("학생 공지")).andExpect(status().isForbidden());
        write(patch("/api/admin/notices/{id}", own.getId()), member, payload("학생 수정")).andExpect(status().isForbidden());
        write(delete("/api/admin/notices/{id}", own.getId()), member, null).andExpect(status().isForbidden());
        MockHttpSession staff = login(webStaff);
        mvc.perform(post("/api/admin/notices").session(staff).contentType(MediaType.APPLICATION_JSON).content(JSON.writeValueAsBytes(payload("토큰 없는 공지"))))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        mvc.perform(patch("/api/admin/notices/{id}", own.getId()).session(staff).contentType(MediaType.APPLICATION_JSON).content(JSON.writeValueAsBytes(payload("수정"))))
            .andExpect(status().isForbidden());
        mvc.perform(delete("/api/admin/notices/{id}", own.getId()).session(staff)).andExpect(status().isForbidden());
        mvc.perform(get("/api/notices/not-a-uuid").session(staff)).andExpect(status().isBadRequest());
        mvc.perform(get("/api/notices/{id}", UUID.randomUUID()).session(staff)).andExpect(status().isNotFound());
    }

    @Test
    void importantComesFirstAndTimestampThenIdProvideDeterministicOrdering() throws Exception {
        Notice later = notice("최신 일반 공지", webStaff, false);
        java.sql.Timestamp old = java.sql.Timestamp.from(Instant.now().minusSeconds(86400));
        java.sql.Timestamp recent = java.sql.Timestamp.from(Instant.now().minusSeconds(60));
        jdbc.update("UPDATE notices SET created_at = ? WHERE id = ?", old, global.getId());
        jdbc.update("UPDATE notices SET created_at = ? WHERE id = ?", old, own.getId());
        jdbc.update("UPDATE notices SET created_at = ? WHERE id = ?", recent, later.getId());
        var result = mvc.perform(get("/api/notices").session(login(webMember))).andExpect(status().isOk()).andReturn();
        List<String> ids = new ArrayList<>();
        for (var item : JSON.readTree(result.getResponse().getContentAsByteArray())) ids.add(item.get("id").asString());
        assertThat(ids.indexOf(global.getId().toString())).isLessThan(ids.indexOf(later.getId().toString()));
        assertThat(ids.indexOf(later.getId().toString())).isLessThan(ids.indexOf(own.getId().toString()));
        jdbc.update("UPDATE notices SET created_at = ? WHERE id = ?", old, later.getId());
        var tied = mvc.perform(get("/api/notices").session(login(webMember))).andExpect(status().isOk()).andReturn();
        List<String> tiedIds = new ArrayList<>();
        for (var item : JSON.readTree(tied.getResponse().getContentAsByteArray())) tiedIds.add(item.get("id").asString());
        List<String> expected = List.of(own.getId().toString(), later.getId().toString()).stream().sorted().toList();
        assertThat(tiedIds.indexOf(expected.get(0))).isLessThan(tiedIds.indexOf(expected.get(1)));
    }

    private Notice notice(String title, UserAccount staff, boolean important) {
        Notice notice = notices.saveAndFlush(new Notice(new NoticeRequest(title, "첫 문단\n\n두 번째 문단", "운영 안내", important), staff));
        noticeIds.add(notice.getId());
        return notice;
    }
    private Map<String, Object> payload(String title) {
        return Map.of("title", title, "body", "첫 문단\n\n두 번째 문단", "category", "운영 안내", "important", false);
    }
    private UserAccount account(String name, Role role, Track track, String hash) {
        UserAccount user = users.saveAndFlush(new UserAccount(String.valueOf(ThreadLocalRandom.current().nextLong(100000000000L, 999999999999L)), hash, name, role, track));
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
}
