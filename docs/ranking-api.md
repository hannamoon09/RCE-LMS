# Ranking API

`GET /api/rankings/me` is MEMBER-only. `GET /api/admin/rankings` is STAFF-only. Both derive the track from the authenticated account and return `Cache-Control: no-store`.

Each row contains exactly `rank`, `name`, `totalScore`, `averageScore`, `reviewedCount`, and `isMe`. No account UUID, student ID, email, or storage fields are returned. Only active MEMBER accounts in the current track participate, including members with no reviewed submissions (zero total, average, and count).

Only REVIEWED submissions with a non-null score for assignments in the same track contribute. Ordering is total descending, unrounded average descending, reviewed count descending, name ascending, then internal user UUID ascending. Rows receive sequential ranks starting at one. No ranking table exists.

The existing ranking, dashboard summary and profile statistics use the same server result. Submission, review and member mutations refresh that result without unmounting the current editor. Background failures retain the previous result and offer a retry. Resubmission removes the previous review score until reviewed again.

Verification: 7 PostgreSQL integration tests and 3 real API/browser scenarios passed. Desktop/member/staff and mobile screenshots are in `docs/verification/ranking-*.png`. The interrupted browser run's completed `test-results/api/.last-run.json` and its three screenshots were recovered on 2026-10-06 without rerunning completed work.
