package com.rce.lms.auth;

import com.rce.lms.user.UserRepository;
import com.rce.lms.user.UserResponse;
import com.rce.lms.user.PasswordPolicy;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController {
    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository contexts;
    private final SessionAuthenticationStrategy loginSessionStrategy;
    private final UserRepository users;
    private final CurrentUser currentUser;

    AuthController(AuthenticationManager authenticationManager, SecurityContextRepository contexts,
            SessionAuthenticationStrategy loginSessionStrategy, UserRepository users, CurrentUser currentUser) {
        this.authenticationManager = authenticationManager;
        this.contexts = contexts;
        this.loginSessionStrategy = loginSessionStrategy;
        this.users = users;
        this.currentUser = currentUser;
    }

    public record LoginRequest(@NotBlank @Pattern(regexp = "[0-9]{4,32}") String studentId,
                               @NotBlank @Size(max = 128) String password) {}
    public record CsrfResponse(String headerName, String parameterName, String token) {}

    @GetMapping("/api/csrf")
    CsrfResponse csrf(CsrfToken token) {
        // getToken resolves deferred loading. JS sends the RAW XSRF-TOKEN cookie in the header.
        return new CsrfResponse(token.getHeaderName(), token.getParameterName(), token.getToken());
    }

    @PostMapping("/api/auth/login")
    UserResponse login(@Valid @RequestBody LoginRequest body, HttpServletRequest request, HttpServletResponse response) {
        if (PasswordPolicy.exceedsMaximumBytes(body.password())) throw new BadCredentialsException("Invalid credentials");
        var authentication = authenticationManager.authenticate(
            UsernamePasswordAuthenticationToken.unauthenticated(body.studentId(), body.password()));
        loginSessionStrategy.onAuthentication(authentication, request, response);
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context, request, response);
        var principal = (LmsPrincipal) authentication.getPrincipal();
        return UserResponse.from(users.findById(principal.id()).orElseThrow());
    }

    @GetMapping("/api/auth/me")
    UserResponse me(HttpServletRequest request) {
        return UserResponse.from(currentUser.require(request));
    }
}
