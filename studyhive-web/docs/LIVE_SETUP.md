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

The verified cloud foundation was pushed to GitHub as `5adbe6c` on September 14. The Pro implementation is tracked separately; see the September 14 deployment record below. Do not publish `.env.local`, historical desktop releases or generated build output.

## Pro backend deployment — September 14

- Saved and parsed a local JSON snapshot of all 12 existing application tables before migration. It contains 16 notes and two classes and is kept outside source control in Downloads as `StudyHive-application-backup-20260914.json`. This is an application-data snapshot, not a full PostgreSQL/Auth/Storage disaster-recovery backup.
- Applied only `20260914000000_pro_services.sql` through the SQL editor after exact clipboard comparison with the tested source. Supabase reported success; a separate read verified all four new tables have RLS, billing data is unreadable by authenticated clients, quota updates are protected, reservation RPC execution is server-only, and anonymous scheduled review is denied. Existing note/class counts remained 16/2.
- Deployed `pro-service` and `stripe-webhook` through the dashboard from bundles of the committed TypeScript source. Each bundle was compared exactly before deployment. Disabled the legacy JWT gateway check as specified by `supabase/config.toml`; handlers retain verified Supabase Auth and Stripe HMAC authentication respectively.
- Saved `APP_ORIGIN=http://127.0.0.1:5173`. No provider keys were available or saved. AI allowance remains zero.
- Live HTTP checks passed: allowed preflight 200, missing token 401, forged token 401, foreign origin 403, and unconfigured webhook 503. These checks made no provider calls.
- Stripe and OpenAI account sign-in, test price/portal/webhook setup, private server-key entry, explicit model selection, test allowance and end-to-end provider checks remain pending. Real payments remain disabled by the deployed code.

Both SQL migrations were applied manually; neither should be replayed through a CLI push without first reconciling migration history.

## Stripe sandbox configuration — September 15

- Confirmed the owner signed in to Stripe's StudyHive sandbox and OpenAI. OpenAI lists an active `StudyHiveTest` key; its full value was not retrieved.
- Created active sandbox product `prod_VGSswWpHRZ5cxC` (StudyHive Pro (Test)) with recurring price `price_1UFvwG5a48H6cFVpNUivJeGF`: USD 10/year. This is provisional test pricing, not a launch commitment. Saved the Price ID in Supabase as `STRIPE_PRICE_ID`.
- Saved the default sandbox customer portal configuration `bpc_1UFvyS5a48H6cFVply435v69`. Cancellation is enabled at the end of the billing period; collecting a cancellation reason is disabled.
- Created active webhook `we_1UFw2M5a48H6cFVp9v7vd4AP` to `https://nqrkcxigvlwfxpzolrhv.supabase.co/functions/v1/stripe-webhook`, scoped to the sandbox account and exactly six events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
- The webhook uses snapshot payloads with stable dashboard API version `2026-08-26.dahlia`; the dashboard offered only that version and a preview. The handler reads event type/customer and independently retrieves current subscriptions using its pinned `2025-06-30.basil` API version. End-to-end compatibility still needs validation.
- Saved `OPENAI_MODEL=gpt-4.1-mini-2025-04-14` as the initial evaluation model. [Official model documentation](https://developers.openai.com/api/docs/models/gpt-4.1-mini) confirms Responses, image inputs and structured outputs support. No generation or cost/quality evaluation has run.
- Pending: private entry of `OPENAI_API_KEY`, `STRIPE_SECRET_KEY` (sandbox `sk_test_` key), and `STRIPE_WEBHOOK_SECRET` (this destination's `whsec_` signing secret) in Supabase Edge Function Secrets. Their values have not been copied into code, chat, or the repository. The webhook is created but cannot process events until its secrets are configured.
- AI allowance remains zero; no paid provider call or real payment was made. Provider spending controls, a test allowance, and end-to-end checkout/portal/AI tests remain necessary.

### Private credential-entry handoff

Open [Supabase Edge Function Secrets](https://supabase.com/dashboard/project/nqrkcxigvlwfxpzolrhv/functions/secrets). Add and save the three pending keys there, using **Add another** for additional rows. Do not paste their values into chat.

The Stripe sandbox key is under [API keys](https://dashboard.stripe.com/acct_1UFvrq5a48H6cFVp/test/apikeys). The signing secret is in [StudyHive Pro test webhook](https://dashboard.stripe.com/acct_1UFvrq5a48H6cFVp/test/workbench/webhooks/we_1UFw2M5a48H6cFVp9v7vd4AP). Use the full saved OpenAI StudyHive key; if it is no longer available, create a replacement privately in [OpenAI API keys](https://platform.openai.com/api-keys).

## Server secrets saved — September 15

The owner entered `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` privately in Supabase. The dashboard confirms all six required configuration names are present; secret values were not revealed or copied. Live endpoint checks now return 400 for missing Stripe signatures, 400 for a forged signature, and 401 for missing StudyHive login tokens. This verifies the webhook reads a signing secret and rejects those invalid requests; it does not establish that the stored secret matches Stripe or that either provider API key is valid.

The in-app test browser is signed out of StudyHive. Authenticated test checkout, a real signed sandbox webhook delivery, portal access, and AI generation remain pending. Stripe's Send test events control offered CLI instructions rather than a dashboard event sender; no fixture was submitted. AI allowance remains zero and no paid provider request has run.

## Sandbox checkout and return handling — September 15

- Signed in to the owner's StudyHive account and opened authenticated Stripe Checkout. The page displayed the expected StudyHive sandbox product and USD 10/year recurring test price.
- Submitted Stripe's documented fake test card with synthetic contact details. Checkout completed and returned to `http://127.0.0.1:5173/?billing=success`. No real card or payment was used. The returned dashboard still showed Free Plan and 16 notes; webhook delivery and the refreshed server entitlement have not yet been verified.
- Fixed the return flow to open the membership panel after authentication, read the server-owned entitlement, and retry up to six times at two-second intervals while activation is pending. A success URL never grants Pro. After those checks, the panel offers manual refresh and explains that another checkout is unnecessary. Closing the panel removes only the billing query parameter.
- Replaced the transient false "Checkout is not configured" message with an explicit loading state. Late responses after unmount or an account change are ignored. Updated the cloud dashboard's outdated Premium Demo copy to describe Pro.
- All 68 automated tests and the production build passed, including five new membership loading, delayed activation, retry, sign-out and forged-return regression checks. Live browser controls were unavailable during the follow-up, so actual signed webhook delivery, refreshed Pro activation and customer portal access still need verification. AI allowance remains zero; no paid AI request has run.

### Follow-up: generic Pro request failure

The owner supplied a screenshot showing Free Plan and "Pro services are not available yet. Please try again later." A live unauthenticated CORS preflight to `pro-service` returned 200 with the expected exact allowed origin `http://127.0.0.1:5173`; this does not verify the authenticated request or webhook. The browser's actual URL and request failure are still needed.

Regression tests reproduced two client issues: gateway HTTP errors and browser transport failures were reduced to the same generic message, and a rejected billing-info request discarded a successful profile read. The client now distinguishes transport failures and HTTP statuses, preserves actionable backend errors, and keeps the server-confirmed membership even when billing-info fails. Five new tests were added; all 73 tests and the production build passed. This fixes error reporting and membership refresh isolation, but the original live request failure and webhook activation remain unverified. No entitlement, server secret, CORS policy or AI allowance was changed.

## Pro activation confirmed and AI test round prepared

The owner identified the failing browser origin as `http://localhost:4173/`. Switching to the configured `http://127.0.0.1:5173/` resolved the Pro request error after the stopped dev server was restarted and its HTTP 200 response verified. Stripe's delivery screenshot then showed HTTP 400, `Invalid webhook signature`. After instructions to replace the destination signing secret in Supabase and resend the event, the owner reported **premium**. This is user confirmation of activation; the final Stripe delivery status was not independently inspected. Portal testing remains pending.

The owner authorized a small AI acceptance-test round with up to **USD 1** of OpenAI API usage. Prepared matching, visually checked one-page PDF and Word documents plus a TXT sample, three invalid-file fixtures, a six-generation checklist, and guarded SQL to enable/disable the test allowance. The SQL was checked locally and all six mocked Edge Function tests passed without paid calls. See `AI_TEST_CHECKLIST.md`.

The allowance change has **not** been applied remotely: dashboard control and authenticated Supabase administration are unavailable in the current tools. The owner must run the prepared development SQL in the Supabase SQL editor and confirm `0 / 6` in StudyHive. Six successful generations is a per-user monthly allowance, not a hard dollar cap. No live OpenAI request or paid AI test has run; actual usage and results remain to be recorded. Use only the small fixtures, stop on the first provider error, and disable new generations after the round.

## Test allowance enabled — September 16

The owner's screenshot confirms the enable query returned `test_allowance = 6`. A subsequent run stopped at the guard because AI attempts already exist this month. This later failure does not undo the first successful run, and does not establish whether those attempts succeeded, failed or incurred provider charges. Their results and actual spending remain unverified; do not rerun or bypass the enable guard.

Fixed a membership navigation bug reported during testing: the Dashboard's upgrade banner was hidden for Premium users, removing their access to the Pro panel. Cloud accounts now retain the banner with **Manage Pro** for active members, and Settings has a permanent **Membership & AI usage** button. The production build passed and the local server returned HTTP 200. No server configuration, entitlement or usage record was changed by this UI fix.

## AI test feedback and data export — September 16

The owner reported that the features seemed to work. An OpenAI Usage screenshot showed six requests, 3,190 tokens and displayed spend of $0.00 with both Default project and StudyHive selected. This is not an isolated StudyHive cost measurement or proof that each checklist item passed. The owner was asked to filter to StudyHive and disable the development allowance after the round; shutdown has not been confirmed.

Added **Settings → Export your study data** for all cloud plans. The download includes saved study data and registered attachment contents, uses verified account identity plus existing RLS, paginates table reads, and rejects partial failures or account changes. Its JSON format and 50 MB limit are documented in `DATA_EXPORT.md`. It needs no migration or paid API call. All 82 automated tests and the production build passed; the owner subsequently confirmed the browser download worked. Account deletion, automated restore, large-account export and the other public-launch work remain separate tasks.


## Account deletion prepared — September 16

Implemented the Settings confirmation/password flow, server-verified recent-password authentication, a durable deletion marker and write guards, billing cancellation, private-file cleanup and Auth deletion last. New SQL is additive and deletes no accounts when applied. Deletion remains disabled until the new function and migration pass the status check. See `ACCOUNT_DELETION.md` for deployment order, retry limitations and disposable-account checks. Dashboard-ready bundles can be built with `node scripts/build-edge-bundles.mjs`.

Validation: 88 Node/React/PostgreSQL tests and 12 mocked Edge Function tests passed, including actual migration/RLS/cascade behavior, wrong-password and account-switch rejection, cancellation/storage failure handling and retry. Production build and Deno type checks passed. No owner account was deleted, no subscription was canceled, and no live provider test call was made. The new migration/functions have **not been deployed**: this session has no authenticated Supabase deployment tool or browser control. Hosted Auth/Storage/Stripe acceptance checks remain pending.
