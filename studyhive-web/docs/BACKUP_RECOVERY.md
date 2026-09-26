# Backup and recovery before public launch

Status (2026-09-26): an encrypted operator archive exists locally (676,182 bytes). The owner reported successful archive integrity verification, including one Storage file. An isolated restore drill and off-site copy remain incomplete. No recovery-time or recovery-point guarantee has been established.

## What must be recoverable

- Database schema, application rows, Auth data and ownership relationships.
- Every private Storage object, with its original path and a checksum of the actual bytes.
- Deployment source and a separate private inventory of Auth redirects, CAPTCHA/SMTP configuration, provider settings and secret locations. Secrets and backups never belong in Git.
- A record of account deletions since the snapshot so restoration does not silently resurrect deleted accounts. Stripe remains the authority for current subscription state after a restore.

The current Free project needs an operator-managed backup process. Supabase recommends regular CLI dumps and off-site copies for Free projects. Database backups contain Storage metadata, not uploaded file contents. [Supabase backup documentation](https://supabase.com/docs/guides/platform/backups).

## First restore drill

Target selected by owner: `llhttvndnusoalbcvfzr` (StudyHive Restore test), confirmed healthy in the dashboard on 2026-09-26. Session pooler: `aws-0-ca-central-1.pooler.supabase.com:5432`, database `postgres`, user `postgres.llhttvndnusoalbcvfzr`. Production `nqrkcxigvlwfxpzolrhv` must never be a restore destination. No restore has run.

Before constructing the restore selection, inspect the actual encrypted archive locally:

```sh
python3 /Users/nathanieleades/StudyHive-complete/scripts/backup.py inspect "$HOME/StudyHive-backups/StudyHive-20260926.tar.age"
```

This requests the archive passphrase, rechecks integrity, and writes a new `.restore-inventory.txt` beside the archive with `pg_restore --list` output. It makes no database connection and exports no row contents. The report must be reviewed for managed-schema compatibility before an import command is prepared. It refuses to overwrite an existing report.

The September 26 report was reviewed: PostgreSQL 17.6 source, pg_dump 18.6 custom archive, 854 TOC entries. `scripts/restore_drill.py` selects 296 entries for the database stage: public objects/data/grants/RLS, Auth users and identities, the custom signup trigger, Storage buckets and application Storage policies. Managed schema definitions, managed roles/default grants, old sessions and transient login links are not imported. Nonempty persistent Auth features outside email/password, Vault secrets, and additional Storage features stop the script before import. The target's TLS certificate/hostname were verified without credentials. Nineteen backup/restore unit tests pass; this is not evidence of a successful live import.

```sh
python3 /Users/nathanieleades/StudyHive-complete/scripts/restore_drill.py "$HOME/StudyHive-backups/StudyHive-20260926.tar.age"
```

This database stage is pinned to the test project, rejects a nonempty target, runs in one transaction, and checks table counts, identity ownership and application RLS before commit. Enter the archive passphrase and the **test project's** database password privately. A generated `.database-restore.json` reports only aggregate counts and stage status. File bytes, Storage quota/cleanup triggers, login/app behavior and cross-account access must still be restored/checked in subsequent stages. The test project must remain disconnected from the production frontend, external SMTP, Edge Functions, billing webhooks and AI credentials. Do not declare the drill complete on the database-stage message alone.

1. Select a private encrypted backup destination and an isolated restore project. Have the owner supply required credentials privately; do not reset the production database password just to obtain access.
2. Quiesce writes during the initial capture, or implement a documented reconciliation process for database/file changes during capture. Record the capture interval and Git revision. Make database exports using the current [Supabase CLI backup/restore procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), explicitly checking the included Auth data and roles. Copy private file bytes separately and record counts, sizes and SHA-256 checksums.
3. Restore into the isolated project only. Do not point the public frontend, SMTP delivery, live Stripe webhooks or paid AI at it. Review account-deletion records before enabling access.
4. Check table counts and relationships, run `storage_health.sql`, and download restored files to compare checksums. Account for file-usage triggers when importing both historical counters and Storage objects; blindly loading counters and then uploading bytes can double-count usage.
5. Verify a disposable user's sign-in, note contents, attachments, export and cross-account denial. Recovery is not proven merely because SQL imported successfully.
6. Record actual data loss, restore duration, mismatches and remaining issues. Choose backup frequency, retention, off-site storage and failure alerts based on the measured recovery needs. Schedule only after the owner approves an operational policy and destination.

The Settings JSON export is useful for recovering an individual's study content and registered attachment bytes. It excludes Auth credentials, server settings and unregistered uploads, and has no automatic app restore workflow. It does not substitute for this disaster-recovery drill. See `DATA_EXPORT.md`.

## Prepared operator capture tool — 2026-09-23

`scripts/backup.py` is a read-only native PostgreSQL/Storage capture tool pinned to the existing StudyHive project and its verified session-pooler host. Installed prerequisites on the owner's Mac: PostgreSQL client tools 18.6 (`libpq`) and age 1.3.2. The tool has thirteen passing tests, including actual age encryption/decryption and altered-ciphertext rejection using synthetic data. The owner completed capture and reported archive integrity verification on September 26. An isolated database restore is NOT completed.

Run it yourself in a normal terminal once credentials are available:

```sh
python3 /Users/nathanieleades/StudyHive-complete/scripts/backup.py capture "$HOME/StudyHive-backups/StudyHive-20260923.tar.age"
python3 /Users/nathanieleades/StudyHive-complete/scripts/backup.py verify "$HOME/StudyHive-backups/StudyHive-20260923.tar.age"
```

Use a fresh filename for each capture. Pause edits and uploads on every device first. The private prompts request the database password, the project's `service_role` key (for file downloads only), and an archive passphrase chosen through age. Save the archive passphrase in your password manager. Do not paste any credential into chat, source files or shell commands. The script has no upload, deletion, database update or remote restore operation.

The archive contains a native custom-format `pg_dump`, roles without role passwords, its table-of-contents listing, migration sources, every inventoried Storage object's bytes, and a manifest of byte lengths and SHA-256 hashes. Downloads use TLS and reject redirects. Database access uses verified TLS and read-only sessions. Required Auth/application/Storage data entries must exist in the dump. Missing files, size changes, inventory changes and failed commands stop capture; it never silently skips unreadable data. The archive verifier checks decryption authentication and every inventoried file. It does not prove the database can be restored.

Temporary plaintext is staged with owner-only permissions beside the encrypted archive, then removed on normal completion/error. Use a trusted encrypted disk; a forced process termination can leave the private staging directory behind. Keep backups outside the repository. A partial encrypted file is deliberately not labelled successful. Copy a completed, verified archive to the chosen private off-site destination before calling the off-site backup requirement complete.

This native archive is not an automatic Supabase-to-Supabase migration recipe: managed schemas, existing roles, extensions, platform versions, encrypted Auth/Vault fields and encryption-root requirements must be checked against the current provider restore procedure in an isolated target. No database password reset, service-role key rotation, new project, production write or off-site upload has been performed. Provider settings, secret values and deletion events occurring after capture require separate recovery records. Continue the restore drill above after capture succeeds.

Run the tool's tests with `npm run test:backup`. They use synthetic files and a temporary age identity, make no network requests, and do not use real credentials.

## Database certificate correction — 2026-09-26

The session pooler uses Supabase Root 2021 CA, which is not in the local system trust store. The capture tool now uses `supabase/certs/prod-ca-2021.crt` with `sslmode=verify-full`. The public CA was downloaded over HTTPS from the link in the authenticated project's Database Settings → SSL configuration:
https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

Certificate SHA-256 fingerprint: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`. Valid through April 26, 2031. A credential-free live TLS handshake passed certificate and hostname verification. This does not verify the database password or complete a backup. Twelve backup tests pass, including CA selection and failure before credential entry when the CA file is absent.

Follow [Supabase's SSL instructions](https://supabase.com/docs/guides/platform/ssl-enforcement) when rotating the CA; do not disable certificate verification. To check the password privately:

```sh
/opt/homebrew/opt/libpq/bin/psql "host=aws-0-us-west-2.pooler.supabase.com port=5432 dbname=postgres user=postgres.nqrkcxigvlwfxpzolrhv sslmode=verify-full sslrootcert=/Users/nathanieleades/StudyHive-complete/supabase/certs/prod-ca-2021.crt connect_timeout=20" -X -W -c "SELECT 1 AS connected;"
```

## Database-stage result and file-stage handoff — 2026-09-26

The local database-stage report confirms target `llhttvndnusoalbcvfzr`, archive SHA-256 `7102d2986625bce170882d128b3459acdec0a06d2de70971cb305acc23454c9e`, and a committed database import with matching selected table counts: 4 Auth users, 4 identities, 4 profiles, 21 notes, 1 Storage bucket, and 0 attachment records. Thus this snapshot's single uploaded file is not a registered note attachment. Full recovery is still unproven.

Prepared file-stage command (not yet run):

```sh
python3 /Users/nathanieleades/StudyHive-complete/scripts/restore_files.py "$HOME/StudyHive-backups/StudyHive-20260926.tar.age"
```

Private prompts request the archive passphrase, test database password and test project's legacy service_role key. The script rejects a production-project key before any HTTP request. It verifies the database-stage report/archive binding and unchanged row counts, requires private buckets, uploads only missing archive paths without overwrites, downloads each file to check SHA-256/size, checks Storage inventory/counters/ownership/attachment health, and restores the three archived application Storage triggers after uploads. Archived counters therefore are not incremented twice. Existing matching files can be verified after an interrupted upload; unexpected or mismatching files require review. If trigger installation succeeds but report writing fails, stop for review rather than rerunning database restore.

Storage API recreation preserves paths and bytes, but generates new object IDs, owner metadata and timestamps. StudyHive associates ownership/attachments through paths. This drill must not claim exact metadata recovery or historical cleanup timing. The file-stage report retains `full_restore_passed: false`; sign-in, note content, file access, exports and cross-account denial remain pending. No Edge Functions, production frontend, SMTP, billing webhooks or AI keys should be connected to the test project. Twenty-four backup/restore unit tests pass; live file restoration is pending.

## File-stage result and isolated preview — 2026-09-26

The local report confirms file stage passed: one file checksum matched, all Storage paths matched, stored/counted files both 1, five anomaly counts all zero, and three Storage protection triggers verified. Auth/app acceptance and full restore remain pending.

`python3 scripts/start_restore_preview.py` launches the restore-only frontend at `http://127.0.0.1:5174/`, bound to loopback. Its separate Vite configuration disables dotenv loading and the launcher replaces all inherited VITE variables with the test project's public connection settings. Production `.env.local` is unchanged. The page title/footer explicitly identify RESTORE TEST. Its login page was verified in the browser. The target has no deployed billing/AI Edge Functions. Use the restored account password for sign-in, not the database password. Verify note contents, reload persistence, export, file access and cross-account denial before updating full restore status. No browser login credentials or tokens should be copied into logs/reports.

## App acceptance and read isolation — 2026-09-26

The owner reported restored sign-in, note contents and refresh checks looked good. Browser inspection independently confirmed a signed-in Nate dashboard with 21 notes, 10 flashcards and 6 focus sessions against the restore-test preview. Settings displayed 1/25 files stored. The export UI reported `Download started: 66 records and 0 attached files`; the resulting new export file has not been located/parsed, so download completion remains unverified.

The read-only `supabase/operations/restore_isolation_check.sql` assertions passed in the test project's SQL editor (query `eceeab87-d1e5-402b-92ab-73e36e39740e`). The check iterates confirmed restored accounts, simulates their authenticated claims, checks own-row counts and absence of foreign rows across 13 application tables, checks profile and file-metadata isolation, and checks anonymous denial for notes and Storage metadata. At least two confirmed accounts are required for success. Transaction rolled back; no application rows were modified. This verifies database read policies with simulated claims, not signed-JWT hostile API writes or a comprehensive security audit.

Database import, file-byte verification, restored owner login/notes, and database read-isolation checks have passed. Remaining drill evidence: confirm the downloaded export is a complete readable JSON file; no registered attachment existed in the snapshot, so attachment round-trip is not established by this snapshot. Full platform disaster recovery (provider configuration/secrets, SMTP, Edge Functions, billing reconciliation), off-site backup and operational recovery guarantees remain outside this completed database/file exercise. Keep these limits explicit when reporting readiness.
