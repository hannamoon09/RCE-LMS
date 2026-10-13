package com.rce.lms.user;

import com.rce.lms.auth.CurrentUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/me/preferences")
public class PreferencesController {
    private final CurrentUser currentUser;
    private final PreferencesService preferences;

    public PreferencesController(CurrentUser currentUser, PreferencesService preferences) {
        this.currentUser = currentUser;
        this.preferences = preferences;
    }

    @GetMapping
    public PreferencesResponse get(HttpServletRequest request) { return preferences.get(currentUser.require(request)); }

    @PatchMapping
    public PreferencesResponse update(@Valid @RequestBody PreferencesRequest input, HttpServletRequest request) {
        return preferences.update(input, currentUser.require(request));
    }
}
