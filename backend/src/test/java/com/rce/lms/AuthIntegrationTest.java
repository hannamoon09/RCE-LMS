package com.rce.lms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.rce.lms.auth.LmsPrincipal;
import com.rce.lms.user.Role;
import com.rce.lms.user.Track;
import com.rce.lms.user.UserAccount;
import com.rce.lms.user.UserRepository;
import jakarta.servlet.http.Cookie;
import java.util.concurrent.ThreadLocalRandom;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthIntegrationTest {
    private static final String PASSWORD = "Integration-test-only-54!";
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    UserAccount user;

    @BeforeEach
    void createUser() {
        String studentId = String.valueOf(ThreadLocalRandom.current().nextLong(100000000000L, 999999999999L));
        user = users.saveAndFlush(new UserAccount(studentId, encoder.encode(PASSWORD), "테스트 학습자", Role.MEMBER, Track.WEB));
    }

    @AfterEach
    void removeUser() { users.deleteById(user.getId()); }

    @Test
    void csrfIsResolvedBeforeAuthenticationAndCookieHeaderFlowLogsIn() throws Exception {
        Cookie token = csrf(null);
        assertThat(token.getValue()).isNotBlank();
        assertThat(token.isHttpOnly()).isFalse();
        assertThat(token.getPath()).isEqualTo("/");
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        MvcResult login = login(token, PASSWORD);
        assertThat(login.getResponse().getCookie("XSRF-TOKEN").getMaxAge()).isZero();
        MockHttpSession session = session(login);
        assertThat(session).isNotNull();
        var context = (SecurityContext) session.getAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);
        assertThat(((LmsPrincipal) context.getAuthentication().getPrincipal()).getPassword()).isNull();
        mvc.perform(get("/api/auth/me").session(session))
            .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(user.getId().toString()))
            .andExpect(jsonPath("$.studentId").value(user.getStudentId()))
            .andExpect(jsonPath("$.role").value("MEMBER")).andExpect(jsonPath("$.track").value("WEB"))
            .andExpect(jsonPath("$.active").value(true)).andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    @Test
    void loginRotatesCsrfAndRejectsPreviousHeaderWithNewCookie() throws Exception {
        Cookie before = csrf(null);
        MockHttpSession session = session(login(before, PASSWORD));
        Cookie after = csrf(session);
        assertThat(after.getValue()).isNotEqualTo(before.getValue());
        mvc.perform(post("/api/auth/logout").session(session).cookie(after)
                .header("X-XSRF-TOKEN", before.getValue()))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk());
    }

    @Test
    void loginRequiresCsrfAndRejectsInvalidToken() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(credentials(PASSWORD)))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        Cookie token = csrf(null);
        mvc.perform(post("/api/auth/login").cookie(token).header("X-XSRF-TOKEN", "invalid-token")
                .contentType(MediaType.APPLICATION_JSON).content(credentials(PASSWORD)))
            .andExpect(status().isForbidden());
    }

    @Test
    void wrongPasswordAndInactiveAccountDoNotCreateSessions() throws Exception {
        Cookie token = csrf(null);
        MvcResult wrong = mvc.perform(post("/api/auth/login").cookie(token).header("X-XSRF-TOKEN", token.getValue())
                .contentType(MediaType.APPLICATION_JSON).content(credentials("wrong-password")))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS")).andReturn();
        assertThat(wrong.getRequest().getSession(false)).isNull();
        user.setActive(false);
        users.saveAndFlush(user);
        MvcResult inactive = mvc.perform(post("/api/auth/login").cookie(token).header("X-XSRF-TOKEN", token.getValue())
                .contentType(MediaType.APPLICATION_JSON).content(credentials(PASSWORD)))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS")).andReturn();
        assertThat(inactive.getRequest().getSession(false)).isNull();
        assertThat(inactive.getResponse().getContentAsString()).isEqualTo(wrong.getResponse().getContentAsString());
    }

    @Test
    void databaseDeactivationImmediatelyInvalidatesAnExistingSession() throws Exception {
        MockHttpSession session = session(login(csrf(null), PASSWORD));
        user.setActive(false);
        users.saveAndFlush(user);
        mvc.perform(get("/api/auth/me").session(session))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("SESSION_INVALID"));
        assertThat(session.isInvalid()).isTrue();
    }

    @Test
    void loginRejectsExtraBytesBeyondAValid72BytePasswordInsteadOfBcryptTruncation() throws Exception {
        for (String boundaryPassword : java.util.List.of("x".repeat(72), "가".repeat(24))) {
            user.setPasswordHash(encoder.encode(boundaryPassword));
            users.saveAndFlush(user);
            login(csrf(null), boundaryPassword);
            Cookie token = csrf(null);
            MvcResult rejected = mvc.perform(post("/api/auth/login").cookie(token).header("X-XSRF-TOKEN", token.getValue())
                    .contentType(MediaType.APPLICATION_JSON).content(credentials(boundaryPassword + "z")))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS")).andReturn();
            assertThat(rejected.getRequest().getSession(false)).isNull();
        }
    }

    @Test
    void logoutInvalidatesSessionAndAllowsFreshAnonymousCsrf() throws Exception {
        MockHttpSession session = session(login(csrf(null), PASSWORD));
        Cookie token = csrf(session);
        mvc.perform(post("/api/auth/logout").session(session).cookie(token))
            .andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/logout").session(session).cookie(token).header("X-XSRF-TOKEN", token.getValue()))
            .andExpect(status().isNoContent()).andExpect(cookie().maxAge("JSESSIONID", 0))
            .andExpect(cookie().maxAge("XSRF-TOKEN", 0));
        assertThat(session.isInvalid()).isTrue();
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        assertThat(csrf(null).getValue()).isNotEqualTo(token.getValue());
    }

    @Test
    void memberCannotAccessAdminNamespace() throws Exception {
        MockHttpSession session = session(login(csrf(null), PASSWORD));
        mvc.perform(get("/api/admin/users").session(session))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    private Cookie csrf(MockHttpSession session) throws Exception {
        var request = get("/api/csrf");
        if (session != null) request.session(session);
        return mvc.perform(request).andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(jsonPath("$.token").isNotEmpty()).andExpect(jsonPath("$.headerName").value("X-XSRF-TOKEN"))
            .andReturn().getResponse().getCookie("XSRF-TOKEN");
    }

    private MvcResult login(Cookie token, String password) throws Exception {
        return mvc.perform(post("/api/auth/login").cookie(token).header("X-XSRF-TOKEN", token.getValue())
                .contentType(MediaType.APPLICATION_JSON).content(credentials(password)))
            .andExpect(status().isOk()).andReturn();
    }

    private MockHttpSession session(MvcResult result) {
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private String credentials(String password) {
        return "{\"studentId\":\"" + user.getStudentId() + "\",\"password\":\"" + password + "\"}";
    }
}
