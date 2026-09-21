# Account deletion

Deployed to the development Supabase project. Disposable Free and Stripe-test Pro account deletion passed on September 21; live queries confirmed database/file cleanup, and Stripe showed the mapped test subscription canceled. See `LIVE_SETUP.md`. Settings checks for the server function and migration before enabling deletion. Free and Pro accounts use the same flow. Never use the owner's account for acceptance testing.

The user enters their password and types `DELETE`. Password verification uses an isolated, nonpersistent Supabase Auth session. Only that session's bearer token is sent to the Edge Function. The function verifies the exact token through Auth, then requires a password AMR timestamp within five minutes and the matching subject. It ignores supplied owner IDs and derives the profile from the verified user.

Deletion marks the account as pending under a database row lock. Existing AI jobs and billing leases must finish first; abandoned AI work expires after ten minutes. Insert/update triggers serialize new application and private-file writes with that marker, including service-role AI results. Reads remain available for signing in and retrying. Deletion requests use a two-minute lease to prevent duplicate workers.

For an account with a billing mapping, the function verifies the dedicated test customer's metadata and deletes that customer first. Stripe cancels its active subscriptions immediately and prevents subsequent subscription creation through old checkout/portal sessions. No refund is issued. A failed or ambiguous cancellation stops deletion; a retry recognizes an already-deleted customer. Live Stripe keys remain rejected by this build.

Next, a server-only RPC lists at most 100 owned `study-files` paths per batch, including unattached files and retained AI inputs. The Storage API removes their bytes. Auth deletion runs only after the inventory is empty, then foreign keys cascade through all application rows. The frontend clears its local session. Old tokens cannot resolve a profile or access its study data. Other accounts are untouched.

## Deployment

1. Save a fresh private backup of the application data and important attachments. The historical application JSON is not a full Auth/Storage backup.
2. In the connected project's SQL editor, apply **only** `supabase/migrations/20260916000000_account_deletion.sql`. It adds the deletion state, guards and server-only RPCs; it deletes no accounts. The two earlier migrations were already applied manually. Do not replay them or use an unreconciled `supabase db push`.
3. Run `node scripts/build-edge-bundles.mjs`. It prepares single-file dashboard modules under ignored `dist-edge/`. Update `pro-service` and `stripe-webhook` using their respective `index.ts` bundles, then create/deploy `delete-account` using its bundle. Deploy to project `nqrkcxigvlwfxpzolrhv` only. Keep gateway JWT verification off as in `supabase/config.toml`: the handlers independently authenticate users or Stripe signatures. No new secrets are needed.
4. Reload Settings at the configured origin, currently `http://127.0.0.1:5173/`. The delete button becomes available after its status request succeeds. Do not click it on an account you intend to keep.
5. Complete the disposable-account checks below. Record results in `LIVE_SETUP.md` before treating deletion as launch-ready.

If using an authenticated Supabase CLI instead of the dashboard, deploy the three named functions individually with the explicit project ref after step 2. Schema deployment remains separate because the existing migration history has not been reconciled.

## Disposable-account acceptance checks

- Register and confirm a new test email, add a note and attached file, then download an export. Keep a second test account signed in elsewhere with its own note/file.
- Wrong password and confirmation text other than `DELETE` must not delete anything. Logging out or switching accounts during password verification must stop submission.
- Delete the disposable Free account. Verify its Auth entry, application rows and `study-files` prefix are gone; login fails; the other account's materials still load.
- Repeat using a separate disposable Pro account with a **test** subscription. Verify Stripe cancellation/customer deletion and that an old checkout/portal link cannot start another subscription. Redelivered Stripe events must not recreate the account.
- In an isolated test project, simulate a Storage failure after cancellation. Verify the login remains, editing/new AI/checkout are blocked, and retry finishes without another subscription. Do not deliberately break shared production credentials.
- Verify recovery after closing the tab mid-request: a completed deletion stays deleted; an incomplete one can be resumed by signing in and opening Settings. Do not infer completion from a network error alone.

## Limits and operations

This is a resumable request flow, not a background deletion queue. A request processes at most 20 batches and checks a 40-second work budget between batches. Large accounts or provider failures may require another explicit attempt with password confirmation. A crashed lease expires after two minutes. Keep a support procedure for requests users cannot finish; never clear the deletion marker to reactivate a partially removed account.

Stripe retains historical transaction records; provider logs and backups have separate retention. Downloaded exports are outside StudyHive's control. A customer creation racing deletion before its mapping is saved can leave an empty Stripe customer with the numeric profile metadata; mapping guards prevent it gaining a StudyHive subscription. Operational reconciliation of unmapped customers is still needed before public billing launch.

## References

- [Supabase JWT claims](https://supabase.com/docs/guides/auth/jwt-fields): password AMR timestamp is distinct from token refresh time.
- [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data): remove Storage objects before Auth deletion; access tokens may outlive the Auth record.
- [Stripe customer deletion](https://docs.stripe.com/api/customers/delete): immediate subscription cancellation, no future operations on the deleted customer, historical record remains retrievable.
