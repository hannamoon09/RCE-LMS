package com.rce.lms;

import com.rce.lms.user.Role;
import com.rce.lms.user.Track;
import com.rce.lms.user.UserAccount;
import com.rce.lms.user.UserRepository;
import jakarta.servlet.http.Cookie;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SessionBoundaryIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwords;
    UserAccount member;

    @BeforeEach
    void account() {
        member = users.save(new UserAccount("990000000001", passwords.encode("Test-only-strong-password"),
            "세션 테스트", Role.MEMBER, Track.WEB));
    }

    @AfterEach
    void cleanup() { users.deleteById(member.getId()); }

    @Test
    void loginRotatesAnExistingSessionIdAndNeverExposesThePasswordHash() throws Exception {
        MockHttpSession before = new MockHttpSession();
        String oldId = before.getId();
        Cookie csrf = mvc.perform(get("/api/csrf").session(before))
            .andExpect(status().isOk())
            .andExpect(header().string("Cache-Control", containsString("no-store")))
            .andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertThat(csrf).isNotNull();
        var login = mvc.perform(post("/api/auth/login").session(before).cookie(csrf)
                .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"studentId\":\"990000000001\",\"password\":\"Test-only-strong-password\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.role").value("MEMBER"))
            .andExpect(jsonPath("$.passwordHash").doesNotExist())
            .andExpect(jsonPath("$.password").doesNotExist())
            .andReturn();
        MockHttpSession after = (MockHttpSession) login.getRequest().getSession(false);
        assertThat(after).isNotNull();
        assertThat(after.getId()).isNotEqualTo(oldId);
        mvc.perform(get("/api/auth/me").session(after))
            .andExpect(status().isOk())
            .andExpect(header().string("Cache-Control", containsString("no-store")))
            .andExpect(jsonPath("$.studentId").value("990000000001"));
    }

    @Test
    void clientCannotSupplyIdentityPrivilegesDuringLogin() throws Exception {
        Cookie csrf = mvc.perform(get("/api/csrf")).andReturn().getResponse().getCookie("XSRF-TOKEN");
        mvc.perform(post("/api/auth/login").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"studentId\":\"990000000001\",\"password\":\"Test-only-strong-password\",\"role\":\"STAFF\",\"track\":\"PWN\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }
}
