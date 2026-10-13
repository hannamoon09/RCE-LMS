package com.rce.lms.auth;

import com.rce.lms.user.UserAccount;
import com.rce.lms.user.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.web.filter.OncePerRequestFilter;

final class ActiveUserFilter extends OncePerRequestFilter {
    private final UserRepository users;
    private final SecurityErrors errors;
    private final SecurityContextLogoutHandler logout = new SecurityContextLogoutHandler();
    private final CookieCsrfTokenRepository csrf;

    ActiveUserFilter(UserRepository users, SecurityErrors errors, SecurityContextRepository contexts,
                     CookieCsrfTokenRepository csrf) {
        this.users = users;
        this.errors = errors;
        this.csrf = csrf;
        logout.setSecurityContextRepository(contexts);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof LmsPrincipal principal) {
            UserAccount user = users.findById(principal.id()).orElse(null);
            if (user == null || !user.isActive() || user.getCredentialVersion() != principal.credentialVersion()) {
                logout.logout(request, response, authentication);
                csrf.saveToken(null, request, response);
                errors.write(response, 401, "SESSION_INVALID", "계정이 비활성화되었거나 세션이 만료되었습니다.");
                return;
            }
            request.setAttribute(CurrentUser.ATTRIBUTE, user);
            // Authorization uses current database roles, never stale session authorities.
            LmsPrincipal refreshed = new LmsPrincipal(user);
            refreshed.eraseCredentials();
            var refreshedAuthentication = UsernamePasswordAuthenticationToken.authenticated(
                refreshed, null, refreshed.getAuthorities());
            var context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(refreshedAuthentication);
            SecurityContextHolder.setContext(context);
        }
        chain.doFilter(request, response);
    }
}
