package com.rce.lms.submission;

import com.rce.lms.assignment.Assignment;
import com.rce.lms.assignment.AssignmentRepository;
import com.rce.lms.common.ApiException;
import com.rce.lms.file.FileSelection;
import com.rce.lms.file.FileTransactions;
import com.rce.lms.user.Role;
import com.rce.lms.user.UserAccount;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.web.multipart.MultipartFile;

@Service
@Transactional(readOnly = true)
public class SubmissionService {
    private final AssignmentRepository assignments;
    private final SubmissionRepository submissions;
    private final FileTransactions files;

    public SubmissionService(AssignmentRepository assignments, SubmissionRepository submissions, FileTransactions files) {
        this.assignments = assignments;
        this.submissions = submissions;
        this.files = files;
    }

    public List<SubmissionResponse> mine(UserAccount member) {
        requireMember(member);
        return submissions.findByUserIdAndAssignmentTargetTrackOrderBySubmittedAtDescIdAsc(member.getId(), member.getTrack())
            .stream().map(SubmissionResponse::from).toList();
    }

    public SubmissionResponse get(UUID assignmentId, UserAccount member) {
        requireMember(member);
        scoped(assignments.findById(assignmentId).orElseThrow(this::missingAssignment), member);
        return submissions.findByUserIdAndAssignmentId(member.getId(), assignmentId).map(SubmissionResponse::from)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SUBMISSION_NOT_FOUND", "아직 제출한 내용이 없습니다."));
    }

    @Transactional
    public SubmissionResponse submit(UUID assignmentId, SubmissionRequest input, UserAccount member) {
        requireMember(member);
        // Creation, resubmission and assignment deletion serialize on the same row.
        Assignment assignment = scoped(assignments.findByIdForUpdate(assignmentId).orElseThrow(this::missingAssignment), member);
        if (!assignment.getDeadline().isAfter(Instant.now()))
            throw new ApiException(HttpStatus.CONFLICT, "ASSIGNMENT_CLOSED", "마감된 과제에는 제출할 수 없습니다.");
        if (input.content() == null || input.content().isBlank())
            throw new ApiException(HttpStatus.BAD_REQUEST, "EMPTY_SUBMISSION", "제출할 파일 또는 메모를 추가해 주세요.");
        Submission submission = submissions.findByUserIdAndAssignmentId(member.getId(), assignmentId).orElse(null);
        if (submission == null) submission = new Submission(assignment, member, input.content());
        else {
            submission.resubmit(input.content());
            files.deleteAfterCommit(submission.getFiles().stream().map(SubmissionFile::getStorageKey).toList());
            submission.getFiles().clear();
        }
        return SubmissionResponse.from(submissions.save(submission));
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public SubmissionResponse submitWithFiles(UUID assignmentId, SubmissionMultipartRequest input,
            List<MultipartFile> uploads, UserAccount member) {
        requireMember(member);
        Assignment beforeUpload = scoped(assignments.findById(assignmentId).orElseThrow(this::missingAssignment), member);
        if (!beforeUpload.getDeadline().isAfter(Instant.now()))
            throw new ApiException(HttpStatus.CONFLICT, "ASSIGNMENT_CLOSED", "마감된 과제에는 제출할 수 없습니다.");
        return files.replace(uploads, false, saved -> {
            Assignment assignment = scoped(assignments.findByIdForUpdate(assignmentId).orElseThrow(this::missingAssignment), member);
            if (!assignment.getDeadline().isAfter(Instant.now()))
                throw new ApiException(HttpStatus.CONFLICT, "ASSIGNMENT_CLOSED", "마감된 과제에는 제출할 수 없습니다.");
            Submission existing = submissions.findByUserIdAndAssignmentId(member.getId(), assignmentId).orElse(null);
            FileSelection.validate(input.retained(), existing == null ? List.of() : existing.getFiles().stream().map(SubmissionFile::getId).toList(), saved.size());
            if ((input.content() == null || input.content().isBlank()) && input.retained().isEmpty() && saved.isEmpty())
                throw new ApiException(HttpStatus.BAD_REQUEST, "EMPTY_SUBMISSION", "제출할 파일 또는 메모를 추가해 주세요.");
            Submission submission = existing == null ? new Submission(assignment, member, input.content()) : existing;
            if (existing != null) submission.resubmit(input.content());
            List<String> removed = submission.getFiles().stream().filter(file -> !input.retained().contains(file.getId()))
                .map(SubmissionFile::getStorageKey).toList();
            submission.getFiles().removeIf(file -> !input.retained().contains(file.getId()));
            saved.forEach(file -> submission.getFiles().add(new SubmissionFile(submission, file)));
            files.deleteAfterCommit(removed);
            return SubmissionResponse.from(submissions.save(submission));
        });
    }

    private Assignment scoped(Assignment assignment, UserAccount member) {
        if (assignment.getTargetTrack() != member.getTrack()) throw missingAssignment();
        return assignment;
    }

    private void requireMember(UserAccount user) {
        if (user.getRole() != Role.MEMBER)
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "학습자만 제출할 수 있습니다.");
    }

    private ApiException missingAssignment() {
        return new ApiException(HttpStatus.NOT_FOUND, "ASSIGNMENT_NOT_FOUND", "과제를 찾을 수 없습니다.");
    }
}
