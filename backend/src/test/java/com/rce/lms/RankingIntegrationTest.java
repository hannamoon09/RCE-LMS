package com.rce.lms;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.rce.lms.assignment.*;
import com.rce.lms.ranking.RankingResponse;
import com.rce.lms.ranking.RankingService;
import com.rce.lms.submission.*;
import com.rce.lms.user.*;
import jakarta.servlet.http.Cookie;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
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
class RankingIntegrationTest {
    private static final String PASSWORD = "Ranking-test-only-54!";
    private static final JsonMapper JSON = JsonMapper.builder().build();
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    @Autowired UserRepository users;
    @Autowired AssignmentRepository assignments;
    @Autowired SubmissionRepository submissions;
    @Autowired RankingService rankings;
    private final List<UserAccount> accounts = new ArrayList<>();
    private final List<Assignment> tasks = new ArrayList<>();
    private final List<Assignment> webTasks = new ArrayList<>();
    private String hash;
    private UserAccount staff;
    private UserAccount member;
    private UserAccount foreignStaff;
    private UserAccount foreignMember;
    private Assignment foreignTask;

    @BeforeEach
    void fixture() {
        hash = passwords.encode(PASSWORD);
        staff = account("운영진", Role.STAFF, Track.WEB);
        member = account("현재 학습자", Role.MEMBER, Track.WEB);
        foreignStaff = account("다른 분야 운영진", Role.STAFF, Track.PWN);
        foreignMember = account("다른 분야 학습자", Role.MEMBER, Track.PWN);
        for (int i = 0; i < 4; i++) webTasks.add(assignment(staff));
        foreignTask = assignment(foreignStaff);
    }

    @AfterEach
    void cleanup() {
        for (Assignment task : tasks) jdbc.update("DELETE FROM submissions WHERE assignment_id = ?", task.getId());
        assignments.deleteAll(tasks);
        users.deleteAll(accounts);
    }

    @Test
    void includesEveryActiveOwnTrackMemberAndCountsOnlyReviewedOwnTrackWork() {
        UserAccount zero = account("0점 채점 학생", Role.MEMBER, Track.WEB);
        UserAccount inactive = account("비활성 학생", Role.MEMBER, Track.WEB);
        inactive.setActive(false);
        users.saveAndFlush(inactive);
        submission(member, webTasks.getFirst(), null);
        submission(member, foreignTask, 100); // Defensive fixture: inconsistent cross-track data is ignored.
        submission(zero, webTasks.getFirst(), 0);
        submission(inactive, webTasks.getFirst(), 100);
        submission(staff, webTasks.getFirst(), 100);
        submission(foreignMember, webTasks.getFirst(), 100);
        List<RankingResponse> rows = rankings.member(member);
        assertThat(rows).extracting(RankingResponse::name).contains(member.getName(), zero.getName())
            .doesNotContain(inactive.getName(), staff.getName(), foreignMember.getName());
        RankingResponse current = rows.stream().filter(RankingResponse::isMe).findFirst().orElseThrow();
        assertThat(current.totalScore()).isZero();
        assertThat(current.averageScore()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(current.reviewedCount()).isZero();
        assertThat(current.rank()).isPositive();
        RankingResponse reviewedZero = byName(rows, zero.getName());
        assertThat(reviewedZero.totalScore()).isZero();
        assertThat(reviewedZero.averageScore()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(reviewedZero.reviewedCount()).isEqualTo(1);
        assertThat(reviewedZero.rank()).isLessThan(current.rank());
    }

    @Test
    void sortsByTotalThenUnroundedAverageThenReviewedCountThenNameWithSequentialRanks() {
        UserAccount totalWinner = account("Z total winner", Role.MEMBER, Track.WEB);
        UserAccount averageWinner = account("Z average winner", Role.MEMBER, Track.WEB);
        UserAccount lowerAverage = account("A lower average", Role.MEMBER, Track.WEB);
        UserAccount twoZeros = account("Z two zeros", Role.MEMBER, Track.WEB);
        UserAccount oneZero = account("A one zero", Role.MEMBER, Track.WEB);
        UserAccount alpha = account("A ungraded", Role.MEMBER, Track.WEB);
        UserAccount beta = account("B ungraded", Role.MEMBER, Track.WEB);
        scores(totalWinner, 2, 0, 0, 0);
        scores(averageWinner, 1, 0, 0); // 1/3 and 1/4 both display as 0.3 at one decimal.
        scores(lowerAverage, 1, 0, 0, 0);
        scores(twoZeros, 0, 0);
        scores(oneZero, 0);
        List<RankingResponse> rows = rankings.member(member);
        assertThat(byName(rows, totalWinner.getName()).rank()).isLessThan(byName(rows, averageWinner.getName()).rank());
        assertThat(byName(rows, averageWinner.getName()).rank()).isLessThan(byName(rows, lowerAverage.getName()).rank());
        assertThat(byName(rows, averageWinner.getName()).averageScore()).isGreaterThan(new BigDecimal("0.33333333333333"));
        assertThat(byName(rows, lowerAverage.getName()).averageScore()).isEqualByComparingTo("0.25");
        assertThat(byName(rows, twoZeros.getName()).rank()).isLessThan(byName(rows, oneZero.getName()).rank());
        assertThat(byName(rows, oneZero.getName()).rank()).isLessThan(byName(rows, alpha.getName()).rank());
        assertThat(byName(rows, alpha.getName()).rank()).isLessThan(byName(rows, beta.getName()).rank());
        for (int i = 0; i < rows.size(); i++) assertThat(rows.get(i).rank()).isEqualTo(i + 1);
        assertThat(byName(rows, totalWinner.getName()).totalScore()).isEqualTo(2);
        assertThat(byName(rows, totalWinner.getName()).reviewedCount()).isEqualTo(4);
    }

    @Test
    void identicalNamesAndStatisticsUsePrivateUuidInsteadOfStudentIdForTheFinalTie() throws Exception {
        String duplicateName = "동일 이름 순위 학생";
        UserAccount first = account(duplicateName, Role.MEMBER, Track.WEB);
        UserAccount second = account(duplicateName, Role.MEMBER, Track.WEB);
        UserAccount low = first.getId().toString().compareTo(second.getId().toString()) < 0 ? first : second;
        UserAccount high = low == first ? second : first;
        // Student IDs deliberately sort in the opposite order from UUIDs.
        jdbc.update("UPDATE users SET student_id = ? WHERE id = ?", "8" + low.getId().toString().replace("-", "").substring(0, 20).replaceAll("[a-f]", "9"), low.getId());
        jdbc.update("UPDATE users SET student_id = ? WHERE id = ?", "1" + high.getId().toString().replace("-", "").substring(0, 20).replaceAll("[a-f]", "0"), high.getId());
        long lowRank = rankings.member(low).stream().filter(RankingResponse::isMe).findFirst().orElseThrow().rank();
        long highRank = rankings.member(high).stream().filter(RankingResponse::isMe).findFirst().orElseThrow().rank();
        assertThat(lowRank).isLessThan(highRank);
        assertThat(highRank).isEqualTo(lowRank + 1);
        String response = mvc.perform(get("/api/rankings/me").session(login(member)))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(response).doesNotContain(low.getId().toString(), high.getId().toString());
    }

    @Test
    void apiExposesExactlyTheSixRankingFieldsAndServerScopeOverridesForgedQueries() throws Exception {
        scores(member, 85, 95);
        scores(foreignMember, 100);
        var response = mvc.perform(get("/api/rankings/me").session(login(member))
                .queryParam("track", "PWN").queryParam("userId", foreignMember.getId().toString()))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store")).andReturn();
        var rows = JSON.readTree(response.getResponse().getContentAsString());
        int meCount = 0;
        for (var row : rows) {
            assertThat(row.propertyNames()).containsExactlyInAnyOrder("rank", "name", "totalScore", "averageScore", "reviewedCount", "isMe");
            assertThat(row.get("name").asString()).isNotEqualTo(foreignMember.getName());
            if (row.get("isMe").asBoolean()) {
                meCount++;
                assertThat(row.get("name").asString()).isEqualTo(member.getName());
                assertThat(row.get("totalScore").asLong()).isEqualTo(180);
                assertThat(row.get("averageScore").asDecimal()).isEqualByComparingTo("90");
                assertThat(row.get("reviewedCount").asLong()).isEqualTo(2);
            }
        }
        assertThat(meCount).isEqualTo(1);
        String body = response.getResponse().getContentAsString();
        assertThat(body).doesNotContain(member.getId().toString(), member.getStudentId(), "password", "email", "track");
        var adminRows = JSON.readTree(mvc.perform(get("/api/admin/rankings").session(login(staff)).queryParam("track", "PWN"))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
            .andReturn().getResponse().getContentAsString());
        for (var row : adminRows) {
            assertThat(row.get("isMe").asBoolean()).isFalse();
            assertThat(row.get("name").asString()).isNotEqualTo(foreignMember.getName());
        }
    }

    @Test
    void roleAuthenticationAndCurrentActiveStateAreEnforced() throws Exception {
        mvc.perform(get("/api/rankings/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/rankings")).andExpect(status().isUnauthorized());
        MockHttpSession memberSession = login(member);
        mvc.perform(get("/api/admin/rankings").session(memberSession)).andExpect(status().isForbidden());
        mvc.perform(get("/api/rankings/me").session(login(staff))).andExpect(status().isForbidden());
        member.setActive(false);
        users.saveAndFlush(member);
        mvc.perform(get("/api/rankings/me").session(memberSession)).andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("SESSION_INVALID"));
        assertThat(memberSession.isInvalid()).isTrue();
    }

    @Test
    void emptyStaffTrackReturnsAnEmptyListAndAnUngradedMemberStillHasRankOne() throws Exception {
        UserAccount emptyStaff = account("빈 분야 운영진", Role.STAFF, Track.FORENSICS);
        mvc.perform(get("/api/admin/rankings").session(login(emptyStaff)))
            .andExpect(status().isOk()).andExpect(content().json("[]"));
        UserAccount loneMember = account("미채점 학생", Role.MEMBER, Track.FORENSICS);
        mvc.perform(get("/api/rankings/me").session(login(loneMember))).andExpect(status().isOk())
            .andExpect(jsonPath("$[0].rank").value(1)).andExpect(jsonPath("$[0].totalScore").value(0))
            .andExpect(jsonPath("$[0].averageScore").value(0)).andExpect(jsonPath("$[0].reviewedCount").value(0))
            .andExpect(jsonPath("$[0].isMe").value(true));
    }

    @Test
    void reviewResubmissionAndRereviewImmediatelyChangeDerivedRankingThroughTheRealApis() throws Exception {
        MockHttpSession memberSession = login(member), staffSession = login(staff);
        UUID assignmentId = webTasks.getFirst().getId();
        var first = write(post("/api/assignments/{id}/submission", assignmentId), memberSession, Map.of("content", "최초 제출"))
            .andExpect(status().isOk()).andReturn();
        UUID submissionId = UUID.fromString(JSON.readTree(first.getResponse().getContentAsString()).get("id").asString());
        write(patch("/api/admin/submissions/{id}/review", submissionId), staffSession, Map.of("score", 91, "feedback", "최초 채점"))
            .andExpect(status().isOk());
        assertMyStats(memberSession, 91, 91, 1);
        write(post("/api/assignments/{id}/submission", assignmentId), memberSession, Map.of("content", "재제출"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(submissionId.toString()));
        assertMyStats(memberSession, 0, 0, 0);
        write(patch("/api/admin/submissions/{id}/review", submissionId), staffSession, Map.of("score", 77))
            .andExpect(status().isOk());
        assertMyStats(memberSession, 77, 77, 1);
    }

    private void assertMyStats(MockHttpSession session, int total, int average, int count) throws Exception {
        var rows = JSON.readTree(mvc.perform(get("/api/rankings/me").session(session)).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());
        for (var row : rows) if (row.get("isMe").asBoolean()) {
            assertThat(row.get("totalScore").asLong()).isEqualTo(total);
            assertThat(row.get("averageScore").asDecimal()).isEqualByComparingTo(BigDecimal.valueOf(average));
            assertThat(row.get("reviewedCount").asLong()).isEqualTo(count);
            assertThat(row.get("rank").asLong()).isPositive();
            return;
        }
        fail("Ranking must include the authenticated active member");
    }

    private UserAccount account(String name, Role role, Track track) {
        UserAccount user = users.saveAndFlush(new UserAccount(String.valueOf(ThreadLocalRandom.current().nextLong(100000000000L, 999999999999L)),
            hash, name, role, track));
        accounts.add(user);
        return user;
    }

    private Assignment assignment(UserAccount author) {
        Assignment task = assignments.saveAndFlush(new Assignment(new AssignmentRequest("순위 검증 과제", "보고서", "Low",
            Instant.now().plusSeconds(86400)), author));
        tasks.add(task);
        return task;
    }

    private void scores(UserAccount user, int... values) {
        for (int i = 0; i < values.length; i++) submission(user, webTasks.get(i), values[i]);
    }

    private void submission(UserAccount user, Assignment task, Integer score) {
        Submission value = new Submission(task, user, "순위 검증 제출");
        if (score != null) value.review(score, null, staff);
        submissions.saveAndFlush(value);
    }

    private static RankingResponse byName(List<RankingResponse> rows, String name) {
        return rows.stream().filter(row -> row.name().equals(name)).findFirst().orElseThrow();
    }

    private ResultActions write(MockHttpServletRequestBuilder request, MockHttpSession session, Object body) throws Exception {
        Cookie token = csrf(session);
        return mvc.perform(request.session(session).cookie(token).header("X-XSRF-TOKEN", token.getValue())
            .contentType(MediaType.APPLICATION_JSON).content(JSON.writeValueAsString(body)));
    }

    private Cookie csrf(MockHttpSession session) throws Exception {
        var request = get("/api/csrf");
        if (session != null) request.session(session);
        return mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getCookie("XSRF-TOKEN");
    }

    private MockHttpSession login(UserAccount user) throws Exception {
        var result = write(post("/api/auth/login"), new MockHttpSession(),
                Map.of("studentId", user.getStudentId(), "password", PASSWORD)).andExpect(status().isOk()).andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }
}
