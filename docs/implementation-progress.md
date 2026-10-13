# Implementation progress

This file records verified migration gates so interrupted work can resume without repeating completed work. See `frontend-inspection.md` for the original application audit.

Except for the dated folder-split entry, the gates below are historical results completed before 2026-10-12. Their original commands and paths describe that earlier layout; frontend sources, package/configuration files, tests and generated output now live under `frontend/`. Use `npm --prefix frontend …` from the repository root, or the original npm commands inside `frontend/`. Shared scripts, `.env`, Compose and backend paths remain at the repository root. See the current [README](../README.md) for execution instructions.

| Gate | Verified result |
| --- | --- |
| Existing frontend inspection | Complete: router, auth, browser stores, domain pages, types, tests and Vite inspected |
| Baseline frontend build | `npm run build` PASS |
| Baseline browser suite | Original 75 Playwright tests PASS before API integration |
| Local tools | Java 21, Gradle Wrapper 9.5.1, Docker running |
| Backend bootstrap | PASS: Boot 4.1.1, Java 21, PostgreSQL 17.11 Compose, Flyway, validate-only Hibernate, health check and Gradle build |
| Auth API | PASS: 10 PostgreSQL integration tests (7 auth, 2 session boundary, 1 bootstrap); Gradle test/build |
| Existing login → dashboard API verification | PASS: 7 actual browser/API tests; member/staff login, reload, logout, return paths and mobile verified; screenshots in verification/; mockAuth removed after verification |
| Assignment | PASS: 6 PostgreSQL tests, build, 3 real browser/API tests; existing editor/list/detail CRUD connected; screenshots in verification/ |
| Submission | PASS: 8 PostgreSQL tests (24 total), 3 actual browser/API tests, frontend build; own submission persistence, full review reset, concurrent upsert and deletion protection |
| Files | PASS: 44 total backend tests/build, frontend build, 3 actual API/browser tests; existing pickers use multipart saves, file-only submission/reload/retention and authenticated downloads verified; screenshots in verification/; profile IndexedDB retained until Profile phase |
| Admin review + student management | PASS: 59 backend tests covered/build, frontend build and 3 API/browser cases. Review filters, score/feedback, resubmission reset, member create/edit/password reset/login/deactivation and mobile verified. Initial mobile measurement was changed to retry after resize; only that test reran and passed. Read-only FIELD, no role/track selectors; server users/reviews are not persisted in browser storage |
| Notice | PASS: 6 PostgreSQL tests/build (65 tests covered), frontend build and 3 actual API/browser tests (56.3s, recovered completed session without rerun). Existing list/detail plus own-track STAFF create/edit/delete, member desktop/mobile reading, authorization and error/retry verified; screenshots in verification/; runtime notice fixtures removed |
| Ranking | PASS: 7 PostgreSQL tests/build (72 tests covered), frontend build and 3 actual API/browser tests. Recovered passed Playwright record and all three ranking screenshots after interruption; no duplicate run. Privacy-safe server rankings include active ungraded members; dashboard/profile/mobile and resubmission/review/deactivation refresh verified. No runtime ranking fixture calculation remains |
| Profile | PASS: 8 new PostgreSQL tests (80 covered), 18 affected auth/admin/session regression tests and build; frontend build plus 10 actual browser cases. Existing crop/type/keyboard/drag/mobile tests migrated to real server files; profile/email/password persistence and old-session revocation verified. One password redirect conflict fixed and only that test rerun (PASS). Screenshots preserved; IndexedDB persistence removed |
| Preferences | PASS: 7 PostgreSQL tests/build (87 covered), frontend build and 2 real browser tests (17.1s). Existing four switches persist across sessions per account; load/save failures retain retry/draft, mobile verified. Actual notification delivery is outside this scope |
| Mock cleanup | PASS: no operational browser storage/fixtures remain. Original responsive, keyboard, motion, crop and domain regression tests now use real API scenarios. Full 90-case browser suite passed (6.8m); frontend build passed |
| Final backend regression | PASS: all 89 PostgreSQL/unit tests, zero failures/errors/skips; Gradle test/build successful (48s). Includes strict 72-byte BCrypt login/current-password boundary checks |
| Deployment hardening | PASS: private Vite paths blocked; additional security + 3 file regressions passed (18.7s), final frontend build passed (2.66s), environment initialization preserves secrets/0600 and existing files, HTTPS Nginx syntax verified with temporary certificate. Total verified browser cases: 91 (90 full + 1 added) |
| Live local smoke | PASS: current backend8080 and Vite5173 running; MEMBER/STAFF CSRF/login/current-user/domain reads/no-store/logout verified through proxy |
| Browser test isolation | PASS: dedicated rce_lms_e2e database, backend8081 + Vite5181; isolated auth smoke passed |
| Final documentation (2026-10-08) | Complete: README execution/test/deployment instructions, preserved UI design notes, trusted STAFF provisioning procedure and requirement-by-requirement implementation report. Prior successful suites retained without rerun; local proxied health remains UP |
| Frontend/backend folder split (2026-10-12) | PASS: frontend build (2.50s), backend bootJar (UP-TO-DATE), and 17 related browser/API regressions (37.5s: auth 7, dashboard 4, data 2, file 3, security 1). All 182 frontend source/public files retain identical content hashes. Existing root `.env` preserved by setup:dev; restarted development/preview servers and proxied health at localhost:5173 verified UP. README, current path references and deployment static root updated. Earlier full 89-backend/91-browser results remain historical and were not rerun for this folder-only change |

No production deployment has been performed. Development secrets are generated locally in the ignored `.env`; they are not committed.

## Production cleanup audit — 2026-10-13

Complete. Removed unused dashboard comparison routes/components and fabricated landing data while retaining the final UI, motion and crop behavior. Business data remains API-only; useful test fixtures and development seed are isolated. Production profiles exclude development seed even when combined with dev and enforce Secure cookies, debug/SQL logging off and an explicit private file path. Environment file exclusions now cover `.env.*` except `.env.example`.

- Frontend TypeScript/Vite build PASS (2.58s).
- Backend: 94 distinct tests verified. The initial full run passed the existing 89 tests and four profile cases. After correcting a test assumption about CSRF cookie reissuance, all five production/restart cases and Gradle build passed (21s); existing passed tests were not repeated.
- Browser: 93 distinct cases verified. Preserved 15 passes from the interrupted suite and two focused clean-browser/error cases. Resumed only the remaining 76 cases, all PASS (6.0m).
- The Docker connectivity interruption did not change the persistent development volume. Nine development tables, including six users and one assignment, retain their original row fingerprints. All seven Flyway files retain their original SHA-256 hashes. The live development backend was restarted and its real session/API smoke check passed.
- Actual local secret value scan and production bundle/test-isolation checks PASS. Runtime npm audit: zero warnings. Seven build-tool dependency warnings remain documented; source-map-js was patched to 1.2.2 without changing the UI framework.

See [the final audit report](production-cleanup-audit.md) and [machine-readable verification results](verification/production-cleanup-results.json) for evidence and retained development/test code. External production deployment has not been performed.

## Real-user MVP E2E — 2026-10-13

Complete: 13/13 phases, READY FOR PRIVATE BETA within the isolated local QA scope. No blocking product bugs found; no product features or design changes.

- 99 distinct Playwright cases passed in this task: authentication 8, new real-user lifecycle 1, new security 4, empty/error 2, remaining regression 84 (6.8 minutes). Completed cases were retained without repeating them.
- Real UI flow: STAFF creates WEB students, attached assignment, text/file and mobile file-only submission, scores 92/80, feedback/ranking, replacement-file resubmission resets all review fields and removes old files/score, mobile re-review96 and fresh mobile context restore.
- Server checks passed: forged role/track, actual foreign IDs, peer file access, invalid title/score/file, inactive login and old-session replay after reactivation/logout.
- Frontend build PASS (2.57s), explicit new Playwright TypeScript check PASS, backend94 tests and build PASS (49s). An initial test discovery failure from duplicate ignored generated class files was resolved by Gradle clean; no product-code fix was needed. Scenario's fixture ID set was explicitly typed as Set<string>.
- Development DB row fingerprints (9 tables, 6 users, 1 assignment) and 7 migration hashes unchanged. After test servers stopped, only dedicated rce_lms_e2e fixture rows and 16 dedicated test upload files were cleared; migration history retained.

See [MVP E2E report](mvp-e2e-report.md) and [case-level evidence](verification/mvp-e2e-results.json). Production deployment, load testing and non-Chromium browsers were not part of this run.
