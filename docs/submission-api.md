# Submission API contract

All three learner endpoints require an active, authenticated MEMBER. STAFF receives 403.

- `GET /api/submissions/me`: current MEMBER's submissions in their current track, latest submitted first.
- `GET /api/assignments/{id}/submission`: current MEMBER's submission; 404 `SUBMISSION_NOT_FOUND` if none exists.
- `POST /api/assignments/{id}/submission`: JSON `{content?: string}`; returns 200 for both initial submission and resubmission.

Response: `{id, assignmentId, userId, content, status, score, feedback, submittedAt, reviewedAt, reviewedBy, files}`. Status is uppercase `PENDING` or `REVIEWED`. Review fields and content can be null. Files are `[]` until the file-storage phase. Client identity, assignment, and review fields are not accepted in the request body. The authenticated user owns the submission; query parameters never change that ownership.

Content is optional in the DTO and limited to 20,000 characters. Phase 4 has no file endpoint, so a submission with absent or blank content returns 400 `EMPTY_SUBMISSION`. Phase 5 must extend this validation to allow file-only submissions while rejecting a submission containing neither text nor files.

The assignment must belong to the current user's track; foreign and absent assignment IDs return 404 `ASSIGNMENT_NOT_FOUND`. POST also validates the deadline against server time after acquiring the assignment row write lock; passed deadlines return 409 `ASSIGNMENT_CLOSED`. Reads continue working after a deadline.

Each `(user_id, assignment_id)` pair is unique in PostgreSQL. Every resubmission retains the submission ID, sets `submittedAt` to now, resets status to `PENDING`, and clears score, feedback, reviewedAt, and reviewedBy. Assignment row locking serializes competing submissions and assignment deletion. A restricting database foreign key additionally prevents deletion of any assignment containing a submission. The application returns 409 `ASSIGNMENT_HAS_SUBMISSIONS`; submitted work is never cascade-deleted.

The entity review transition is present for subsequent admin integration. No admin review endpoint is introduced in Phase 4.
