package com.rce.lms.user;

import com.rce.lms.common.ApiException;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class AdminUserService {
    private final UserRepository users;
    private final PasswordEncoder passwords;

    public AdminUserService(UserRepository users, PasswordEncoder passwords) {
        this.users = users;
        this.passwords = passwords;
    }

    public List<UserResponse> list(UserAccount staff) {
        requireStaff(staff);
        return users.findByTrackAndRoleOrderByNameAscIdAsc(staff.getTrack(), Role.MEMBER).stream()
            .map(UserResponse::from).toList();
    }

    @Transactional
    public UserResponse create(AdminUserCreateRequest input, UserAccount staff) {
        requireStaff(staff);
        String name = validName(input.name());
        if (input.studentId() == null || !input.studentId().matches("[0-9]{4,32}")) throw invalid();
        PasswordPolicy.validate(input.initialPassword());
        if (users.existsByStudentId(input.studentId())) throw duplicate();
        var member = new UserAccount(input.studentId(), passwords.encode(input.initialPassword()), name, Role.MEMBER, staff.getTrack());
        try {
            return UserResponse.from(users.saveAndFlush(member));
        } catch (DataIntegrityViolationException error) {
            // A concurrent create can win after the existence check. Do not query the aborted transaction.
            for (Throwable cause = error; cause != null; cause = cause.getCause()) {
                if (cause instanceof SQLException sql && "23505".equals(sql.getSQLState())) throw duplicate();
            }
            throw error;
        }
    }

    @Transactional
    public UserResponse update(UUID id, AdminUserPatchRequest input, UserAccount staff) {
        requireStaff(staff);
        UserAccount member = users.findByIdForUpdate(id).orElseThrow(this::missing);
        if (member.getRole() != Role.MEMBER || member.getTrack() != staff.getTrack()) throw missing();
        if (input.name() == null && input.active() == null && input.newPassword() == null) throw invalid();
        String name = input.name() == null ? null : validName(input.name());
        if (input.newPassword() != null) PasswordPolicy.validate(input.newPassword());
        if (name != null) member.setName(name);
        if (input.active() != null) member.setActive(input.active());
        if (input.newPassword() != null) member.setPasswordHash(passwords.encode(input.newPassword()));
        return UserResponse.from(member);
    }

    private static String validName(String name) {
        if (name == null || name.isBlank() || name.length() > 100) throw invalid();
        return name.strip();
    }

    private static void requireStaff(UserAccount user) {
        if (user.getRole() != Role.STAFF)
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "접근 권한이 없습니다.");
    }

    private static ApiException invalid() {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "요청 값과 허용된 입력 항목을 확인해 주세요.");
    }

    private static ApiException duplicate() {
        return new ApiException(HttpStatus.CONFLICT, "STUDENT_ID_EXISTS", "이미 사용 중인 학번입니다.");
    }

    private ApiException missing() {
        return new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "학생을 찾을 수 없습니다.");
    }
}
