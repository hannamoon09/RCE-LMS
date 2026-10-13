package com.rce.lms.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Role and track always come from server policy and the authenticated staff account. */
public record AdminUserCreateRequest(
    @NotBlank @Size(max = 100) String name,
    @NotBlank @Pattern(regexp = "[0-9]{4,32}") String studentId,
    @NotBlank @Size(min = 8, max = 72) String initialPassword
) {}
