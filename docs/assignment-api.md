# Assignment API contract

Phase 3 preserves the existing editor and `Low` / `Medium` / `High` difficulty values.

- `GET /api/assignments`: authenticated user's track, newest created first.
- `GET /api/assignments/{id}`: own-track detail; absent and other-track IDs return 404.
- `GET /api/admin/assignments`: STAFF's own track. Track query parameters never broaden scope.
- `POST /api/admin/assignments`: STAFF only; 201.
- `PATCH /api/admin/assignments/{id}`: STAFF's own track only; complete editor payload; 200.
- `DELETE /api/admin/assignments/{id}`: STAFF's own track only; 204.

Create/update JSON is `{title, description, difficulty, deadline}`. The title is required and at most 120 characters; description is required and at most 20,000 characters. Deadline is a required ISO-8601 instant. New assignments require a future deadline; past deadlines remain editable. Unknown properties, including `targetTrack`, `author`, and `id`, are rejected. The authenticated STAFF supplies author and track automatically. Editing preserves original author and creation time.

Responses are `{id, title, description, difficulty, deadline, author, attachments, createdAt, updatedAt}`. `author` is the author's display name. `attachments` is an empty array until the file-storage phase. All requests use the existing session; mutations require the existing CSRF cookie/header flow.

The V2 migration creates `assignments`, its author foreign key, and a track/created-time index. Update/delete acquire an assignment row write lock. The V3 submission migration adds a restricting foreign key. Assignment deletion checks submission existence under the same lock used by submission creation and returns `409 ASSIGNMENT_HAS_SUBMISSIONS` when submitted work exists. No cascade delete is introduced.
