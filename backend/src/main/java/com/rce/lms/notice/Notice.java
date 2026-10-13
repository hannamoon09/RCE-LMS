package com.rce.lms.notice;

import com.rce.lms.user.Track;
import com.rce.lms.user.UserAccount;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "notices")
public class Notice {
    @Id private UUID id;
    @Column(nullable = false, length = 120) private String title;
    @Column(nullable = false, columnDefinition = "text") private String body;
    @Column(nullable = false, length = 50) private String category;
    @Column(nullable = false) private boolean important;
    @Enumerated(EnumType.STRING) @Column(length = 16) private Track track;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false) private UserAccount author;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    protected Notice() {}

    public Notice(NoticeRequest input, UserAccount staff) {
        id = UUID.randomUUID();
        author = staff;
        track = staff.getTrack();
        createdAt = Instant.now();
        update(input);
    }

    public void update(NoticeRequest input) {
        title = input.title().trim();
        body = input.body().trim();
        category = input.category().trim();
        important = input.important();
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public String getTitle() { return title; }
    public String getBody() { return body; }
    public String getCategory() { return category; }
    public boolean isImportant() { return important; }
    public Track getTrack() { return track; }
    public UserAccount getAuthor() { return author; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
