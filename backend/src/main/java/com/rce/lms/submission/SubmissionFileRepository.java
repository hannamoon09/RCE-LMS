package com.rce.lms.submission;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SubmissionFileRepository extends JpaRepository<SubmissionFile, UUID> {}
