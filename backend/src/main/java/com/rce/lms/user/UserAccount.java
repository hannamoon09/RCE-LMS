package com.rce.lms.user;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
public class UserAccount {
    @Id private UUID id;
    @Column(name = "student_id", nullable = false, unique = true, length = 32) private String studentId;
    @Column(name = "password_hash", nullable = false) private String passwordHash;
    @Column(nullable = false, length = 100) private String name;
    @Column(length = 254) private String email;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private Role role;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private Track track;
    @Column(nullable = false) private boolean active;
    @Column(name = "joined_at", nullable = false) private Instant joinedAt;
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "profile_image") private ProfileFile profileImage;
    @Column(name = "credential_version", nullable = false) private long credentialVersion;

    protected UserAccount() {}

    public UserAccount(String studentId, String passwordHash, String name, Role role, Track track) {
        this.id = UUID.randomUUID();
        this.studentId = studentId;
        this.passwordHash = passwordHash;
        this.name = name;
        this.role = role;
        this.track = track;
        this.active = true;
        this.joinedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public String getStudentId() { return studentId; }
    public String getPasswordHash() { return passwordHash; }
    public String getName() { return name; }
    public String getEmail() { return email; }
    public Role getRole() { return role; }
    public Track getTrack() { return track; }
    public boolean isActive() { return active; }
    public Instant getJoinedAt() { return joinedAt; }
    public ProfileFile getProfileImage() { return profileImage; }
    public long getCredentialVersion() { return credentialVersion; }
    public void setName(String name) { this.name = name; }
    public void setEmail(String email) { this.email = email; }
    public void setProfileImage(ProfileFile profileImage) { this.profileImage = profileImage; }
    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
        credentialVersion++;
    }
    public void setActive(boolean active) { this.active = active; }
}
