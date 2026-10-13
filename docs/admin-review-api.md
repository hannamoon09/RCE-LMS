# Admin review API

- `GET /api/admin/submissions?assignmentId={UUID}&status=PENDING|REVIEWED` returns a `SubmissionResponse[]`. Both filters are optional. Results always belong to the authenticated STAFF's track, ordered by submitted time descending and ID ascending. A foreign or absent assignment filter returns 404; invalid status or ID returns 400. Track query parameters never broaden access.
- `PATCH /api/admin/submissions/{id}/review` accepts `{score, feedback?}` and returns the updated `SubmissionResponse`. Score is a required integer from 0 through 100. Feedback is optional and limited to 20,000 characters. Blank feedback is stored as null. Fractional scores are rejected without truncation. Unknown body fields, including status, reviewer, user, assignment, content and files, are rejected.

Only active STAFF can use these routes. Another track's submission and missing IDs both return 404 `SUBMISSION_NOT_FOUND`. Mutations require the existing CSRF cookie and header.

Review sets `REVIEWED`, score, feedback, reviewedAt and the authenticated reviewer's ID. Re-review is permitted. Original content, submission time, ownership and attachments remain intact. Deadline expiration does not prevent staff review. A later member resubmission clears all review fields and returns to `PENDING`.

Review first resolves only the submission's assignment ID within the staff track, acquires the assignment row write lock, and then loads the submission entity. Submission, file replacement and review therefore serialize on the same row; the review never caches a stale submission before waiting for concurrent resubmission. The existing score and review-state database constraints still apply.
