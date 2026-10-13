package com.rce.lms.assignment;

import com.rce.lms.user.Track;
import com.rce.lms.user.UserAccount;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "assignments")
public class Assignment {
    @Id private UUID id;
    @Column(nullable = false, length = 120) private String title;
    @Column(nullable = false, columnDefinition = "text") private String description;
    @Column(nullable = false, length = 16) private String difficulty;
    @Column(nullable = false) private Instant deadline;
    @Enumerated(EnumType.STRING)
    @Column(name = "target_track", nullable = false, length = 16) private Track targetTrack;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false) private UserAccount author;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @OneToMany(mappedBy = "assignment", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC, id ASC") private List<AssignmentFile> files = new ArrayList<>();

    protected Assignment() {}

    public Assignment(AssignmentRequest input, UserAccount staff) {
        id = UUID.randomUUID();
        targetTrack = staff.getTrack();
        author = staff;
        createdAt = Instant.now();
        update(input);
    }

    public void update(AssignmentRequest input) {
        title = input.title().trim();
        description = input.description().trim();
        difficulty = input.difficulty();
        deadline = input.deadline();
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public String getDifficulty() { return difficulty; }
    public Instant getDeadline() { return deadline; }
    public Track getTargetTrack() { return targetTrack; }
    public UserAccount getAuthor() { return author; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public List<AssignmentFile> getFiles() { return files; }
}
