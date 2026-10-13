package com.rce.lms.user;

import jakarta.validation.constraints.Size;

/** Null means unchanged; identity, role and track cannot be changed here. */
public record AdminUserPatchRequest(
    @Size(min = 1, max = 100) String name,
    Boolean active,
    @Size(min = 8, max = 72) String newPassword
) {}
