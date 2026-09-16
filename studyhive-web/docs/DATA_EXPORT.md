# Study data export

Cloud users on either plan can choose **Settings → Export your study data → Download study data**. The browser prepares a JSON file and starts a download. No AI generation, billing action, privileged key, migration or new server endpoint is involved.

The export contains the saved profile, classes, notes, flashcard decks/cards, quizzes/attempts, focus sessions, preferences, attachment records, sticky notes, reminders, spaced repetition schedules and AI job history. Registered note attachments are included as base64 bytes, once per storage path; original names and note links are in `tables.note_attachments`.

Authentication credentials, provider keys, Stripe billing records, server configuration and temporary/unattached AI uploads are excluded. User-visible columns are explicitly selected; future table columns are not automatically added to the export.

## Format

- `format`: `studyhive-study-data`
- `version`: `1`
- `started_at`, `exported_at`: UTC timestamps bounding collection
- `scope`: limitations of this export
- `tables`: arrays keyed by table name, including a one-row `users` array
- `files`: objects with `path`, `content_type`, `size`, `encoding: "base64"`, and `data`

Rich-text notes retain their saved HTML, and quiz fields retain their stored representation. The JSON preserves IDs and relationships. Consumers must treat all content as untrusted; do not render raw exported HTML without sanitization. There is no automatic import/restore workflow yet, and this is not a full Auth/Storage/PostgreSQL disaster-recovery backup.

## Boundaries

All queries run under the user's existing Supabase session and RLS, with an additional explicit owner filter. The service verifies the authenticated user and profile, and stops if the app signs out or changes account, even if it later signs back into the same account. Leaving Settings cancels collection and prevents a download. Pending editor saves must succeed before collection begins.

Table reads use primary-key pagination (20 rows per page; `card_id` for review schedules) and continue until an empty page, so a lower server page limit cannot silently truncate exports. A table error, missing attachment, invalid path or size-limit failure prevents the entire download. Attachment reads are private and restricted to the current profile's storage prefix.

The browser export is limited to 50 MB of JSON and existing 10 MB-per-file attachment limits. Large accounts need a future streamed/background export. Reads occur over an interval rather than a single database snapshot; pause edits on other devices during collection. Unregistered or already deleted source files cannot be recovered through this export.

## Verification

Tests cover multiple pages with a smaller server response cap, Free-account access, exact attachment bytes, selected-column privacy, missing-file failure, traversal/foreign file paths, cancellation, logout/login invalidation, size limits, authentication/profile mismatch and failed table requests. A PostgreSQL test verifies every selected field exists in the real migrations and applies owner isolation under the authenticated database role.

Manual acceptance: download from Settings, confirm the browser saves a JSON file, check `format`/`version` and note counts, and verify a known attachment's original bytes. Keep downloaded personal exports out of source control. Browser download acceptance remains a user check when browser-control tools are unavailable.
