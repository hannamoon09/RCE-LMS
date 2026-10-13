package com.rce.lms.notice;

import com.rce.lms.common.ApiException;
import com.rce.lms.user.Role;
import com.rce.lms.user.UserAccount;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class NoticeService {
    private final NoticeRepository notices;

    public NoticeService(NoticeRepository notices) { this.notices = notices; }

    public List<NoticeResponse> list(UserAccount user) {
        return notices.findVisible(user.getTrack()).stream().map(NoticeResponse::from).toList();
    }

    public NoticeResponse get(UUID id, UserAccount user) {
        Notice notice = notices.findById(id).orElseThrow(this::missing);
        if (notice.getTrack() != null && notice.getTrack() != user.getTrack()) throw missing();
        return NoticeResponse.from(notice);
    }

    @Transactional
    public NoticeResponse create(NoticeRequest input, UserAccount staff) {
        requireStaff(staff);
        return NoticeResponse.from(notices.save(new Notice(input, staff)));
    }

    @Transactional
    public NoticeResponse update(UUID id, NoticeRequest input, UserAccount staff) {
        requireStaff(staff);
        Notice notice = editable(id, staff);
        notice.update(input);
        return NoticeResponse.from(notice);
    }

    @Transactional
    public void delete(UUID id, UserAccount staff) {
        requireStaff(staff);
        notices.delete(editable(id, staff));
    }

    private Notice editable(UUID id, UserAccount staff) {
        Notice notice = notices.findByIdForUpdate(id).orElseThrow(this::missing);
        // A null track is a global notice; no ordinary STAFF may modify it.
        if (notice.getTrack() != staff.getTrack()) throw missing();
        return notice;
    }

    private void requireStaff(UserAccount user) {
        if (user.getRole() != Role.STAFF)
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "접근 권한이 없습니다.");
    }

    private ApiException missing() {
        return new ApiException(HttpStatus.NOT_FOUND, "NOTICE_NOT_FOUND", "공지를 찾을 수 없습니다.");
    }
}
