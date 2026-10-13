package com.rce.lms.notice;

import com.rce.lms.user.Track;
import java.time.Instant;
import java.util.UUID;

public record NoticeResponse(UUID id, String title, String body, String category, boolean important,
        Track track, String author, Instant createdAt, Instant updatedAt) {
    public static NoticeResponse from(Notice notice) {
        return new NoticeResponse(notice.getId(), notice.getTitle(), notice.getBody(), notice.getCategory(),
            notice.isImportant(), notice.getTrack(), notice.getAuthor().getName(), notice.getCreatedAt(), notice.getUpdatedAt());
    }
}
