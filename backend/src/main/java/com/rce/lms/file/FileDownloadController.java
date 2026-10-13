package com.rce.lms.file;

import com.rce.lms.assignment.AssignmentFileRepository;
import com.rce.lms.auth.CurrentUser;
import com.rce.lms.common.ApiException;
import com.rce.lms.submission.SubmissionFileRepository;
import com.rce.lms.user.Role;
import com.rce.lms.user.UserAccount;
import com.rce.lms.user.ProfileFileRepository;
import com.rce.lms.user.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/files")
public class FileDownloadController {
    private final AssignmentFileRepository assignmentFiles;
    private final SubmissionFileRepository submissionFiles;
    private final FileStorage storage;
    private final CurrentUser currentUser;
    private final ProfileFileRepository profileFiles;
    private final UserRepository users;

    public FileDownloadController(AssignmentFileRepository assignmentFiles, SubmissionFileRepository submissionFiles,
            FileStorage storage, CurrentUser currentUser, ProfileFileRepository profileFiles, UserRepository users) {
        this.assignmentFiles = assignmentFiles;
        this.submissionFiles = submissionFiles;
        this.storage = storage;
        this.currentUser = currentUser;
        this.profileFiles = profileFiles;
        this.users = users;
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<Resource> download(@PathVariable UUID id, HttpServletRequest request) throws IOException {
        UserAccount user = currentUser.require(request);
        var assignmentFile = assignmentFiles.findById(id);
        if (assignmentFile.isPresent()) {
            var file = assignmentFile.get();
            if (file.getAssignment().getTargetTrack() != user.getTrack()) throw missing();
            return response(file.response(), file.getStorageKey());
        }
        var submissionFile = submissionFiles.findById(id);
        if (submissionFile.isPresent()) {
            var file = submissionFile.get();
            var submission = file.getSubmission();
            boolean sameTrack = submission.getAssignment().getTargetTrack() == user.getTrack();
            boolean allowed = sameTrack && (user.getRole() == Role.STAFF || submission.getUser().getId().equals(user.getId()));
            if (!allowed) throw missing();
            return response(file.response(), file.getStorageKey());
        }
        var file = profileFiles.findById(id).orElseThrow(this::missing);
        var owner = users.findById(file.getOwnerId()).orElseThrow(this::missing);
        if (owner.getProfileImage() == null || !owner.getProfileImage().getId().equals(id)
            || (!owner.getId().equals(user.getId()) && owner.getTrack() != user.getTrack())) throw missing();
        return response(file.response(), file.getStorageKey());
    }

    private ResponseEntity<Resource> response(FileResponse file, String key) throws IOException {
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(file.type())).contentLength(file.size())
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(file.name(), StandardCharsets.UTF_8).build().toString())
            .header("X-Content-Type-Options", "nosniff").header(HttpHeaders.CACHE_CONTROL, "no-store")
            .body(storage.load(key));
    }

    private ApiException missing() {
        return new ApiException(HttpStatus.NOT_FOUND, "FILE_NOT_FOUND", "파일을 찾을 수 없습니다.");
    }
}
