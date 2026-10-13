package com.rce.lms.user;

import com.rce.lms.common.ApiException;
import com.rce.lms.file.FileTransactions;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@Transactional(readOnly = true)
public class ProfileService {
    private final UserRepository users;
    private final ProfileFileRepository profileFiles;
    private final FileTransactions files;
    private final PasswordEncoder passwords;

    public ProfileService(UserRepository users, ProfileFileRepository profileFiles, FileTransactions files,
                          PasswordEncoder passwords) {
        this.users = users;
        this.profileFiles = profileFiles;
        this.files = files;
        this.passwords = passwords;
    }

    @Transactional
    public UserResponse update(ProfileRequest input, UserAccount actor) {
        UserAccount user = locked(actor);
        user.setName(input.name().strip());
        user.setEmail(input.email());
        return UserResponse.from(user);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public UserResponse upload(List<MultipartFile> uploads, UserAccount actor) {
        if (uploads == null || uploads.isEmpty())
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_FILE", "프로필 이미지를 선택해 주세요.");
        return files.replace(uploads, true, stored -> {
            UserAccount user = locked(actor);
            ProfileFile previous = user.getProfileImage();
            ProfileFile image = profileFiles.save(new ProfileFile(user.getId(), stored.getFirst()));
            user.setProfileImage(image);
            users.flush();
            remove(previous);
            return UserResponse.from(user);
        });
    }

    @Transactional
    public UserResponse removeImage(UserAccount actor) {
        UserAccount user = locked(actor);
        ProfileFile previous = user.getProfileImage();
        user.setProfileImage(null);
        users.flush();
        remove(previous);
        return UserResponse.from(user);
    }

    @Transactional
    public void changePassword(PasswordChangeRequest input, UserAccount actor) {
        PasswordPolicy.validate(input.newPassword());
        UserAccount user = locked(actor);
        if (PasswordPolicy.exceedsMaximumBytes(input.currentPassword())
                || !passwords.matches(input.currentPassword(), user.getPasswordHash()))
            throw new ApiException(HttpStatus.BAD_REQUEST, "CURRENT_PASSWORD_INCORRECT", "현재 비밀번호가 올바르지 않습니다.");
        if (passwords.matches(input.newPassword(), user.getPasswordHash()))
            throw new ApiException(HttpStatus.BAD_REQUEST, "PASSWORD_UNCHANGED", "현재 비밀번호와 다른 비밀번호를 입력해 주세요.");
        user.setPasswordHash(passwords.encode(input.newPassword()));
    }

    private UserAccount locked(UserAccount actor) {
        UserAccount user = users.findByIdForUpdate(actor.getId()).orElseThrow(ProfileService::staleSession);
        if (!user.isActive() || user.getCredentialVersion() != actor.getCredentialVersion()) throw staleSession();
        return user;
    }

    private void remove(ProfileFile previous) {
        if (previous == null) return;
        profileFiles.delete(previous);
        files.deleteAfterCommit(List.of(previous.getStorageKey()));
    }

    private static ApiException staleSession() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "SESSION_INVALID", "세션이 만료되었습니다. 다시 로그인해 주세요.");
    }
}
