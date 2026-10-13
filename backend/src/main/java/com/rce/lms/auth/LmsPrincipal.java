package com.rce.lms.auth;

import com.rce.lms.user.UserAccount;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.CredentialsContainer;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

public final class LmsPrincipal implements UserDetails, CredentialsContainer {
    private final UUID id;
    private final String studentId;
    private String passwordHash;
    private final boolean active;
    private final long credentialVersion;
    private final List<GrantedAuthority> authorities;

    public LmsPrincipal(UserAccount user) {
        id = user.getId();
        studentId = user.getStudentId();
        passwordHash = user.getPasswordHash();
        active = user.isActive();
        credentialVersion = user.getCredentialVersion();
        authorities = List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));
    }
    public UUID id() { return id; }
    public long credentialVersion() { return credentialVersion; }
    @Override public String getUsername() { return studentId; }
    @Override public String getPassword() { return passwordHash; }
    @Override public boolean isEnabled() { return active; }
    @Override public Collection<? extends GrantedAuthority> getAuthorities() { return authorities; }
    @Override public void eraseCredentials() { passwordHash = null; }
}
