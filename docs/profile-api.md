# Profile API

All profile routes require an active authenticated session. Writes require the `X-XSRF-TOKEN` header, and all responses use `Cache-Control: no-store`. Identity is always taken from the session; profile requests cannot select another user.

| Method | Route | Body | Result |
| --- | --- | --- | --- |
| GET | `/api/me` | — | Canonical user response |
| PATCH | `/api/me` | JSON `{ name, email? }` | Updated user response |
| POST | `/api/me/profile-image` | Multipart, exactly one `file` part | Updated user response |
| DELETE | `/api/me/profile-image` | — | User response with `profileImage: null` |
| PATCH | `/api/me/password` | JSON `{ currentPassword, newPassword }` | 204, current session logged out |

The profile form requires a nonblank name of at most 100 characters, saved without surrounding whitespace. Email is optional, at most 254 characters and must be a valid email address when supplied. Null, omitted or whitespace-only email clears it. These are full profile-form updates; a name is required even when changing only email. Unknown fields are rejected with 400 `INVALID_REQUEST`, including `id`, `studentId`, `role`, `track`, `active`, `profileImage`, `passwordHash` and `credentialVersion`.

`UserResponse` is shared by `/api/me`, `/api/auth/me`, login and staff user management. It contains `id`, `studentId`, `name`, `email`, `role`, `track`, `active`, `joinedAt` and `profileImage`. An image is either null or public metadata `{ id, name, size, type }`; storage paths and storage keys are never exposed.

Profile images are limited to 5 MiB and decoded PNG/JPEG images with square dimensions from 256 through 4096 pixels. The existing frontend crop output is a 512×512 PNG. The shared validator checks file name, extension, declared MIME, signature and decoded dimensions. Empty files, paths, SVG/HTML, malformed images, non-square images, mismatched MIME and duplicate uploads are rejected. Browsers download the bytes through authenticated `GET /api/files/{id}` and create temporary object URLs for display.

Profile file downloads are available to the owner or another authenticated user in the same track. The file must still be the owner's currently linked profile image; removed, replaced, detached and out-of-track IDs return 404. Downloads retain the common private-file headers: `Content-Disposition: attachment`, canonical content type, `X-Content-Type-Options: nosniff`, and `Cache-Control: no-store`.

V6 adds `profile_files` metadata, a foreign key from `users.profile_image`, and `users.credential_version`. Profile image changes lock the user row, save validated bytes outside the web root, commit the new metadata and link, then delete old bytes through the durable cleanup queue. Failed database writes remove newly stored bytes. Image deletion is idempotent. Replacing or deleting one user's profile never affects another user's image.

Password changes validate the current password and apply the shared policy: at least eight characters, not whitespace-only, and at most 72 UTF-8 bytes. A wrong current password returns 400 `CURRENT_PASSWORD_INCORRECT`; reusing it returns 400 `PASSWORD_UNCHANGED`. Validation failures preserve the existing password and session. Successful changes persist a new password hash and increment `credential_version` before clearing the current session and its cookies. Every existing session is checked against that version before CSRF/authorization on its next request. Staff password resets increment the same version, so old member sessions are also revoked. Password hashes and versions are never returned to the frontend.

Backend verification: `ProfileIntegrationTest` passed all eight PostgreSQL integration tests covering profile persistence and validation, canonical image metadata, private image access, replacement/deletion and physical cleanup, rejected uploads, successful/failed self password changes, and staff reset session revocation. The affected `AdminUserIntegrationTest`, `AuthIntegrationTest`, and `SessionBoundaryIntegrationTest` also passed (26 focused tests total), followed by a successful Gradle build. Frontend integration and browser verification are tracked separately in `implementation-progress.md`.

Frontend verification: the existing account/profile/crop UI now uses these endpoints. Account forms support optional email, server errors and retry; password changes return to login with a success notice. Auth session generations reject responses from an earlier login/logout and refresh responses cannot overwrite a newer profile update. Avatar downloads use authorized blobs with request cancellation and object-URL cleanup. The original pointer drag, keyboard movement, zoom, reset, cancel and 512×512 PNG crop output remain intact.

Ten actual API/browser cases passed: three account/password cases and seven migrated crop/activity cases. They cover server persistence, immutable identity fields, optional email, failure/retry, PNG/JPEG/WebP input, size/dimension rejection, crop pixel output, authenticated/track-scoped downloads, image replacement/deletion, reload/navigation, URL revocation, mobile geometry, pointer/keyboard controls and old-session invalidation. The initial password success redirect race was repaired; its focused rerun passed, as did the production frontend build. Screenshots are saved in `docs/verification/profile-settings-mobile.png`, `profile-crop-mobile.png` and `profile-mobile.png`.

The IndexedDB blob persistence implementation was removed after this browser gate. The later final mock cleanup also removed `fileStore.ts`; the in-memory `SelectedFile` picker type now lives in `frontend/src/data/lmsData.ts`. No account or profile image state is stored in browser storage. The verification results above record the original profile migration; frontend paths moved under `frontend/` on 2026-10-12.
