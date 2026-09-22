# Backup and recovery before public launch

Status: a historical application snapshot and user export exist, but a full backup and isolated restore drill have not been completed. No recovery-time or recovery-point guarantee has been established.

## What must be recoverable

- Database schema, application rows, Auth data and ownership relationships.
- Every private Storage object, with its original path and a checksum of the actual bytes.
- Deployment source and a separate private inventory of Auth redirects, CAPTCHA/SMTP configuration, provider settings and secret locations. Secrets and backups never belong in Git.
- A record of account deletions since the snapshot so restoration does not silently resurrect deleted accounts. Stripe remains the authority for current subscription state after a restore.

The current Free project needs an operator-managed backup process. Supabase recommends regular CLI dumps and off-site copies for Free projects. Database backups contain Storage metadata, not uploaded file contents. [Supabase backup documentation](https://supabase.com/docs/guides/platform/backups).

## First restore drill

1. Select a private encrypted backup destination and an isolated restore project. Have the owner supply required credentials privately; do not reset the production database password just to obtain access.
2. Quiesce writes during the initial capture, or implement a documented reconciliation process for database/file changes during capture. Record the capture interval and Git revision. Make database exports using the current [Supabase CLI backup/restore procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), explicitly checking the included Auth data and roles. Copy private file bytes separately and record counts, sizes and SHA-256 checksums.
3. Restore into the isolated project only. Do not point the public frontend, SMTP delivery, live Stripe webhooks or paid AI at it. Review account-deletion records before enabling access.
4. Check table counts and relationships, run `storage_health.sql`, and download restored files to compare checksums. Account for file-usage triggers when importing both historical counters and Storage objects; blindly loading counters and then uploading bytes can double-count usage.
5. Verify a disposable user's sign-in, note contents, attachments, export and cross-account denial. Recovery is not proven merely because SQL imported successfully.
6. Record actual data loss, restore duration, mismatches and remaining issues. Choose backup frequency, retention, off-site storage and failure alerts based on the measured recovery needs. Schedule only after the owner approves an operational policy and destination.

The Settings JSON export is useful for recovering an individual's study content and registered attachment bytes. It excludes Auth credentials, server settings and unregistered uploads, and has no automatic app restore workflow. It does not substitute for this disaster-recovery drill. See `DATA_EXPORT.md`.
