package com.rce.lms.ranking;

import com.rce.lms.common.ApiException;
import com.rce.lms.user.Role;
import com.rce.lms.user.UserAccount;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class RankingService {
    private final JdbcTemplate jdbc;

    public RankingService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<RankingResponse> member(UserAccount member) {
        requireRole(member, Role.MEMBER);
        return ranking(member);
    }

    public List<RankingResponse> staff(UserAccount staff) {
        requireRole(staff, Role.STAFF);
        return ranking(staff);
    }

    private List<RankingResponse> ranking(UserAccount viewer) {
        // Keep the review/assignment predicates in the join so members with no graded work remain.
        // One statement gives all aggregate values and the ordering the same database snapshot.
        return jdbc.query("""
            WITH scores AS (
                SELECT u.id, u.name,
                       COALESCE(SUM(s.score), 0) AS total_score,
                       COALESCE(AVG(s.score), 0) AS average_score,
                       COUNT(s.id) AS reviewed_count
                FROM users u
                LEFT JOIN (submissions s INNER JOIN assignments a
                           ON a.id = s.assignment_id AND a.target_track = ?)
                    ON s.user_id = u.id AND s.status = 'REVIEWED' AND s.score IS NOT NULL
                WHERE u.role = 'MEMBER' AND u.active = true AND u.track = ?
                GROUP BY u.id, u.name
            )
            SELECT ROW_NUMBER() OVER (
                       ORDER BY total_score DESC, average_score DESC, reviewed_count DESC, name ASC, id ASC
                   ) AS rank,
                   name, total_score, average_score, reviewed_count, id = ? AS is_me
            FROM scores
            ORDER BY total_score DESC, average_score DESC, reviewed_count DESC, name ASC, id ASC
            """, (row, index) -> new RankingResponse(row.getLong("rank"), row.getString("name"),
                row.getLong("total_score"), row.getBigDecimal("average_score"),
                row.getLong("reviewed_count"), row.getBoolean("is_me")),
            viewer.getTrack().name(), viewer.getTrack().name(), viewer.getId());
    }

    private static void requireRole(UserAccount user, Role role) {
        if (user.getRole() != role)
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "접근 권한이 없습니다.");
    }
}
