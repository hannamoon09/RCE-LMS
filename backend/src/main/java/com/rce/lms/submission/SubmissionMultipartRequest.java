package com.rce.lms.submission;

import jakarta.validation.constraints.*;
import java.util.List;
import java.util.UUID;

public record SubmissionMultipartRequest(@Size(max = 20000) String content,
        @Size(max = 5) List<@NotNull UUID> retainedFileIds) {
    public List<UUID> retained() { return retainedFileIds == null ? List.of() : retainedFileIds; }
}
