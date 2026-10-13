package com.rce.lms.submission;

import com.rce.lms.auth.CurrentUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/submissions")
public class AdminReviewController {
    private final AdminReviewService reviews;
    private final CurrentUser currentUser;

    public AdminReviewController(AdminReviewService reviews, CurrentUser currentUser) {
        this.reviews = reviews;
        this.currentUser = currentUser;
    }

    @GetMapping
    public List<SubmissionResponse> list(@RequestParam(required = false) UUID assignmentId,
            @RequestParam(required = false) SubmissionStatus status, HttpServletRequest request) {
        return reviews.list(assignmentId, status, currentUser.require(request));
    }

    @PatchMapping("/{id}/review")
    public SubmissionResponse review(@PathVariable UUID id, @Valid @RequestBody ReviewRequest input,
            HttpServletRequest request) {
        return reviews.review(id, input, currentUser.require(request));
    }
}
