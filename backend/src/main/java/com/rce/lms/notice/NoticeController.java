package com.rce.lms.notice;

import com.rce.lms.auth.CurrentUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class NoticeController {
    private final NoticeService notices;
    private final CurrentUser currentUser;

    public NoticeController(NoticeService notices, CurrentUser currentUser) {
        this.notices = notices;
        this.currentUser = currentUser;
    }

    @GetMapping("/notices")
    public List<NoticeResponse> list(HttpServletRequest request) {
        return notices.list(currentUser.require(request));
    }

    @GetMapping("/notices/{id}")
    public NoticeResponse get(@PathVariable UUID id, HttpServletRequest request) {
        return notices.get(id, currentUser.require(request));
    }

    @PostMapping("/admin/notices")
    @ResponseStatus(HttpStatus.CREATED)
    public NoticeResponse create(@Valid @RequestBody NoticeRequest input, HttpServletRequest request) {
        return notices.create(input, currentUser.require(request));
    }

    @PatchMapping("/admin/notices/{id}")
    public NoticeResponse update(@PathVariable UUID id, @Valid @RequestBody NoticeRequest input, HttpServletRequest request) {
        return notices.update(id, input, currentUser.require(request));
    }

    @DeleteMapping("/admin/notices/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, HttpServletRequest request) {
        notices.delete(id, currentUser.require(request));
    }
}
