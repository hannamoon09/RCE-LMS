# Notice API

`GET /api/notices` returns global notices (`track: null`) and notices matching the authenticated user's current track. Both MEMBER and STAFF can read these notices. Query parameters never broaden that scope. Results are ordered by important first, creation time descending, then ID ascending. `GET /api/notices/{id}` returns a matching notice; missing and other-track IDs both return 404 `NOTICE_NOT_FOUND`.

STAFF mutation endpoints are `POST /api/admin/notices` (201), `PATCH /api/admin/notices/{id}` (200), and `DELETE /api/admin/notices/{id}` (204). They require CSRF and affect only notices in the STAFF's track. Global notices and other-track notices are immutable through these routes and return 404. MEMBER mutation requests return 403.

The complete create/edit payload is `{title, body, category, important}`. All four fields are required. Title is limited to 120 characters, body to 20,000, and category to 50; text cannot be blank. `important` is a boolean. Unknown properties, including `track`, `author`, IDs and timestamps, are rejected. The server assigns track and author from the current STAFF. Editing preserves the original author and creation time.

The response is `{id, title, body, category, important, track, author, createdAt, updatedAt}`. Body is plain text; the existing frontend can split blank lines into paragraph arrays and map `createdAt` to its display `date`. `author` is the display name. Track is `null`, `WEB`, `PWN`, `REVERSING`, or `FORENSICS`.

V5 creates the notice table and scope/order index. Global notices may already exist or be provisioned separately; no ordinary STAFF endpoint creates or modifies them. This migration does not seed notices or copy browser demo fixtures into production data.

The existing React list/detail screens now use the authenticated, abort-aware Notice cache. STAFF can create or change only notices belonging to its own track; global notices have no editing controls. The UI preserves search, important filtering, paragraph layout and mobile styling. Loading and error/retry display inside the existing application shell. Server notices never enter localStorage, and `selectLearningData` no longer reads notice fixtures at runtime.

Phase 7 verification completed: frontend build PASS and all three `frontend/tests/notice-api.spec.ts` cases PASS (56.3s). The final result was recovered from the completed tool session after interruption, without rerunning finished tests. Tests covered own-track API scope and forged-field rejection, STAFF UI create/edit/delete and MEMBER reading on desktop/mobile, and a transient error followed by successful real-server retry. Screenshots: `verification/notice-staff-detail.png` and `verification/notice-member-mobile.png`.

Verification results above record the original feature migration. Browser test paths reflect the 2026-10-12 move into `frontend/`; the path update does not indicate a new test run.
