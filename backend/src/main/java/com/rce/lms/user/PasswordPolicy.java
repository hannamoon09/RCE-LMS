package com.rce.lms.user;

import com.rce.lms.common.ApiException;
import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpStatus;

/** Shared by staff-issued initial/reset passwords and the profile password editor. */
public final class PasswordPolicy {
    private PasswordPolicy() {}

    public static void validate(String password) {
        if (password == null || password.isBlank() || password.length() < 8
                || exceedsMaximumBytes(password)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST",
                "비밀번호는 8자 이상, UTF-8 기준 72바이트 이하로 입력해 주세요.");
        }
    }

    /** BCrypt verification otherwise ignores bytes after the first 72. */
    public static boolean exceedsMaximumBytes(String password) {
        return password.getBytes(StandardCharsets.UTF_8).length > 72;
    }
}
