package com.rce.lms.submission;

import jakarta.validation.constraints.Size;

/** Content is optional so file-only submissions can use the same contract in the file phase. */
public record SubmissionRequest(@Size(max = 20000) String content) {}
