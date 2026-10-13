package com.rce.lms.file;

import com.rce.lms.common.ApiException;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;

/** Entity ownership must be checked before its file IDs are passed here. */
public final class FileSelection {
    private FileSelection() {}
    public static void validate(List<UUID> retained, Collection<UUID> available, int uploadedCount) {
        if (retained.size() + uploadedCount > 5)
            throw new ApiException(HttpStatus.BAD_REQUEST, "FILE_LIMIT", "파일은 최대 5개까지 첨부할 수 있습니다.");
        if (retained.stream().anyMatch(Objects::isNull) || new HashSet<>(retained).size() != retained.size() || !available.containsAll(retained))
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_RETAINED_FILES", "기존 첨부파일을 다시 확인해 주세요.");
    }
}
