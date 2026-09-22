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

Retained AI sources currently consume slots until removed. A safe orphan-file cleanup workflow remains needed before broad beta. Never delete solely because a file lacks an attachment row: uploads and active AI jobs can temporarily be unregistered. Per-account limits do not bound total project usage when signup is unrestricted; enrollment controls and provider usage alerts remain launch requirements.
