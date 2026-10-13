package com.rce.lms.ranking;

import com.rce.lms.auth.CurrentUser;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RankingController {
    private final RankingService rankings;
    private final CurrentUser currentUser;

    public RankingController(RankingService rankings, CurrentUser currentUser) {
        this.rankings = rankings;
        this.currentUser = currentUser;
    }

    @GetMapping("/api/rankings/me")
    public List<RankingResponse> member(HttpServletRequest request) {
        return rankings.member(currentUser.require(request));
    }

    @GetMapping("/api/admin/rankings")
    public List<RankingResponse> staff(HttpServletRequest request) {
        return rankings.staff(currentUser.require(request));
    }
}
