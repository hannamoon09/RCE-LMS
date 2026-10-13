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
class PreferencesIntegrationTest {
    private static final String PASSWORD = "Preferences-test-only-54!";
    private static final String URL = "/api/me/preferences";
    private static final JsonMapper JSON = JsonMapper.builder().build();
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired PreferencesRepository preferences;
    @Autowired PreferencesService service;
    @Autowired PasswordEncoder passwords;
    @Autowired JdbcTemplate jdbc;
    final List<UserAccount> accounts = new ArrayList<>();
    UserAccount member, peer, staff, foreignMember;
    MockHttpSession session;

    @BeforeEach
    void fixture() throws Exception {
        String hash = passwords.encode(PASSWORD);
        member = account(Role.MEMBER, Track.WEB, hash);
        peer = account(Role.MEMBER, Track.WEB, hash);
        staff = account(Role.STAFF, Track.WEB, hash);
        foreignMember = account(Role.MEMBER, Track.PWN, hash);
        session = login(member);
    }

    @AfterEach
    void cleanup() {
        preferences.deleteAllById(accounts.stream().map(UserAccount::getId).toList());
        users.deleteAll(accounts);
    }

    @Test
    void readReturnsOnlyFourDefaultsWithoutCreatingARow() throws Exception {
        String result = mvc.perform(get(URL).session(session)).andExpect(status().isOk())
            .andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(content().json(JSON.writeValueAsString(PreferencesResponse.defaults()))).andReturn().getResponse().getContentAsString();
        Set<String> fields = new HashSet<>();
        JSON.readTree(result).propertyNames().forEach(fields::add);
        assertThat(fields).containsExactlyInAnyOrder("assignment", "notice", "feedback", "email");
        assertThat(preferences.findById(member.getId())).isEmpty();
    }

    @Test
    void memberAndStaffPreferencesPersistAcrossSessionsAndCanBeReplaced() throws Exception {
        var first = new PreferencesRequest(false, true, false, true);
        var second = new PreferencesRequest(true, false, true, false);
        for (UserAccount user : List.of(member, staff)) {
            MockHttpSession ownerSession = login(user);
            write(patch(URL), ownerSession, first).andExpect(status().isOk())
                .andExpect(content().json(JSON.writeValueAsString(first)));
            mvc.perform(get(URL).session(login(user))).andExpect(status().isOk())
                .andExpect(content().json(JSON.writeValueAsString(first)));
            write(patch(URL), ownerSession, second).andExpect(status().isOk());
            assertThat(preferences.findById(user.getId()).orElseThrow().response())
                .isEqualTo(new PreferencesResponse(true, false, true, false));
            assertThat(jdbc.queryForObject("SELECT count(*) FROM user_preferences WHERE user_id = ?", Long.class, user.getId())).isEqualTo(1);
        }
    }

    @Test
    void preferencesBelongOnlyToTheAuthenticatedUserAcrossTracksAndRoles() throws Exception {
        write(patch(URL), session, new PreferencesRequest(false, false, false, true)).andExpect(status().isOk());
        for (UserAccount other : List.of(peer, staff, foreignMember)) {
            mvc.perform(get(URL).session(login(other)).queryParam("userId", member.getId().toString()).queryParam("track", "WEB"))
                .andExpect(status().isOk()).andExpect(content().json(JSON.writeValueAsString(PreferencesResponse.defaults())));
            assertThat(preferences.findById(other.getId())).isEmpty();
        }
        var input = new LinkedHashMap<String, Object>(Map.of("assignment", true, "notice", true, "feedback", true, "email", false));
        for (String field : List.of("userId", "id", "role", "track", "active")) {
            input.put(field, member.getId().toString());
            write(patch(URL), login(staff), input).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
            input.remove(field);
        }
        assertThat(preferences.findById(member.getId()).orElseThrow().response()).isEqualTo(new PreferencesResponse(false, false, false, true));
    }

    @Test
    void missingNullAndCoercedValuesAreRejectedWithoutPartiallyUpdatingSettings() throws Exception {
        var saved = new PreferencesRequest(false, true, false, true);
        write(patch(URL), session, saved).andExpect(status().isOk());
        Map<String, Object> valid = Map.of("assignment", true, "notice", false, "feedback", true, "email", false);
        for (String field : valid.keySet()) {
            var missing = new LinkedHashMap<>(valid);
            missing.remove(field);
            write(patch(URL), session, missing).andExpect(status().isBadRequest());
            var empty = new LinkedHashMap<>(valid);
            empty.put(field, null);
            write(patch(URL), session, empty).andExpect(status().isBadRequest());
            for (Object invalid : List.of("true", "false", 1, 0, List.of(true), Map.of("value", true))) {
                var malformed = new LinkedHashMap<>(valid);
                malformed.put(field, invalid);
                write(patch(URL), session, malformed).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
            }
        }
        write(patch(URL), session, Map.of()).andExpect(status().isBadRequest());
        assertThat(preferences.findById(member.getId()).orElseThrow().response()).isEqualTo(new PreferencesResponse(false, true, false, true));
    }

    @Test
    void authenticationCsrfAndCredentialRevocationApplyToPreferences() throws Exception {
        mvc.perform(get(URL)).andExpect(status().isUnauthorized());
        write(patch(URL), new MockHttpSession(), PreferencesResponse.defaults()).andExpect(status().isUnauthorized());
        mvc.perform(patch(URL).session(session).contentType(MediaType.APPLICATION_JSON).content(JSON.writeValueAsString(PreferencesResponse.defaults())))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        jdbc.update("UPDATE users SET credential_version = credential_version + 1 WHERE id = ?", member.getId());
        mvc.perform(patch(URL).session(session).contentType(MediaType.APPLICATION_JSON).content(JSON.writeValueAsString(PreferencesResponse.defaults())))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("SESSION_INVALID"));
        assertThat(session.isInvalid()).isTrue();
        assertThat(preferences.findById(member.getId())).isEmpty();
    }

    @Test
    void concurrentFirstSavesCreateOneRowAndEachRequestCommitsAllFourValues() throws Exception {
        var first = new PreferencesRequest(true, false, true, false);
        var second = new PreferencesRequest(false, true, false, true);
        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService pool = Executors.newFixedThreadPool(2)) {
            Future<PreferencesResponse> one = pool.submit(() -> { start.await(); return service.update(first, member); });
            Future<PreferencesResponse> two = pool.submit(() -> { start.await(); return service.update(second, member); });
            start.countDown();
            assertThat(one.get(15, TimeUnit.SECONDS)).isEqualTo(new PreferencesResponse(true, false, true, false));
            assertThat(two.get(15, TimeUnit.SECONDS)).isEqualTo(new PreferencesResponse(false, true, false, true));
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM user_preferences WHERE user_id = ?", Long.class, member.getId())).isEqualTo(1);
        assertThat(preferences.findById(member.getId()).orElseThrow().response())
            .isIn(new PreferencesResponse(true, false, true, false), new PreferencesResponse(false, true, false, true));
    }

    @Test
    void writeRechecksActiveStatusAndCredentialVersionUnderTheUserLock() {
        var input = new PreferencesRequest(false, false, false, false);
        jdbc.update("UPDATE users SET active = false WHERE id = ?", member.getId());
        assertThatThrownBy(() -> service.update(input, member)).isInstanceOfSatisfying(ApiException.class,
            error -> assertThat(error.getCode()).isEqualTo("SESSION_INVALID"));
        jdbc.update("UPDATE users SET active = true, credential_version = 1 WHERE id = ?", member.getId());
        assertThatThrownBy(() -> service.update(input, member)).isInstanceOfSatisfying(ApiException.class,
            error -> assertThat(error.getCode()).isEqualTo("SESSION_INVALID"));
        assertThat(preferences.findById(member.getId())).isEmpty();
    }

    private UserAccount account(Role role, Track track, String hash) {
        var user = users.saveAndFlush(new UserAccount(String.valueOf(ThreadLocalRandom.current().nextLong(100000000000L, 999999999999L)), hash, "알림 설정 테스트", role, track));
        accounts.add(user);
        return user;
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
