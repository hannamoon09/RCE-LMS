package com.rce.lms.assignment;

import com.rce.lms.common.ApiException;
import com.rce.lms.file.FileSelection;
import com.rce.lms.file.FileTransactions;
import com.rce.lms.submission.SubmissionRepository;
import com.rce.lms.user.Role;
import com.rce.lms.user.UserAccount;
import java.util.List;
import java.util.UUID;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.web.multipart.MultipartFile;

@Service
@Transactional(readOnly = true)
public class AssignmentService {
    private final AssignmentRepository assignments;
    private final SubmissionRepository submissions;
    private final FileTransactions files;

    public AssignmentService(AssignmentRepository assignments, SubmissionRepository submissions, FileTransactions files) {
        this.assignments = assignments;
        this.submissions = submissions;
        this.files = files;
    }

    public List<AssignmentResponse> list(UserAccount user) {
        return assignments.findByTargetTrackOrderByCreatedAtDescIdAsc(user.getTrack()).stream()
            .map(AssignmentResponse::from).toList();
    }

    public List<AssignmentResponse> adminList(UserAccount staff) {
        requireStaff(staff);
        return list(staff);
    }

    public AssignmentResponse get(UUID id, UserAccount user) {
        return AssignmentResponse.from(scoped(assignments.findById(id).orElseThrow(this::missing), user));
    }

    @Transactional
    public AssignmentResponse create(AssignmentRequest input, UserAccount staff) {
        requireStaff(staff);
        if (!input.deadline().isAfter(Instant.now())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DEADLINE", "새 과제의 마감은 현재 시간 이후로 설정해 주세요.");
        }
        return AssignmentResponse.from(assignments.save(new Assignment(input, staff)));
    }

    @Transactional
    public AssignmentResponse update(UUID id, AssignmentRequest input, UserAccount staff) {
        requireStaff(staff);
        Assignment assignment = scoped(assignments.findByIdForUpdate(id).orElseThrow(this::missing), staff);
        assignment.update(input);
        return AssignmentResponse.from(assignment);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public AssignmentResponse createWithFiles(AssignmentMultipartRequest input, List<MultipartFile> uploads, UserAccount staff) {
        requireStaff(staff);
        FileSelection.validate(input.retained(), List.of(), uploads.size());
        if (!input.deadline().isAfter(Instant.now()))
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DEADLINE", "새 과제의 마감은 현재 시간 이후로 설정해 주세요.");
        return files.replace(uploads, false, saved -> {
            if (!input.deadline().isAfter(Instant.now()))
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DEADLINE", "새 과제의 마감은 현재 시간 이후로 설정해 주세요.");
            Assignment assignment = new Assignment(input.assignment(), staff);
            saved.forEach(file -> assignment.getFiles().add(new AssignmentFile(assignment, file)));
            return AssignmentResponse.from(assignments.save(assignment));
        });
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public AssignmentResponse updateWithFiles(UUID id, AssignmentMultipartRequest input, List<MultipartFile> uploads, UserAccount staff) {
        requireStaff(staff);
        scoped(assignments.findById(id).orElseThrow(this::missing), staff);
        return files.replace(uploads, false, saved -> {
            Assignment assignment = scoped(assignments.findByIdForUpdate(id).orElseThrow(this::missing), staff);
            FileSelection.validate(input.retained(), assignment.getFiles().stream().map(AssignmentFile::getId).toList(), saved.size());
            List<String> removed = assignment.getFiles().stream().filter(file -> !input.retained().contains(file.getId()))
                .map(AssignmentFile::getStorageKey).toList();
            assignment.getFiles().removeIf(file -> !input.retained().contains(file.getId()));
            saved.forEach(file -> assignment.getFiles().add(new AssignmentFile(assignment, file)));
            assignment.update(input.assignment());
            files.deleteAfterCommit(removed);
            return AssignmentResponse.from(assignments.save(assignment));
        });
    }

    @Transactional
    public void delete(UUID id, UserAccount staff) {
        requireStaff(staff);
        Assignment assignment = scoped(assignments.findByIdForUpdate(id).orElseThrow(this::missing), staff);
        if (submissions.existsByAssignmentId(id))
            throw new ApiException(HttpStatus.CONFLICT, "ASSIGNMENT_HAS_SUBMISSIONS", "제출물이 존재하는 과제는 삭제할 수 없습니다.");
        files.deleteAfterCommit(assignment.getFiles().stream().map(AssignmentFile::getStorageKey).toList());
        assignments.delete(assignment);
    }

    private Assignment scoped(Assignment assignment, UserAccount user) {
        if (assignment.getTargetTrack() != user.getTrack()) throw missing();
        return assignment;
    }

    private void requireStaff(UserAccount user) {
        if (user.getRole() != Role.STAFF)
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "접근 권한이 없습니다.");
    }

    private ApiException missing() {
        return new ApiException(HttpStatus.NOT_FOUND, "ASSIGNMENT_NOT_FOUND", "과제를 찾을 수 없습니다.");
    }
}
