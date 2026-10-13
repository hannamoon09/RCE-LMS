package com.rce.lms.submission;

import com.rce.lms.file.FileResponse;
import com.rce.lms.file.StoredUpload;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "submission_files")
public class SubmissionFile {
    @Id private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "submission_id", nullable = false) private Submission submission;
    @Column(name = "file_name", nullable = false) private String fileName;
    @Column(name = "content_type", nullable = false, length = 127) private String contentType;
    @Column(nullable = false) private long size;
    @Column(name = "storage_key", nullable = false, unique = true, length = 36) private String storageKey;
    @Column(name = "created_at", nullable = false) private Instant createdAt;

    protected SubmissionFile() {}
    public SubmissionFile(Submission submission, StoredUpload file) {
        id = UUID.randomUUID();
        this.submission = submission;
        fileName = file.fileName();
        contentType = file.contentType();
        size = file.size();
        storageKey = file.storageKey();
        createdAt = Instant.now();
    }
    public UUID getId() { return id; }
    public Submission getSubmission() { return submission; }
    public String getStorageKey() { return storageKey; }
    public FileResponse response() { return new FileResponse(id, fileName, size, contentType); }
}
