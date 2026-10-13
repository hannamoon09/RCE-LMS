package com.rce.lms.user;

import com.rce.lms.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class PreferencesService {
    private final UserRepository users;
    private final PreferencesRepository preferences;

    public PreferencesService(UserRepository users, PreferencesRepository preferences) {
        this.users = users;
        this.preferences = preferences;
    }

    public PreferencesResponse get(UserAccount actor) {
        return preferences.findById(actor.getId()).map(UserPreferences::response).orElseGet(PreferencesResponse::defaults);
    }

    @Transactional
    public PreferencesResponse update(PreferencesRequest input, UserAccount actor) {
        // Locking the parent also serializes concurrent first saves before a preferences row exists.
        UserAccount user = users.findByIdForUpdate(actor.getId()).orElseThrow(PreferencesService::staleSession);
        if (!user.isActive() || user.getCredentialVersion() != actor.getCredentialVersion()) throw staleSession();
        UserPreferences saved = preferences.findById(user.getId()).orElseGet(() -> new UserPreferences(user.getId()));
        saved.update(input);
        return preferences.save(saved).response();
    }

    private static ApiException staleSession() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "SESSION_INVALID", "세션이 만료되었습니다. 다시 로그인해 주세요.");
    }
}
