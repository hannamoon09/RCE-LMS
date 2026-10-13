package com.rce.lms.user;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "user_preferences")
public class UserPreferences {
    @Id @Column(name = "user_id") private UUID userId;
    @Column(nullable = false) private boolean assignment = true;
    @Column(nullable = false) private boolean notice = true;
    @Column(nullable = false) private boolean feedback = true;
    @Column(nullable = false) private boolean email;

    protected UserPreferences() {}
    public UserPreferences(UUID userId) { this.userId = userId; }

    public void update(PreferencesRequest input) {
        assignment = input.assignment();
        notice = input.notice();
        feedback = input.feedback();
        email = input.email();
    }

    public PreferencesResponse response() { return new PreferencesResponse(assignment, notice, feedback, email); }
}
