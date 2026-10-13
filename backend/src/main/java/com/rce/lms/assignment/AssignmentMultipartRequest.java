package com.rce.lms.assignment;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record AssignmentMultipartRequest(
    @NotBlank @Size(max = 120) String title,
    @NotBlank @Size(max = 20000) String description,
    @NotBlank @Pattern(regexp = "Low|Medium|High") String difficulty,
    @NotNull Instant deadline,
    @Size(max = 5) List<@NotNull UUID> retainedFileIds
) {
    public AssignmentRequest assignment() { return new AssignmentRequest(title, description, difficulty, deadline); }
    public List<UUID> retained() { return retainedFileIds == null ? List.of() : retainedFileIds; }
}
