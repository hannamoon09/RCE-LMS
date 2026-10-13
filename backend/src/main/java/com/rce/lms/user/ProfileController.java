package com.rce.lms.user;

import com.rce.lms.auth.CurrentUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.CookieClearingLogoutHandler;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/me")
public class ProfileController {
    private final CurrentUser currentUser;
    private final ProfileService profiles;
    private final SecurityContextLogoutHandler logout = new SecurityContextLogoutHandler();
    private final CookieClearingLogoutHandler cookies = new CookieClearingLogoutHandler("JSESSIONID");
    private final CookieCsrfTokenRepository csrf;

    public ProfileController(CurrentUser currentUser, ProfileService profiles, SecurityContextRepository contexts,
                             CookieCsrfTokenRepository csrf) {
        this.currentUser = currentUser;
        this.profiles = profiles;
        this.csrf = csrf;
        logout.setSecurityContextRepository(contexts);
    }

    @GetMapping
    public UserResponse me(HttpServletRequest request) {
        return UserResponse.from(currentUser.require(request));
    }

    @PatchMapping
    public UserResponse update(@Valid @RequestBody ProfileRequest input, HttpServletRequest request) {
        return profiles.update(input, currentUser.require(request));
    }

    @PostMapping(value = "/profile-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public UserResponse upload(@RequestPart("file") List<MultipartFile> files, HttpServletRequest request) {
        return profiles.upload(files, currentUser.require(request));
    }

    @DeleteMapping("/profile-image")
    public UserResponse removeImage(HttpServletRequest request) {
        return profiles.removeImage(currentUser.require(request));
    }

    @PatchMapping("/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void password(@Valid @RequestBody PasswordChangeRequest input, HttpServletRequest request,
                         HttpServletResponse response) {
        profiles.changePassword(input, currentUser.require(request));
        // The service transaction has committed before any session/cookie is cleared.
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        logout.logout(request, response, authentication);
        cookies.logout(request, response, authentication);
        csrf.saveToken(null, request, response);
    }
}
