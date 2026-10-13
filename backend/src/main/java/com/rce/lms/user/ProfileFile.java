package com.rce.lms.user;

import com.rce.lms.file.FileResponse;
import com.rce.lms.file.StoredUpload;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "profile_files")
public class ProfileFile {
    @Id private UUID id;
    @Column(name = "owner_id", nullable = false) private UUID ownerId;
    @Column(name = "file_name", nullable = false) private String fileName;
    @Column(name = "content_type", nullable = false, length = 127) private String contentType;
    @Column(nullable = false) private long size;
    @Column(name = "storage_key", nullable = false, unique = true, length = 36) private String storageKey;
    @Column(name = "created_at", nullable = false) private Instant createdAt;

    protected ProfileFile() {}
    public ProfileFile(UUID ownerId, StoredUpload file) {
        id = UUID.randomUUID();
        this.ownerId = ownerId;
        fileName = file.fileName();
        contentType = file.contentType();
        size = file.size();
        storageKey = file.storageKey();
        createdAt = Instant.now();
    }
    public UUID getId() { return id; }
    public UUID getOwnerId() { return ownerId; }
    public String getStorageKey() { return storageKey; }
    public FileResponse response() { return new FileResponse(id, fileName, size, contentType); }
}
