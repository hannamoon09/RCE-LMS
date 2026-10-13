package com.rce.lms.assignment;

import com.rce.lms.auth.CurrentUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class AssignmentController {
    private final AssignmentService assignments;
    private final CurrentUser currentUser;

    public AssignmentController(AssignmentService assignments, CurrentUser currentUser) {
        this.assignments = assignments;
        this.currentUser = currentUser;
    }

    @GetMapping("/assignments")
    public List<AssignmentResponse> list(HttpServletRequest request) {
        return assignments.list(currentUser.require(request));
    }

    @GetMapping("/assignments/{id}")
    public AssignmentResponse get(@PathVariable UUID id, HttpServletRequest request) {
        return assignments.get(id, currentUser.require(request));
    }

    @GetMapping("/admin/assignments")
    public List<AssignmentResponse> adminList(HttpServletRequest request) {
        return assignments.adminList(currentUser.require(request));
    }

    @PostMapping(value = "/admin/assignments", consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public AssignmentResponse create(@Valid @RequestBody AssignmentRequest input, HttpServletRequest request) {
        return assignments.create(input, currentUser.require(request));
    }

    @PatchMapping(value = "/admin/assignments/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public AssignmentResponse update(@PathVariable UUID id, @Valid @RequestBody AssignmentRequest input,
            HttpServletRequest request) {
        return assignments.update(id, input, currentUser.require(request));
    }

    @PostMapping(value = "/admin/assignments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public AssignmentResponse createWithFiles(@Valid @RequestPart("data") AssignmentMultipartRequest input,
            @RequestPart(value = "files", required = false) List<MultipartFile> files, HttpServletRequest request) {
        return assignments.createWithFiles(input, files == null ? List.of() : files, currentUser.require(request));
    }

    @PatchMapping(value = "/admin/assignments/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AssignmentResponse updateWithFiles(@PathVariable UUID id,
            @Valid @RequestPart("data") AssignmentMultipartRequest input,
            @RequestPart(value = "files", required = false) List<MultipartFile> files, HttpServletRequest request) {
        return assignments.updateWithFiles(id, input, files == null ? List.of() : files, currentUser.require(request));
    }

    @DeleteMapping("/admin/assignments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, HttpServletRequest request) {
        assignments.delete(id, currentUser.require(request));
    }
}
