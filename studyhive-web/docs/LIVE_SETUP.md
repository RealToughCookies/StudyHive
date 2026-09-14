# Connected development backend — September 10, 2026

StudyHive is connected locally to the Supabase project `nqrkcxigvlwfxpzolrhv` in the StudyHive free-plan organization. Its project URL and publishable key are in the ignored `.env.local` file. No secret/service-role key or database password was copied into the app.

## Applied and verified

- Applied `20260909000000_cloud_foundation.sql` through the Supabase SQL editor to the empty project. The staged SQL statements were compared with the tested migration, ignoring whitespace and ordering of independent statements.
- Verified 12 application tables, all with row-level security; no anonymous table read grants; private `study-files` bucket with a 10 MB file limit; account trigger and both application RPCs present.
- Confirmed email/password sign-in and email confirmation enabled; anonymous sign-in disabled.
- Saved and visually verified minimum password length 12. Secure email change and secure password change are enabled; requiring the old password for recovery remains disabled.
- Saved Site URL `http://127.0.0.1:5173/` and four exact redirect URLs: the root and `?auth=recovery` URLs for both `127.0.0.1:5173` and `localhost:5173`.
- Live unauthenticated Supabase client requests for users, notes and settings returned HTTP 401 with PostgreSQL permission error `42501`.
- The live transaction-only two-account isolation check passed: account/profile initialization, owner access, blocked cross-account reads and updates, blocked forged ownership, protected Pro entitlement and blocked Free quiz creation. The SQL result confirmed all temporary test rows were rolled back; no test accounts or notes remain.
- All 54 automated tests passed. Production build passed with the connected configuration.
- Visually checked the cloud sign-in screen and navigated to the recovery and sign-up forms. Adjusted the primary account-form button spacing.

## Remaining verification

A real StudyHive account has been created and email-verified (confirmed in the live database on September 11). Sign-in, restored sessions, password-reset email delivery, private uploads and multiple-device behavior still need an authenticated browser check. Supabase dashboard access is a separate account from a StudyHive user account.

## Local note recovery — September 11

Recovered 12 existing notes from the owner's Safari database at `http://localhost:4173`; the same database was absent at `http://localhost:5173`. Saved a JSON backup through Safari Downloads before importing. Imported the notes and their two related classes into the owner's matched cloud account in one transaction, preserving exact titles, HTML content, timestamps and class links. The import checked all 12 records before committing; a separate post-commit query confirmed 12 notes and two linked classes. The original browser data and downloaded backup remain unchanged. No attachments were present in the old account. Temporary recovery pages were removed after completion; no recovered content belongs in source control.

## Deployment notes

The app is running locally; it has not been publicly hosted. Production SMTP, the final HTTPS domain and its redirect allowlist, billing and server AI still need setup. No paid plan or SMTP provider was activated.

The migration was applied manually and is not registered in Supabase CLI migration history. **Do not rerun the initial migration on this project.** When adopting the CLI deployment workflow, inspect the remote schema and reconcile migration history before pushing additional migrations.

Local cloud-foundation source changes have not yet been pushed to GitHub. Do not publish `.env.local`, historical desktop releases or generated build output.
