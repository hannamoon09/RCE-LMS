package com.rce.lms.submission;

import com.rce.lms.file.FileResponse;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record SubmissionResponse(UUID id, UUID assignmentId, UUID userId, String content,
        SubmissionStatus status, Integer score, String feedback, Instant submittedAt,
        Instant reviewedAt, UUID reviewedBy, List<FileResponse> files) {
    public static SubmissionResponse from(Submission submission) {
        return new SubmissionResponse(submission.getId(), submission.getAssignment().getId(),
            submission.getUser().getId(), submission.getContent(), submission.getStatus(),
            submission.getScore(), submission.getFeedback(), submission.getSubmittedAt(),
            submission.getReviewedAt(), submission.getReviewedBy() == null ? null : submission.getReviewedBy().getId(),
            submission.getFiles().stream().map(SubmissionFile::response).toList());
    }
}
