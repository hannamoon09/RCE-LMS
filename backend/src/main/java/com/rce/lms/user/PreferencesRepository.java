package com.rce.lms.user;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PreferencesRepository extends JpaRepository<UserPreferences, UUID> {}
