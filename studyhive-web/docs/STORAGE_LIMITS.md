# Beta file capacity

Implemented in `20260922000000_storage_limits.sql`; not yet applied to the hosted database.

Free accounts may retain 25 files; active Pro accounts may retain 100. The existing bucket limit remains 10 MiB per file (the AI form accepts 2 MiB). Thus retained object capacity is bounded at 250 MiB / 1,000 MiB per account, not a promise of pooled byte-based storage. Small and empty files count too. These are adjustable beta defaults, not final paid-plan commitments.

All `study-files` objects count, including unregistered attachments and retained AI sources. A private counter is updated transactionally by a Storage metadata trigger. Conditional atomic increments serialize concurrent inserts; failed transactions roll back increments. Metadata updates do not count twice. Cross-owner/bucket moves are rejected. Deletion releases a slot through the normal Storage API. Clients cannot edit counters. An authenticated, owner-scoped RPC supplies Settings usage.

Existing files are inventoried under a table lock. Existing over-limit accounts and expired Pro accounts keep download and deletion access; new uploads fail until below their current limit. No stored objects are deleted by this migration. Do not delete `storage.objects` rows manually: removing metadata does not remove the underlying bytes. [Supabase Storage schema](https://supabase.com/docs/guides/storage/schema/design).

## Deployment

1. Take a current database backup. The previous migrations were manually applied; do not replay them or use an unreconciled `db push`.
2. Apply only `20260922000000_storage_limits.sql`. It briefly locks Storage metadata writes while backfilling counters. No Edge Function redeployment is required.
3. Deploy the frontend with the Settings file-usage panel after the RPC exists.
4. Using a disposable account, test upload/download/removal, quota rejection, and a pair of simultaneous uploads at the last slot through the actual Storage API. Also test AI cleanup, then compare `file_usage.file_count` with a grouped inventory from `storage.objects`.

Local tests execute the real migrations in PGlite and cover backfill, Free/Pro/expired limits, direct client writes, rollback, deletion capacity, metadata changes, ownership moves and account deletion. PGlite does not verify independent PostgreSQL sessions or Storage's physical-byte cleanup after rejected uploads; the hosted concurrency/cleanup checks remain required.

## Remaining storage work

Retained AI sources currently consume slots until removed. Owner-requested cleanup is now implemented below; its migration/function deployment and hosted verification are pending. Never delete solely because a file lacks an attachment row: uploads and active AI jobs can temporarily be unregistered. Per-account limits do not bound total project usage when signup is unrestricted; enrollment controls and provider usage alerts remain launch requirements.

## Owner-requested unused-upload cleanup (coded; deployment pending)

Settings now offers a separate confirmation before permanently removing unused uploads older than 24 hours. Cleanup retains every object referenced by a saved note attachment and runs for both plans. It refuses to proceed while the owner has a recent pending AI job. It processes at most 50 files per request; retry for further batches or after partial failures.

Apply `20260922010000_upload_cleanup.sql` after the capacity migration, then redeploy `pro-service` and the frontend. The migration itself removes no files. A verified user ID from the function is passed to a server-only inventory RPC, which locks the account while marking candidates. Attachment registration takes a compatible account lock and rejects marked files. Persistent retirement records prevent reused paths from being removed by overlapping cleanup retries. Files are removed through the Storage API, never SQL metadata deletion. Byte removal triggers capacity release. Retirement records cascade with account deletion.

This is deliberate owner-requested cleanup, not an automatic scheduled deletion job. Active browser uploads under 24 hours are preserved. Generated notes are independent of temporary AI sources and remain. A paused attachment save older than 24 hours may lose its unregistered source to a user-requested cleanup; its later registration fails clearly and requires a new upload.

Verify through real Storage: old unused files disappear, saved attachments still download, failed removals can retry, and quota counts match actual inventory. Do not run cleanup against the owner's private workspace just to test it; use disposable fixtures. Scheduled cleanup, provider storage reconciliation and a global project budget remain operational follow-ups.
