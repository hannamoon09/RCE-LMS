package com.rce.lms.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ProfileRequest(@NotBlank @Size(max = 100) String name,
                             @Email @Size(max = 254) String email) {
    public ProfileRequest {
        if (email != null) email = email.isBlank() ? null : email.strip();
    }
}
