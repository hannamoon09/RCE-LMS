package com.rce.lms.user;

import com.rce.lms.auth.CurrentUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {
    private final AdminUserService users;
    private final CurrentUser currentUser;

    public AdminUserController(AdminUserService users, CurrentUser currentUser) {
        this.users = users;
        this.currentUser = currentUser;
    }

    @GetMapping
    public List<UserResponse> list(HttpServletRequest request) {
        return users.list(currentUser.require(request));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse create(@Valid @RequestBody AdminUserCreateRequest input, HttpServletRequest request) {
        return users.create(input, currentUser.require(request));
    }

    @PatchMapping("/{id}")
    public UserResponse update(@PathVariable UUID id, @Valid @RequestBody AdminUserPatchRequest input, HttpServletRequest request) {
        return users.update(id, input, currentUser.require(request));
    }
}
