package com.rce.lms.submission;

import com.rce.lms.assignment.AssignmentRepository;
import com.rce.lms.common.ApiException;
import com.rce.lms.user.Role;
import com.rce.lms.user.UserAccount;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class AdminReviewService {
    private final AssignmentRepository assignments;
    private final SubmissionRepository submissions;

    public AdminReviewService(AssignmentRepository assignments, SubmissionRepository submissions) {
        this.assignments = assignments;
        this.submissions = submissions;
    }

    public List<SubmissionResponse> list(UUID assignmentId, SubmissionStatus status, UserAccount staff) {
        requireStaff(staff);
        if (assignmentId != null) {
            var assignment = assignments.findById(assignmentId).orElseThrow(this::missingAssignment);
            if (assignment.getTargetTrack() != staff.getTrack()) throw missingAssignment();
        }
        return submissions.findForReview(staff.getTrack(), assignmentId, status).stream().map(SubmissionResponse::from).toList();
    }

    @Transactional
    public SubmissionResponse review(UUID id, ReviewRequest input, UserAccount staff) {
        requireStaff(staff);
        UUID assignmentId = submissions.findAssignmentIdForReview(id, staff.getTrack()).orElseThrow(this::missingSubmission);
        var assignment = assignments.findByIdForUpdate(assignmentId).orElseThrow(this::missingSubmission);
        if (assignment.getTargetTrack() != staff.getTrack()) throw missingSubmission();
        // Load the entity only after the lock; concurrent resubmission may have replaced its content and files.
        var submission = submissions.findById(id).orElseThrow(this::missingSubmission);
        submission.review(input.score().intValueExact(), input.feedback(), staff);
        return SubmissionResponse.from(submission);
    }

    private void requireStaff(UserAccount user) {
        if (user.getRole() != Role.STAFF)
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "접근 권한이 없습니다.");
    }

    private ApiException missingSubmission() {
        return new ApiException(HttpStatus.NOT_FOUND, "SUBMISSION_NOT_FOUND", "제출물을 찾을 수 없습니다.");
    }

    private ApiException missingAssignment() {
        return new ApiException(HttpStatus.NOT_FOUND, "ASSIGNMENT_NOT_FOUND", "과제를 찾을 수 없습니다.");
    }
}
