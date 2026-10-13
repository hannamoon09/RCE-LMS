package com.rce.lms.assignment;

import com.rce.lms.file.FileResponse;
import com.rce.lms.file.StoredUpload;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "assignment_files")
public class AssignmentFile {
    @Id private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assignment_id", nullable = false) private Assignment assignment;
    @Column(name = "file_name", nullable = false) private String fileName;
    @Column(name = "content_type", nullable = false, length = 127) private String contentType;
    @Column(nullable = false) private long size;
    @Column(name = "storage_key", nullable = false, unique = true, length = 36) private String storageKey;
    @Column(name = "created_at", nullable = false) private Instant createdAt;

    protected AssignmentFile() {}
    public AssignmentFile(Assignment assignment, StoredUpload file) {
        id = UUID.randomUUID();
        this.assignment = assignment;
        fileName = file.fileName();
        contentType = file.contentType();
        size = file.size();
        storageKey = file.storageKey();
        createdAt = Instant.now();
    }
    public UUID getId() { return id; }
    public Assignment getAssignment() { return assignment; }
    public String getStorageKey() { return storageKey; }
    public FileResponse response() { return new FileResponse(id, fileName, size, contentType); }
}
