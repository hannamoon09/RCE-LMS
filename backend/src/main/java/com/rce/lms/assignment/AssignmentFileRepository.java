package com.rce.lms.assignment;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AssignmentFileRepository extends JpaRepository<AssignmentFile, UUID> {}
