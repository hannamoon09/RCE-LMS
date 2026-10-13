# Existing frontend inspection and migration gates

This inspection records the React application before backend integration. The existing frontend, rather than the example structure in the request, is the source of truth. The migration must preserve the current page composition and replace persistence one verified feature at a time.

Historical audit: the paths, requirements and test commands below describe the layout at the time of the initial inspection. On 2026-10-12 the user requested a folder split, and the React application, package/configuration files and browser tests moved to `frontend/`. The original root-layout requirement below is retained only as history; it no longer describes the current structure. See [README](../README.md) for current paths and commands.

## Actual repository and runtime

- The React/Vite application is at the repository root; it must remain there.
- `package.json` uses React 19, React Router 7, Vite 7, TypeScript 5, Tailwind 3, Radix primitives, Lucide, and Anime.js 4. No new UI framework is needed.
- `src/App.tsx` defines the public landing/login routes, authenticated LMS routes, staff routes, and retained dashboard prototypes. `ProtectedRoute` already validates return destinations with `safeAuthDestination`.
- The shared shell, page transitions, title/list motion, typography, gradient background, dashboard variants, and responsive layouts already exist.
- `vite.config.ts` originally contains only React and the `@` alias. Same-origin `/api` proxying must be added.
- No root `vercel.json` was present during inspection.
- Tests use Playwright. `playwright.config.ts` starts Vite on port 5180 and runs the legacy demo suite. The initial package scripts contain development, build, and preview commands, but no test script.

## Browser backend and integration boundaries

| Existing code | Actual responsibility | API migration boundary |
| --- | --- | --- |
| `src/auth/mockAuth.ts` | Validates one hardcoded demo account and stores `{ userId: 'hanna' }` in `sessionStorage` under `rce-lms-auth-v1` | Session login, restore, and logout through one API client |
| `src/auth/AuthContext.tsx` | Calls the mock adapter; resolves the session user from LMSContext | Server-returned authenticated user, centrally cleared on HTTP 401 |
| `src/data/LMSContext.tsx` | Reads, migrates, and writes all domain metadata to `localStorage` under `rce-lms-demo-v1`; mutations return synchronous booleans | In-memory API data and asynchronous domain mutations |
| `src/data/lmsData.ts` | Shared types, fixture state, notice fixtures, browser-state validation/migration, and learner projection | Keep useful display types/helpers; retire each fixture only after its server feature passes |
| `src/data/useLearningData.ts` | Selects assignments, submissions, notices, and activity for the fixed `hanna` account | Use the authenticated user's ID and server-scoped collections |
| `src/data/ranking.ts` | Calculates rankings from all browser users and submissions | Server-derived ranking responses with `isMe`; no ranking persistence |
| `src/data/fileStore.ts` | Stores file bytes in IndexedDB `rce-lms-files-v1`, object store `files` | Private server storage and authorized file endpoints |
| `src/hooks/useFileUrl.ts` | Resolves IndexedDB blobs into temporary object URLs | Authorized API file retrieval while retaining image/download presentation |

The original provider order is `LMSProvider → AuthProvider`. AuthContext depends on LMSContext, and many screens independently use `currentUserId = 'hanna'`. Authentication integration must remove this circular source-of-truth problem. Direct fixed-user references also exist in AppShell, SettingsPage, AssignmentEditor, and AdminUsersPage.

## Existing UI contracts

The current display types use lowercase roles (`member`, `staff`) and review states (`pending`, `reviewed`), Korean track labels, and file metadata `{ id?, name, size, type }`. A centralized DTO mapper can translate server enums and metadata without redesigning the views. Notice bodies are currently paragraph arrays, global notices use `track: 'all'`, and their date field is named `date`. Submission content is named `text`, with `files`, nullable `score`, and an empty string for absent feedback.

- **Assignments:** List search and submission filters, detail view, deadline rules, and file-only submission already exist. The editor contains title, description, deadline, difficulty, and optional attachments. It contains no week, progress, task checklist, or track selector.
- **Submission:** The optional memo accepts up to 20,000 characters. A file or memo is required by the existing UX. Resubmission already replaces the prior submission and clears its review. Modal confirmation, busy state, cancellation, and navigation checks should remain.
- **Assignment/file saves:** `AssignmentEditor.save` and `AssignmentSubmitPage.save` currently persist files, synchronously commit metadata, then remove unused files. Server integration must make the enclosing operation asynchronous and atomic, passing retained file IDs and newly selected files; transaction cleanup belongs on the server.
- **FilePicker:** Drag/drop, selected-file removal, duplicate-name feedback, five-file limit, and a 10 MB per-file limit already exist. Allowed extensions are PDF, Markdown, text, ZIP, PNG, JPEG, and WebP. The copy saying files are stored in the current browser must change after server file integration.
- **Profile image:** `ProfileImageEditor` already supports preview, keyboard/pointer panning, zoom, cancellation, and a square crop. It creates a 512 × 512 PNG. Original images must be PNG/JPEG/WebP, at most 5 MB, and at least 256 pixels in both dimensions. Preserve this client editing experience; replace only persistence and revalidate on the server.
- **Account/settings:** Existing editable fields are name and email; student ID and track are read-only. Password change currently performs validation only. Preferences are exactly four booleans: `assignment`, `notice`, `feedback`, and `email`. Saving preferences does not itself implement notification delivery.
- **Notices:** Existing list/detail pages support search, importance, category, author, and global/own-track scope. There is no existing staff notice editor.
- **Admin:** Existing pages cover overview, assignment management, submission review, and student management. Review uses integer scores from 0 to 100 and feedback.

## Policy conflicts to remove at the corresponding phase

These are findings from the original code, not claims that the listed features have already been migrated.

| Original behavior | Required replacement |
| --- | --- |
| Every logged-in user sees the common assignment collection | Backend returns only the authenticated track's assignments |
| Staff student management exposes role promotion/demotion and track reassignment | Staff creates/manages own-track MEMBER accounts only; role and track are not accepted in mutation DTOs |
| Staff submission, student, and ranking screens expose all-track filters | Read-only current-track context; scope enforced by the server |
| Assignment deletion removes related submissions and activities | HTTP 409 when any submission exists; preserve submitted work |
| Ranking includes staff and inactive accounts | Include active MEMBER accounts in the current track only |
| Ungraded members have no rank and null average | Include them with total/average/reviewed count equal to zero and a sequential rank |
| Ranking ties additionally use student ID | Total, average, reviewed count, name, then private user ID; no student ID tie-break |
| Ranking rows expose user IDs | Use `isMe`; internal user IDs stay out of the ranking response |
| Browser-saved profile/settings values act as persistence | Server profile/preferences become the persistent source of truth |

## Test inventory and preservation

Legacy browser tests initialize auth via sessionStorage and frequently seed/read domain state through localStorage. Profile tests also inspect IndexedDB. Those persistence assertions cannot prove an API migration. Existing tests for responsive fit, keyboard access, sidebar behavior, motion, file selection, and image cropping remain valuable.

The most explicit obsolete expectations are role promotion in `tests/lms.spec.ts`; common assignments and track reassignment in `tests/tracks.spec.ts`; staff all-track switching and ungraded null ranks in `tests/rankings.spec.ts`; staff/inactive inclusion and student-ID ties in `tests/ranking-data.spec.ts`; and cross-track filters in `tests/refinement-admin.spec.ts`.

`playwright.api.config.ts` and `tests/auth-api.spec.ts` provide a separate real-backend authentication gate. They do not intercept requests or inject a mock session. `DEV_SEED_PASSWORD` is required from the environment. The existing legacy suite is left unchanged until its corresponding domain is migrated.

## Required phase gates

1. **Bootstrap:** Java 21, Spring Boot 4.1.1, Gradle Wrapper, PostgreSQL, Flyway, health check. Verify real database connectivity and backend build.
2. **Authentication and user:** Backend tests must prove resolved CSRF, pre-login token acquisition, JSON login, SecurityContext/session persistence, token refresh, `/auth/me`, logout, and inactive-account handling. Then connect the existing React form and verify login → dashboard → reload → logout in a real browser. Only then remove mock authentication.
3. **Assignment.**
4. **Submission.**
5. **File storage.**
6. **Admin review and student management.**
7. **Notice.**
8. **Ranking.**
9. **Profile.**
10. **Preferences.**
11. **Remaining mock cleanup.**
12. **Deployment hardening.**

For every domain after authentication, repeat migration/entity → service/API → backend test → existing frontend integration → actual browser verification → removal of only the corresponding mock. Keep unimplemented domain fixtures visible and documented rather than claiming a complete service prematurely. Do not broaden implementation before the first authentication slice works end to end.
