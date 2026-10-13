package com.rce.lms.notice;

import com.rce.lms.user.Track;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface NoticeRepository extends JpaRepository<Notice, UUID> {
    @EntityGraph(attributePaths = "author")
    @Query("select n from Notice n where n.track is null or n.track = :track "
        + "order by n.important desc, n.createdAt desc, n.id asc")
    List<Notice> findVisible(@Param("track") Track track);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select n from Notice n where n.id = :id")
    Optional<Notice> findByIdForUpdate(@Param("id") UUID id);
}
