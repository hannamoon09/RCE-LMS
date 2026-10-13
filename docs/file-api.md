# Private files

Assignment POST/PATCH and submission POST support `multipart/form-data`. Send one `data` part with `Content-Type: application/json`, and zero to five repeated `files` parts. Assignment data contains `title`, `description`, `difficulty`, `deadline`, and optional `retainedFileIds`. Submission data contains optional `content` and `retainedFileIds`.

`retainedFileIds` defaults to an empty list and can contain only unique IDs already attached to that exact assignment or the current member's submission. The combined retained/new file count cannot exceed five. File-only submissions are accepted; both content and files cannot be empty. JSON assignment edits preserve existing attachments; JSON submission resubmissions clear them.

Responses expose only `{ id, name, size, type }` metadata. `GET /api/files/{id}` requires an active authenticated session. Assignment attachments are available within the assignment's track; submission files are available only to their owner or same-track STAFF. Unauthorized IDs return 404. Downloads use accurate canonical MIME, `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, and `Cache-Control: no-store`.

Files are stored outside the web root using UUID keys through `FileStorage` / `LocalFileStorage`. Attachments allow PDF, UTF-8 MD/TXT, ZIP, PNG, JPEG, and WebP, up to 10 MiB each. The backend checks names, path traversal, extension, declared MIME and signatures; text rejects malformed UTF-8 and NUL. HTML and SVG are not allowed. Neither disk paths nor storage keys are returned to clients.

Replacement validates all new files, saves their bytes, then executes a database transaction that serializes on the assignment row. Failed database work cleans up newly saved bytes. Old-file cleanup jobs are inserted in the metadata transaction, then physical deletion runs after commit. Failed deletions are logged and retained in `file_cleanup_jobs`; a scheduled worker retries every minute. Cleanup failures cannot reverse an already committed submission. Storage and database volumes must be backed up together.

The existing React assignment and submission editors save selected files with the same multipart request as the form data. Existing metadata becomes `retainedFileIds`; new `File` objects remain in component state until save. The shared API client supplies session cookies and CSRF headers without setting the multipart boundary manually. Domain files are no longer written to IndexedDB.

`FileList` fetches authenticated downloads on demand and displays server errors beside the file. Temporary object URLs are revoked after download or component unmount. The profile image editor and avatar's IndexedDB helpers remain in place for their later migration phase.

Phase 5 verification: frontend build PASS and `scripts/e2e-test.sh tests/file-api.spec.ts` PASS (3 tests) using Java 21 and the isolated database. Screenshots: `verification/file-only-submission-detail.png` and `verification/file-resubmission-editor.png`.
