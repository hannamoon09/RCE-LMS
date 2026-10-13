package com.rce.lms;

import static org.assertj.core.api.Assertions.*;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.rce.lms.assignment.*;
import com.rce.lms.submission.*;
import com.rce.lms.user.*;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SubmissionIntegrationTest {
    private static final String PASSWORD = "Submission-test-only-54!";
    private static final JsonMapper JSON = JsonMapper.builder().build();
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired AssignmentRepository assignments;
    @Autowired SubmissionRepository submissions;
    @Autowired SubmissionService service;
    @Autowired PasswordEncoder passwords;
    @Autowired JdbcTemplate jdbc;
    @Autowired TransactionTemplate transactions;
    final List<UserAccount> accounts = new ArrayList<>();
    final List<UUID> assignmentIds = new ArrayList<>();
    UserAccount staff;
    UserAccount member;
    UserAccount peer;
    UserAccount otherTrack;
    Assignment assignment;

    @BeforeEach
    void fixture() {
        String hash = passwords.encode(PASSWORD);
        staff = account(Role.STAFF, Track.WEB, hash);
        member = account(Role.MEMBER, Track.WEB, hash);
        peer = account(Role.MEMBER, Track.WEB, hash);
        otherTrack = account(Role.MEMBER, Track.PWN, hash);
        assignment = assignments.saveAndFlush(new Assignment(new AssignmentRequest("제출 테스트", "실습 보고서", "Low",
            Instant.now().plusSeconds(86400)), staff));
        assignmentIds.add(assignment.getId());
    }

    @AfterEach
    void cleanup() {
        for (UUID assignmentId : assignmentIds) jdbc.update("DELETE FROM submissions WHERE assignment_id = ?", assignmentId);
        assignments.deleteAllById(assignmentIds);
        users.deleteAll(accounts);
    }

    @Test
    void textSubmissionPersistsAndEveryReadIsOwnedByAuthenticatedMember() throws Exception {
        MockHttpSession session = login(member);
        mvc.perform(get("/api/assignments/{id}/submission", assignment.getId()).session(session))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("SUBMISSION_NOT_FOUND"));
        UUID id = submit(session, " 분석 결과를 정리했습니다. ");
        mvc.perform(get("/api/assignments/{id}/submission", assignment.getId()).session(session))
            .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id.toString()))
            .andExpect(jsonPath("$.userId").value(member.getId().toString()))
            .andExpect(jsonPath("$.assignmentId").value(assignment.getId().toString()))
            .andExpect(jsonPath("$.content").value("분석 결과를 정리했습니다."))
            .andExpect(jsonPath("$.status").value("PENDING"))
            .andExpect(jsonPath("$.score").value(nullValue())).andExpect(jsonPath("$.feedback").value(nullValue()))
            .andExpect(jsonPath("$.reviewedAt").value(nullValue())).andExpect(jsonPath("$.reviewedBy").value(nullValue()))
            .andExpect(jsonPath("$.files", hasSize(0)));
        mvc.perform(get("/api/submissions/me").session(session).queryParam("userId", peer.getId().toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].id").value(id.toString()));
        MockHttpSession peerSession = login(peer);
        mvc.perform(get("/api/submissions/me").session(peerSession)).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(get("/api/assignments/{id}/submission", assignment.getId()).session(peerSession)
                .queryParam("userId", member.getId().toString()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("SUBMISSION_NOT_FOUND"));
    }

    @Test
    void resubmissionReusesIdAndResetsEveryReviewFieldAndTimestamp() throws Exception {
        MockHttpSession session = login(member);
        UUID id = submit(session, "첫 번째 제출");
        transactions.executeWithoutResult(status -> {
            var stored = submissions.findById(id).orElseThrow();
            stored.review(92, "기존 피드백", staff);
        });
        jdbc.update("UPDATE submissions SET submitted_at = ? WHERE id = ?", java.sql.Timestamp.from(Instant.now().minusSeconds(3600)), id);
        mvc.perform(get("/api/assignments/{id}/submission", assignment.getId()).session(session))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REVIEWED"))
            .andExpect(jsonPath("$.score").value(92)).andExpect(jsonPath("$.reviewedBy").value(staff.getId().toString()));
        Instant before = Instant.now();
        assertThat(submit(session, "두 번째 제출")).isEqualTo(id);
        Submission stored = submissions.findById(id).orElseThrow();
        assertThat(stored.getContent()).isEqualTo("두 번째 제출");
        assertThat(stored.getStatus()).isEqualTo(SubmissionStatus.PENDING);
        assertThat(stored.getScore()).isNull();
        assertThat(stored.getFeedback()).isNull();
        assertThat(stored.getReviewedAt()).isNull();
        assertThat(stored.getReviewedBy()).isNull();
        assertThat(stored.getSubmittedAt()).isAfterOrEqualTo(before);
        assertThat(submissions.countByUserIdAndAssignmentId(member.getId(), assignment.getId())).isEqualTo(1);
    }

    @Test
    void optionalContentStillRequiresTextUntilFilePhaseAndRejectsForgedIdentityOrReviewFields() throws Exception {
        MockHttpSession session = login(member);
        for (String input : List.of("{}", "{\"content\":null}", "{\"content\":\"  \"}")) {
            write(post("/api/assignments/{id}/submission", assignment.getId()), session, input)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("EMPTY_SUBMISSION"));
        }
        write(post("/api/assignments/{id}/submission", assignment.getId()), session, payload("x".repeat(20001)))
            .andExpect(status().isBadRequest());
        for (String field : List.of("userId", "assignmentId", "status", "score", "feedback", "reviewedBy")) {
            write(post("/api/assignments/{id}/submission", assignment.getId()), session,
                    JSON.writeValueAsString(Map.of("content", "분석", field, member.getId().toString())))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        }
        assertThat(submissions.countByUserIdAndAssignmentId(member.getId(), assignment.getId())).isZero();
    }

    @Test
    void otherTrackIdsAndStaffLearnerEndpointsAreDenied() throws Exception {
        MockHttpSession foreign = login(otherTrack);
        mvc.perform(get("/api/assignments/{id}/submission", assignment.getId()).session(foreign))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("ASSIGNMENT_NOT_FOUND"));
        write(post("/api/assignments/{id}/submission", assignment.getId()), foreign, payload("다른 분야 제출"))
            .andExpect(status().isNotFound());
        MockHttpSession staffSession = login(staff);
        mvc.perform(get("/api/submissions/me").session(staffSession)).andExpect(status().isForbidden());
        mvc.perform(get("/api/assignments/{id}/submission", assignment.getId()).session(staffSession)).andExpect(status().isForbidden());
        write(post("/api/assignments/{id}/submission", assignment.getId()), staffSession, payload("운영진 제출"))
            .andExpect(status().isForbidden());
    }

    @Test
    void expiredDeadlineRejectsResubmissionWithoutChangingStoredWork() throws Exception {
        MockHttpSession session = login(member);
        UUID id = submit(session, "마감 전 원본");
        jdbc.update("UPDATE assignments SET deadline = ? WHERE id = ?", java.sql.Timestamp.from(Instant.now().minusSeconds(1)), assignment.getId());
        write(post("/api/assignments/{id}/submission", assignment.getId()), session, payload("마감 후 변경"))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ASSIGNMENT_CLOSED"));
        assertThat(submissions.findById(id).orElseThrow().getContent()).isEqualTo("마감 전 원본");
        write(post("/api/assignments/{id}/submission", assignment.getId()), login(peer), payload("늦은 신규 제출"))
            .andExpect(status().isConflict());
        mvc.perform(get("/api/assignments/{id}/submission", assignment.getId()).session(session)).andExpect(status().isOk());
    }

    @Test
    void submissionsProtectAssignmentDeletionAtApiAndForeignKeyLevels() throws Exception {
        UUID id = submit(login(member), "보존해야 할 보고서");
        write(delete("/api/admin/assignments/{id}", assignment.getId()), login(staff), null)
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ASSIGNMENT_HAS_SUBMISSIONS"));
        assertThatThrownBy(() -> jdbc.update("DELETE FROM assignments WHERE id = ?", assignment.getId()))
            .isInstanceOf(DataIntegrityViolationException.class);
        assertThat(assignments.existsById(assignment.getId())).isTrue();
        assertThat(submissions.existsById(id)).isTrue();
    }

    @Test
    void simultaneousSubmissionsSerializeAndKeepOneRecord() throws Exception {
        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<SubmissionResponse> first = executor.submit(() -> {
                start.await();
                return service.submit(assignment.getId(), new SubmissionRequest("동시 제출 A"), member);
            });
            Future<SubmissionResponse> second = executor.submit(() -> {
                start.await();
                return service.submit(assignment.getId(), new SubmissionRequest("동시 제출 B"), member);
            });
            start.countDown();
            assertThat(first.get(10, TimeUnit.SECONDS).id()).isEqualTo(second.get(10, TimeUnit.SECONDS).id());
            assertThat(submissions.countByUserIdAndAssignmentId(member.getId(), assignment.getId())).isEqualTo(1);
        }
    }

    @Test
    void authenticationCsrfAndCurrentActiveStatusApplyToSubmissionEndpoints() throws Exception {
        mvc.perform(get("/api/submissions/me")).andExpect(status().isUnauthorized());
        MockHttpSession session = login(member);
        mvc.perform(post("/api/assignments/{id}/submission", assignment.getId()).session(session)
                .contentType(MediaType.APPLICATION_JSON).content(payload("보안 토큰 없는 제출")))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        member.setActive(false);
        users.saveAndFlush(member);
        mvc.perform(get("/api/submissions/me").session(session))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("SESSION_INVALID"));
        assertThat(session.isInvalid()).isTrue();
    }

    private UserAccount account(Role role, Track track, String hash) {
        UserAccount user = users.saveAndFlush(new UserAccount(
            String.valueOf(ThreadLocalRandom.current().nextLong(100000000000L, 999999999999L)), hash, "제출 테스트", role, track));
        accounts.add(user);
        return user;
    }

    private UUID submit(MockHttpSession session, String content) throws Exception {
        var result = write(post("/api/assignments/{id}/submission", assignment.getId()), session, payload(content))
            .andExpect(status().isOk()).andReturn();
        return UUID.fromString(JSON.readTree(result.getResponse().getContentAsString()).get("id").asString());
    }

    private String payload(String content) { return JSON.writeValueAsString(Map.of("content", content)); }

    private ResultActions write(MockHttpServletRequestBuilder request, MockHttpSession session, String body) throws Exception {
        Cookie token = csrf(session);
        request.session(session).cookie(token).header("X-XSRF-TOKEN", token.getValue());
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).content(body);
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
                .contentType(MediaType.APPLICATION_JSON)
                .content(JSON.writeValueAsString(Map.of("studentId", user.getStudentId(), "password", PASSWORD))))
            .andExpect(status().isOk()).andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }
}
