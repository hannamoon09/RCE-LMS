package com.rce.lms.submission;

import com.rce.lms.assignment.Assignment;
import com.rce.lms.user.UserAccount;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "submissions", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "assignment_id"}))
public class Submission {
    @Id private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assignment_id", nullable = false) private Assignment assignment;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false) private UserAccount user;
    @Column(columnDefinition = "text") private String content;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16) private SubmissionStatus status;
    private Integer score;
    @Column(columnDefinition = "text") private String feedback;
    @Column(name = "submitted_at", nullable = false) private Instant submittedAt;
    @Column(name = "reviewed_at") private Instant reviewedAt;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by") private UserAccount reviewedBy;
    @OneToMany(mappedBy = "submission", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC, id ASC") private List<SubmissionFile> files = new ArrayList<>();

    protected Submission() {}

    public Submission(Assignment assignment, UserAccount user, String content) {
        id = UUID.randomUUID();
        this.assignment = assignment;
        this.user = user;
        resubmit(content);
    }

    public void resubmit(String content) {
        this.content = content == null || content.isBlank() ? null : content.trim();
        status = SubmissionStatus.PENDING;
        score = null;
        feedback = null;
        reviewedAt = null;
        reviewedBy = null;
        submittedAt = Instant.now();
    }

    /** The review service must authorize the reviewer before calling this transition. */
    public void review(int score, String feedback, UserAccount reviewer) {
        if (score < 0 || score > 100) throw new IllegalArgumentException("Score must be between 0 and 100");
        this.score = score;
        this.feedback = feedback == null || feedback.isBlank() ? null : feedback.trim();
        status = SubmissionStatus.REVIEWED;
        reviewedAt = Instant.now();
        reviewedBy = reviewer;
    }

    public UUID getId() { return id; }
    public Assignment getAssignment() { return assignment; }
    public UserAccount getUser() { return user; }
    public String getContent() { return content; }
    public SubmissionStatus getStatus() { return status; }
    public Integer getScore() { return score; }
    public String getFeedback() { return feedback; }
    public Instant getSubmittedAt() { return submittedAt; }
    public Instant getReviewedAt() { return reviewedAt; }
    public UserAccount getReviewedBy() { return reviewedBy; }
    public List<SubmissionFile> getFiles() { return files; }
}
