package com.rce.lms.notice;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Track, author and identifiers are assigned by the server. */
public record NoticeRequest(
    @NotBlank @Size(max = 120) String title,
    @NotBlank @Size(max = 20000) String body,
    @NotBlank @Size(max = 50) String category,
    @NotNull Boolean important
) {}
