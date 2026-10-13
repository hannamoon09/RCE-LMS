package com.rce.lms;

import static org.assertj.core.api.Assertions.*;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.rce.lms.assignment.*;
import com.rce.lms.file.*;
import com.rce.lms.submission.*;
import com.rce.lms.user.*;
import jakarta.servlet.http.Cookie;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
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
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminReviewIntegrationTest {
    private static final String PASSWORD = "Review-test-only-54!";
    private static final JsonMapper JSON = JsonMapper.builder().build();
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired AssignmentRepository assignments;
    @Autowired SubmissionRepository submissions;
    @Autowired SubmissionService submitService;
    @Autowired AdminReviewService reviews;
    @Autowired PasswordEncoder passwords;
    @Autowired TransactionTemplate transactions;
    @Autowired JdbcTemplate jdbc;
    @Autowired FileStorage storage;
    final List<UserAccount> accounts = new ArrayList<>();
    final List<UUID> assignmentIds = new ArrayList<>();
    final List<String> storageKeys = new ArrayList<>();
    UserAccount staff, secondStaff, member, foreignStaff, foreignMember;
    Assignment assignment, secondAssignment, foreignAssignment;
    Submission submission, secondSubmission, foreignSubmission;

    @BeforeEach
    void fixture() {
        String hash = passwords.encode(PASSWORD);
        staff = account(Role.STAFF, Track.WEB, hash);
        secondStaff = account(Role.STAFF, Track.WEB, hash);
        member = account(Role.MEMBER, Track.WEB, hash);
        foreignStaff = account(Role.STAFF, Track.PWN, hash);
        foreignMember = account(Role.MEMBER, Track.PWN, hash);
        assignment = assignment(staff);
        secondAssignment = assignment(staff);
        foreignAssignment = assignment(foreignStaff);
        submission = submissions.saveAndFlush(new Submission(assignment, member, "원본 보고서"));
        secondSubmission = submissions.saveAndFlush(new Submission(secondAssignment, member, "두 번째 보고서"));
        foreignSubmission = submissions.saveAndFlush(new Submission(foreignAssignment, foreignMember, "다른 분야 보고서"));
    }

    @AfterEach
    void cleanup() throws Exception {
        for (UUID id : assignmentIds) {
            jdbc.update("DELETE FROM submission_files WHERE submission_id IN (SELECT id FROM submissions WHERE assignment_id = ?)", id);
            jdbc.update("DELETE FROM submissions WHERE assignment_id = ?", id);
        }
        assignments.deleteAllById(assignmentIds);
        users.deleteAll(accounts);
        for (String key : storageKeys) storage.delete(key);
    }

    @Test
    void listIsTrackScopedAndSupportsAssignmentAndReviewStatusFilters() throws Exception {
        reviews.review(secondSubmission.getId(), new ReviewRequest(BigDecimal.valueOf(90), "검토 완료"), staff);
        MockHttpSession session = login(staff);
        mvc.perform(get("/api/admin/submissions").session(session).queryParam("track", "PWN"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[*].id", hasItems(submission.getId().toString(), secondSubmission.getId().toString())))
            .andExpect(jsonPath("$[*].id", not(hasItem(foreignSubmission.getId().toString()))));
        mvc.perform(get("/api/admin/submissions").session(session).queryParam("assignmentId", assignment.getId().toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].id").value(submission.getId().toString()));
        mvc.perform(get("/api/admin/submissions").session(session).queryParam("status", "REVIEWED"))
            .andExpect(status().isOk()).andExpect(jsonPath("$[*].id", hasItem(secondSubmission.getId().toString())))
            .andExpect(jsonPath("$[*].id", not(hasItem(submission.getId().toString()))));
        mvc.perform(get("/api/admin/submissions").session(session).queryParam("status", "PENDING")
                .queryParam("assignmentId", secondAssignment.getId().toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(get("/api/admin/submissions").session(session).queryParam("assignmentId", foreignAssignment.getId().toString()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("ASSIGNMENT_NOT_FOUND"));
        mvc.perform(get("/api/admin/submissions").session(session).queryParam("status", "IMPROVEMENT_REQUESTED"))
            .andExpect(status().isBadRequest());
        mvc.perform(get("/api/admin/submissions").session(session).queryParam("assignmentId", "invalid"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void reviewAndRereviewUseServerReviewerPreserveContentFilesAndReachMember() throws Exception {
        var stored = storage.save(new ValidatedFile("보고서.txt", "text/plain", "실제 파일".getBytes(StandardCharsets.UTF_8)));
        storageKeys.add(stored.storageKey());
        UUID fileId = transactions.execute(status -> {
            var target = submissions.findById(submission.getId()).orElseThrow();
            var file = new SubmissionFile(target, stored);
            target.getFiles().add(file);
            return file.getId();
        });
        Instant submittedAt = submissions.findById(submission.getId()).orElseThrow().getSubmittedAt();
        write(patch(reviewUrl()), login(staff), Map.of("score", 0, "feedback", "  검토 피드백  "))
            .andExpect(status().isOk()).andExpect(jsonPath("$.score").value(0))
            .andExpect(jsonPath("$.status").value("REVIEWED")).andExpect(jsonPath("$.feedback").value("검토 피드백"))
            .andExpect(jsonPath("$.reviewedBy").value(staff.getId().toString())).andExpect(jsonPath("$.reviewedAt").isNotEmpty())
            .andExpect(jsonPath("$.content").value("원본 보고서")).andExpect(jsonPath("$.files[0].id").value(fileId.toString()));
        write(patch(reviewUrl()), login(secondStaff), Map.of("score", 100))
            .andExpect(status().isOk()).andExpect(jsonPath("$.score").value(100))
            .andExpect(jsonPath("$.feedback").value(nullValue()))
            .andExpect(jsonPath("$.reviewedBy").value(secondStaff.getId().toString()));
        assertThat(submissions.findById(submission.getId()).orElseThrow().getSubmittedAt()).isEqualTo(submittedAt);
        mvc.perform(get("/api/assignments/{id}/submission", assignment.getId()).session(login(member)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.score").value(100))
            .andExpect(jsonPath("$.files[0].id").value(fileId.toString()));
        assertThat(storage.load(stored.storageKey()).exists()).isTrue();
    }

    @Test
    void rejectsFractionalOutOfRangeMissingScoresLongFeedbackAndForgedFields() throws Exception {
        MockHttpSession session = login(staff);
        for (Object input : List.of(Map.of("score", -1), Map.of("score", 101), Map.of("score", 92.5),
                Map.of("feedback", "점수 없음"), Map.of("score", 50, "feedback", "x".repeat(20001)))) {
            write(patch(reviewUrl()), session, input).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        }
        for (String field : List.of("status", "userId", "assignmentId", "reviewedBy", "reviewedAt", "content", "files")) {
            write(patch(reviewUrl()), session, Map.of("score", 90, field, member.getId().toString()))
                .andExpect(status().isBadRequest());
        }
        assertThat(submissions.findById(submission.getId()).orElseThrow().getStatus()).isEqualTo(SubmissionStatus.PENDING);
    }

    @Test
    void memberForeignTrackMissingIdsAndMissingCsrfCannotReview() throws Exception {
        mvc.perform(get("/api/admin/submissions")).andExpect(status().isUnauthorized());
        MockHttpSession student = login(member);
        mvc.perform(get("/api/admin/submissions").session(student)).andExpect(status().isForbidden());
        write(patch(reviewUrl()), student, Map.of("score", 90)).andExpect(status().isForbidden());
        write(patch(reviewUrl()), login(foreignStaff), Map.of("score", 90))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("SUBMISSION_NOT_FOUND"));
        MockHttpSession session = login(staff);
        write(patch("/api/admin/submissions/{id}/review", UUID.randomUUID()), session, Map.of("score", 90))
            .andExpect(status().isNotFound());
        mvc.perform(patch(reviewUrl()).session(session).contentType(MediaType.APPLICATION_JSON).content("{\"score\":90}"))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        assertThat(submissions.findById(submission.getId()).orElseThrow().getScore()).isNull();
    }

    @Test
    void resubmittingAnApiReviewedSubmissionClearsReviewAndFiltersUpdate() throws Exception {
        MockHttpSession admin = login(staff);
        write(patch(reviewUrl()), admin, Map.of("score", 95, "feedback", "첫 검토")).andExpect(status().isOk());
        write(post("/api/assignments/{id}/submission", assignment.getId()), login(member), Map.of("content", "재제출 보고서"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(submission.getId().toString()))
            .andExpect(jsonPath("$.status").value("PENDING")).andExpect(jsonPath("$.score").value(nullValue()))
            .andExpect(jsonPath("$.feedback").value(nullValue())).andExpect(jsonPath("$.reviewedBy").value(nullValue()))
            .andExpect(jsonPath("$.reviewedAt").value(nullValue()));
        mvc.perform(get("/api/admin/submissions").session(admin).queryParam("status", "REVIEWED")
                .queryParam("assignmentId", assignment.getId().toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void reviewWaitsForAssignmentLockAndLoadsLatestResubmittedContentAfterLock() throws Exception {
        try (ExecutorService executor = Executors.newSingleThreadExecutor()) {
            Future<SubmissionResponse> review = transactions.execute(status -> {
                assignments.findByIdForUpdate(assignment.getId()).orElseThrow();
                Future<SubmissionResponse> waiting = executor.submit(() ->
                    reviews.review(submission.getId(), new ReviewRequest(BigDecimal.valueOf(88), "최신 제출 평가"), staff));
                awaitReviewLockWait();
                assertThat(waiting.isDone()).isFalse();
                submitService.submit(assignment.getId(), new SubmissionRequest("잠금 안에서 갱신한 최신 보고서"), member);
                return waiting;
            });
            SubmissionResponse saved = review.get(10, TimeUnit.SECONDS);
            assertThat(saved.content()).isEqualTo("잠금 안에서 갱신한 최신 보고서");
            assertThat(saved.score()).isEqualTo(88);
            assertThat(submissions.findById(submission.getId()).orElseThrow().getContent()).isEqualTo(saved.content());
        }
    }

    private void awaitReviewLockWait() {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        do {
            // PostgreSQL caches statistics within this holding transaction.
            jdbc.execute("SELECT pg_stat_clear_snapshot()");
            Boolean blocked = jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database() "
                + "AND wait_event_type = 'Lock' AND query LIKE '%assignments%' AND pid <> pg_backend_pid())", Boolean.class);
            if (Boolean.TRUE.equals(blocked)) return;
            try { Thread.sleep(20); }
            catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); throw new AssertionError(interrupted); }
        } while (System.nanoTime() < deadline);
        throw new AssertionError("Review did not wait for the PostgreSQL assignment lock");
    }

    private String reviewUrl() { return "/api/admin/submissions/" + submission.getId() + "/review"; }
    private Assignment assignment(UserAccount author) {
        var value = assignments.saveAndFlush(new Assignment(new AssignmentRequest("검토 과제", "과제 설명", "Low", Instant.now().plusSeconds(86400)), author));
        assignmentIds.add(value.getId());
        return value;
    }
    private UserAccount account(Role role, Track track, String hash) {
        UserAccount value = users.saveAndFlush(new UserAccount(String.valueOf(ThreadLocalRandom.current().nextLong(100000000000L, 999999999999L)), hash, "검토 테스트", role, track));
        accounts.add(value);
        return value;
    }
    private ResultActions write(MockHttpServletRequestBuilder request, MockHttpSession session, Object body) throws Exception {
        Cookie token = csrf(session);
        return mvc.perform(request.session(session).cookie(token).header("X-XSRF-TOKEN", token.getValue())
            .contentType(MediaType.APPLICATION_JSON).content(JSON.writeValueAsBytes(body)));
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
