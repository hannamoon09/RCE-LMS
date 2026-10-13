# Runtime Mock cleanup

Spring Boot sessions and APIs are the only source of operational data. `frontend/src/data/LMSContext.tsx` holds requests, mutation state and per-account API results in memory. It never persists operational data to browser storage. `frontend/src/data/lmsData.ts` contains domain types, labels, formatting and selectors requiring an explicit authenticated user ID. API failures remain errors with retry or session-expiry handling; they do not return sample records.

Current paths use the `frontend/` directory introduced on 2026-10-12. The former browser-backend files below were removed during Phase 1–12. The subsequent production cleanup removes the remaining public sample content and design comparisons. Current validation results are recorded in the [production cleanup audit](production-cleanup-audit.md); the coverage descriptions below do not claim a new completed test run.

## Removed runtime data

- `mockAuth.ts`, demo credentials and browser session identity.
- localStorage state loading, migration, writes and quota-error UI.
- Operational user, assignment, submission, activity and notice fixtures.
- Former `src/data/ranking.ts` and its conflicting browser ranking rules. Rankings now come from the server's PostgreSQL score aggregation.
- IndexedDB file storage and its CRUD/persistence helpers. `SelectedFile` is only a temporary picker type in `lmsData.ts`; bytes upload with the form. Authenticated downloads use temporary object URLs that are revoked when no longer needed.
- `previewStats`, `previewAssignments`, `previewNotices` and `previewFeedback` from `frontend/src/data/landingData.ts`. The public `ProductPreview` retains its layout and Anime.js scroll behavior but describes features without made-up counts, deadlines, student work or feedback.

There are no localStorage, sessionStorage or IndexedDB calls in runtime `frontend/src`. Previously stored browser data is ignored; user-created production records are not imported from it. `uiData.ts` contains static navigation, status labels and date formatting, while `landingData.ts` contains public feature descriptions and decorative network geometry. Neither is a business-data store.

## Prototype and dead-code cleanup

The approved dashboard layout is retained at `/dashboard` in `frontend/src/pages/Dashboard.tsx`, renamed from `DashboardA.tsx`. Removed comparison paths `/prototypes` and `/dashboard/a` through `/dashboard/d` now resolve to the existing page-not-found UI after authentication.

After checking runtime and test references, cleanup removed:

- `DashboardB.tsx`, `DashboardC.tsx`, `DashboardD.tsx`, `DesignSelector.tsx`, `RouteTabs.tsx`, `FocusPanel.tsx` and `useDashboardAnimation.ts`.
- `designOptions`, the comparison-only `NoticeActivity` wrapper, unused layout/appearance props and prototype CSS.
- Unused `Progress`, `Tooltip`, card subcomponents, `useReveal`, `useAnimatedNumber`, `AnimatedNumber`, `isTrack`, `AuthContext.refreshUser` and redundant exports. The unused Tooltip dependency was also removed.

The original logo PNG is retained as a brand source asset and is not emitted in the production bundle. Runtime uses the existing WebP derivatives. Font binaries, upstream attribution and licenses remain because they support real text rendering and license compliance. No demo attachment or mock avatar is shipped.

Assignment, notice and administration lists now distinguish an empty server result from an empty search result. Existing dashboard, submission and ranking empty states remain supported. No new dashboard, ranking algorithm, role, track or authentication mechanism was introduced.

## Development seed and production configuration

`backend/src/main/java/com/rce/lms/user/DevelopmentSeed.java` is explicitly limited to `dev & !test & !prod & !production`. It requires a supplied development password and preserves accounts that already exist. Activating `prod` or `production` prevents the development seed even when `dev` is also present. Production startup does not generate users, assignments, submissions, notices or rankings.

Production profiles require `FILE_STORAGE_PATH`, enable Secure on session and CSRF cookies regardless of the local `SESSION_COOKIE_SECURE` value, disable debug and SQL output, and retain Flyway, Hibernate validation and Session/CSRF security. The first STAFF is explicitly provisioned by a trusted operator using the existing [STAFF provisioning procedure](staff-provisioning.md), never by ordinary application startup.

Cleanup does not reset the normal development or production database. Flyway V1–V7 and existing user records are preserved. See the [audit report](production-cleanup-audit.md) for database-preservation verification and production/build-tool dependency findings.

## Preserved test infrastructure and coverage

- `public`, `workspace-motion`, `lms`: public layout and hero animations, login routing, keyboard/focus, mobile drawer, reduced motion and six viewport widths. Removed comparison paths are checked for the page-not-found UI and absence of design navigation. Public feature panels are checked for absence of former fake records.
- `dashboard-assignments`: upcoming/overdue ordering, submitted exclusions, empty/completed states and real server deadline enforcement.
- `refinement-admin`, `tracks`: editor cancellation, original file bytes, file-only submission, combined filters, track isolation and immutable roles/FIELD. The intentionally forged legacy browser-storage fixture verifies that the application ignores it.
- `rankings`: four-track privacy, ungraded ranks, long lists, lower own ranks and mobile motion. `rankings-api` verifies live score changes after review/resubmission/deactivation.
- `profile-crop-api`: crop assertions use server metadata and authenticated bytes; save-failure injection tests real error UI.
- `profile-api`, `preferences-api`: persistence, errors/retry, password session revocation and per-account settings.
- `data`: small explicit test fixtures exercise pure selectors and notice ordering; no runtime fixture is imported.
- `production-cleanup`: clean browser contexts, initially empty screens and the API-backed learning workflow, including independent browser sessions.

Mock-only `ranking-data.spec.ts` and obsolete browser-state migration tests were removed during Phase 1–12, with server ranking and real API coverage retained. Test-owned fixtures and deliberate network-failure injection remain outside the production bundle.

`frontend/tests/scenario.ts` provisions trusted test STAFF only inside the literal disposable `rce_lms_e2e` database, then uses APIs for members and domain records. Each scenario removes its own rows and files. It never resets a user-supplied database URL. The shared Playwright config runs serially against isolated backend 8081 and Vite 5181; normal development data remains separate. Feature and regression suites use the same setup through `npm --prefix frontend test` from the repository root, or `npm test` inside `frontend/`.
