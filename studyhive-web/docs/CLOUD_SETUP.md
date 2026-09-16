# Connect StudyHive to Supabase

The source supports a Supabase-backed workspace. A development project is now connected; see [LIVE_SETUP.md](LIVE_SETUP.md) for applied settings and remaining checks. The instructions below are for creating another fresh project, not rerunning the migration on the connected project.

## Create and configure the project

1. Create a new Supabase project under your own account. Keep its database password and all secret keys private.
2. In the project's SQL editor, run the complete file `supabase/migrations/20260909000000_cloud_foundation.sql` once. It is intended for a fresh project, before creating accounts. It creates private application tables, the account initialization trigger, narrow transaction functions and the private `study-files` bucket. The SQL transaction rolls back if any statement fails.
3. Enable email/password authentication and **Confirm email**. Set the provider's minimum password length to **12** so direct API requests obey the same minimum as the form. Study data also requires a confirmed email at the database layer.
4. Set the Auth Site URL to your app's address. For local development, allow both `http://localhost:5173/` and `http://localhost:5173/?auth=recovery` as redirect URLs. When deploying, add the exact HTTPS equivalents including any path prefix. Keep the default confirmation/reset email links that honor `RedirectTo`; do not replace them with a hardcoded Site URL.
5. Configure SMTP for real users before launch. Supabase's default email service is for testing and has delivery/recipient limits. Enable and validate appropriate Auth rate limits and abuse protection for launch; CAPTCHA requires a corresponding client integration before enabling it.
6. Copy `.env.example` to `.env.local`. Fill in the project URL and its **publishable** key (`sb_publishable_…`) from the project settings. Use `VITE_DATA_MODE=cloud`. Restart Vite after changing these values.

```sh
npm ci
npm run dev
```

Only the URL and publishable key belong in frontend configuration. Authorization comes from the signed-in user's access token plus database and storage policies. Secret/service-role keys bypass these protections and must never be included in browser code.

The app uses PKCE. Open confirmation and recovery email links in the **same browser and device** that requested them. Starting a second email flow can invalidate the first link's verifier; request a fresh link if necessary. Successful sign-in persists the session. Signing out clears the current browser's session and workspace state.

References: [password authentication](https://supabase.com/docs/guides/auth/passwords), [PKCE and its browser requirement](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), [storage policies](https://supabase.com/docs/guides/storage/security/access-control).

## Data behavior

- Notes, classes, decks/cards, reminders, sticky notes, preferences, completed timers and study history use account-scoped cloud operations. Data is fetched again when opening a feature or reloading; this phase does not implement live collaborative editing or offline cloud edits.
- Notes use a revision check: a stale device cannot silently overwrite newer saved text. Keep a copy of a conflicted edit before reloading it. Navigation and sign-out wait for pending note saves and stay on the editor if saving fails.
- Attachments are private, downloaded with the user's authenticated session, and limited to 10 MB each. Accepted types: PDF, DOCX, TXT, PNG, JPEG, GIF and WebP. Attachment storage is implemented; extracting documents into AI notes belongs to the Pro stage.
- Profiles and subscription fields are read-only for browser clients. The database denies free users quiz creation and spaced-repetition activation. The UI does not sell subscriptions or run included AI yet. Do not manually grant production Pro as a substitute for billing.
- Local workspaces remain in their original IndexedDB stores. Switching modes does not import, erase or sync them. Migration/import is still to be implemented.

## Local demo without a service account

Put `VITE_DATA_MODE=local` in `.env.local` and run `npm run dev`. This explicitly enables the previous browser-only app, including its local sign-in and demo subscription feature. Keep it separate from public cloud deployment. Missing or invalid cloud configuration produces a setup error instead of silently switching users to local accounts.

## Validation and remaining launch work

`npm test` runs existing regressions plus the real migration against embedded PostgreSQL (PGlite), exercising policies as separate authenticated identities. Supabase-owned Auth and Storage infrastructure is represented by minimal test tables/functions. This proves application SQL behavior, not hosted email delivery or the Storage service's upload validation.

After connecting a project, verify with two test accounts and a second browser: verification links, reload/session restoration, sign-out, password reset and expired links; persistence across devices; direct attempts to read/write the other account's IDs/files; competing note edits; and attachment upload/download. Check production redirects on the actual host.

Before accepting public users, finish subscriptions/server AI, local import, account deletion, abuse controls, per-account storage limits, orphan-file cleanup, backups, monitoring and privacy/terms. Configure the host's security headers and HTTPS. Clearing an account in the Auth dashboard cascades database rows; private storage objects still require server-side cleanup. Do not expose an account-deletion button until that cleanup workflow exists.


Study data export is available to both cloud plans in Settings, including saved tables and registered attachment bytes. See `DATA_EXPORT.md` for its 50 MB limit, format, and snapshot/restore limitations.
