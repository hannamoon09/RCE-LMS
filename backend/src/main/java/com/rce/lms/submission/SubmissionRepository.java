package com.rce.lms.submission;

import com.rce.lms.user.Track;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SubmissionRepository extends JpaRepository<Submission, UUID> {
    List<Submission> findByUserIdAndAssignmentTargetTrackOrderBySubmittedAtDescIdAsc(UUID userId, Track track);
    Optional<Submission> findByUserIdAndAssignmentId(UUID userId, UUID assignmentId);
    boolean existsByAssignmentId(UUID assignmentId);
    long countByUserIdAndAssignmentId(UUID userId, UUID assignmentId);

    @Query("select s from Submission s where s.assignment.targetTrack = :track "
        + "and (:assignmentId is null or s.assignment.id = :assignmentId) "
        + "and (:status is null or s.status = :status) order by s.submittedAt desc, s.id asc")
    List<Submission> findForReview(@Param("track") Track track, @Param("assignmentId") UUID assignmentId,
        @Param("status") SubmissionStatus status);

    // A scalar lookup avoids caching a stale Submission before the assignment lock is acquired.
    @Query("select s.assignment.id from Submission s where s.id = :id and s.assignment.targetTrack = :track")
    Optional<UUID> findAssignmentIdForReview(@Param("id") UUID id, @Param("track") Track track);
}
