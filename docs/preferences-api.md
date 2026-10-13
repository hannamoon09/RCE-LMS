# Notification preferences API

Both routes require an active authenticated session and return `Cache-Control: no-store`. The current user comes from the session; MEMBER and STAFF manage only their own preferences.

| Method | Route | Request | Response |
| --- | --- | --- | --- |
| GET | `/api/me/preferences` | None | The four current preferences |
| PATCH | `/api/me/preferences` | JSON containing all four booleans | The four saved preferences |

The exact response shape and initial defaults are:

```json
{
  "assignment": true,
  "notice": true,
  "feedback": true,
  "email": false
}
```

`PATCH` requires a valid `X-XSRF-TOKEN` header and all four literal JSON boolean values. Missing fields, nulls, strings such as `"true"`, numeric values, arrays, objects and unknown fields return 400 `INVALID_REQUEST` without changing the existing preferences. There is no `userId`, role or track input. Query parameters cannot change the authenticated user or preference ownership.

V7 creates `user_preferences` with `user_id` as its primary key and a foreign key to `users`. Each setting is a non-null boolean. A GET for an account without a stored row returns the defaults without inserting data. PATCH locks the user row, rechecks the active flag and credential version, and inserts or replaces that account's single preferences row. Concurrent initial saves are serialized on the user row; each request commits all four settings together. Preferences persist across sessions and browsers without sharing settings between accounts.

These endpoints persist notification choices. They do not send email or implement a notification delivery service.

Backend verification: `PreferencesIntegrationTest` passed all seven PostgreSQL integration tests. Coverage includes default responses without writes, MEMBER/STAFF persistence across sessions, ownership isolation, strict request validation with no partial updates, authentication/CSRF/session revocation, concurrent first saves, and the user-lock credential/active recheck. The focused Gradle test/build command completed successfully in 11 seconds with zero failures or errors. Frontend integration and browser verification are tracked separately in `implementation-progress.md`.
