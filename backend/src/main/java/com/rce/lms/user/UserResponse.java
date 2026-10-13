package com.rce.lms.user;

import com.rce.lms.file.FileResponse;
import java.time.Instant;
import java.util.UUID;

public record UserResponse(UUID id, String studentId, String name, String email, Role role,
                           Track track, boolean active, Instant joinedAt, FileResponse profileImage) {
    public static UserResponse from(UserAccount user) {
        return new UserResponse(user.getId(), user.getStudentId(), user.getName(), user.getEmail(),
            user.getRole(), user.getTrack(), user.isActive(), user.getJoinedAt(),
            user.getProfileImage() == null ? null : user.getProfileImage().response());
    }
}
