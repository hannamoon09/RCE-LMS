package com.rce.lms.auth;

import com.rce.lms.common.ApiException;
import com.rce.lms.user.UserAccount;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** The active-user filter loads this once per request, before authorization. */
@Component
public class CurrentUser {
    static final String ATTRIBUTE = CurrentUser.class.getName();
    public UserAccount require(HttpServletRequest request) {
        if (request.getAttribute(ATTRIBUTE) instanceof UserAccount user) return user;
        throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "로그인이 필요합니다.");
    }
}
