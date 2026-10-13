package com.rce.lms.assignment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;

/** A complete editor save; identity, author, and target track are server-owned. */
public record AssignmentRequest(
    @NotBlank @Size(max = 120) String title,
    @NotBlank @Size(max = 20000) String description,
    @NotBlank @Pattern(regexp = "Low|Medium|High") String difficulty,
    @NotNull Instant deadline
) {}
