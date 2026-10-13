# Track-scoped administration

All routes require active STAFF authentication and CSRF on mutations. The server selects the authenticated STAFF's track; request DTOs do not accept role, track, reviewer, or user IDs. Another track's IDs and STAFF accounts are not manageable through student endpoints.

| Method | Route | Body / filters |
| --- | --- | --- |
| GET | `/api/admin/users` | Own-track MEMBER accounts, including inactive accounts |
| POST | `/api/admin/users` | `{ name, studentId, initialPassword }` → 201 canonical User DTO |
| PATCH | `/api/admin/users/{id}` | Any of `{ name, active, newPassword }` → updated User DTO |
| GET | `/api/admin/submissions` | Optional `assignmentId` and `status=PENDING\|REVIEWED` |
| PATCH | `/api/admin/submissions/{id}/review` | `{ score, feedback? }` → updated Submission DTO |

Creation always sets `role=MEMBER` and `track=authenticatedStaff.track`. Student ID is unique and immutable; role promotion/demotion and track movement are not exposed. Names are trimmed and limited to 100 characters. Passwords must contain at least eight characters, cannot be blank, and are limited to 72 UTF-8 bytes for BCrypt. Passwords are encoded on the server and never included in responses. Duplicate student IDs return 409 `STUDENT_ID_EXISTS`.

Deactivation blocks both future logins and the next request using an existing session. A disabled session is invalidated. React's common API client handles its 401 response centrally.

Review accepts an integer score from 0 through 100 and optional feedback up to 20,000 characters. It sets REVIEWED, reviewedAt, and reviewedBy on the server while preserving the submission's content, files, and submittedAt. The service obtains only the assignment ID first, locks that assignment, then loads the current submission. This serializes review with resubmission and prevents an old entity snapshot from overwriting newer content. Resubmission clears the complete review as before.

The existing Admin pages now use server data. STAFF loads its own-track member roster and submissions; MEMBER only loads its own submissions and authenticated profile. Loading/error/retry remain inside the existing application shell. The sidebar and all Admin pages show a read-only FIELD context, and student management exposes create, name/password editing, and active status without role promotion or track reassignment controls. The account editor follows the existing modal/table/mobile-card design.

Frontend build PASS. The three cases in `frontend/tests/admin-api.spec.ts` passed across the initial run and a focused rerun of the mobile resize assertion. They cover review filtering and persistence, member score/feedback display, complete review reset on resubmission, account creation/editing/password reset and real login, active-session invalidation after deactivation, and responsive layouts. Preserved QA screenshots: `verification/admin-member-editor.png` and `verification/admin-members-mobile.png`.

Verification results above record the original feature migration. Browser test paths reflect the 2026-10-12 move into `frontend/`; the path update does not indicate a new test run.
