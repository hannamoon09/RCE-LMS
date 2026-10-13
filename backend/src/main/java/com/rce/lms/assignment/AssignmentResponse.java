package com.rce.lms.assignment;

import com.rce.lms.file.FileResponse;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record AssignmentResponse(UUID id, String title, String description, String difficulty,
        Instant deadline, String author, List<FileResponse> attachments, Instant createdAt, Instant updatedAt) {
    public static AssignmentResponse from(Assignment assignment) {
        return new AssignmentResponse(assignment.getId(), assignment.getTitle(), assignment.getDescription(),
            assignment.getDifficulty(), assignment.getDeadline(), assignment.getAuthor().getName(),
            assignment.getFiles().stream().map(AssignmentFile::response).toList(),
            assignment.getCreatedAt(), assignment.getUpdatedAt());
    }
}
