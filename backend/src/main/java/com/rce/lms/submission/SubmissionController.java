package com.rce.lms.submission;

import com.rce.lms.auth.CurrentUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class SubmissionController {
    private final SubmissionService submissions;
    private final CurrentUser currentUser;

    public SubmissionController(SubmissionService submissions, CurrentUser currentUser) {
        this.submissions = submissions;
        this.currentUser = currentUser;
    }

    @GetMapping("/submissions/me")
    public List<SubmissionResponse> mine(HttpServletRequest request) {
        return submissions.mine(currentUser.require(request));
    }

    @GetMapping("/assignments/{id}/submission")
    public SubmissionResponse get(@PathVariable UUID id, HttpServletRequest request) {
        return submissions.get(id, currentUser.require(request));
    }

    @PostMapping(value = "/assignments/{id}/submission", consumes = MediaType.APPLICATION_JSON_VALUE)
    public SubmissionResponse submit(@PathVariable UUID id, @Valid @RequestBody SubmissionRequest input,
            HttpServletRequest request) {
        return submissions.submit(id, input, currentUser.require(request));
    }

    @PostMapping(value = "/assignments/{id}/submission", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public SubmissionResponse submitWithFiles(@PathVariable UUID id,
            @Valid @RequestPart("data") SubmissionMultipartRequest input,
            @RequestPart(value = "files", required = false) List<MultipartFile> files, HttpServletRequest request) {
        return submissions.submitWithFiles(id, input, files == null ? List.of() : files, currentUser.require(request));
    }
}
