# Pro implementation and test setup

The Pro migration and both Edge Functions were deployed to the connected Supabase project on September 14, 2026. **Provider credentials are still missing, so checkout and AI generation are not enabled.** Checkout and webhooks accept Stripe test mode only. The AI allowance defaults to zero. No subscription price is hardcoded or publicly promised.

## Included

- Authenticated Supabase Edge Functions for checkout, billing portal and AI generation. Secrets stay on the server. `APP_ORIGIN` must exactly match the browser origin; no wildcard CORS.
- Stripe webhooks verify the raw-body HMAC and timestamp, then retrieve current subscription state under a per-customer lease. Replayed or older events do not reinstate a stale entitlement. Only the configured test price in an active/trialing subscription grants Pro. Canceled, unpaid and past-due subscriptions stop new Pro work; stored materials remain.
- Checkout reuses open sessions and serializes creation with a lease. A checkout return URL never grants Pro. Use Refresh membership in the Pro dialog after completing test checkout.
- Private PDF/DOCX/TXT import into editable notes, plus generation of flashcards, quizzes and study guides from saved notes. Notes are flushed before generating. No original note is overwritten. Imports explicitly explain transfer to OpenAI.
- One generation at a time per user, a monthly UTC allowance, bounded attempts, 2 MB source files, 60,000-character note input, 3,500 output tokens, request timeouts and idempotent request IDs. Successful artifacts and charged usage commit in the same transaction. Failed jobs release allowance; attempts still have an abuse cap. Duplicate completed requests return the saved artifact. Lost responses are reconciled before refunding a reservation.
- Spaced repetition is opt-in per deck and server-enforced. Again: 10 minutes; Hard: at least one day, then ×1.2; Good: one day, then ×2; Easy: four days, then ×3. Intervals cap at 365 days. These are deliberately simple scheduling rules, not an implementation of FSRS. Ratings use revisions to reject duplicate/stale device submissions. Normal study never modifies scheduling. Due sessions load up to 500 cards and can be reopened for another batch.

## Deployment sequence

1. Both migrations have already been applied manually to the connected project. **Do not replay either migration.** Before future schema changes, save a fresh backup. Reconcile existing migration history before adopting Supabase CLI migration management.
2. Set the server secrets described in `supabase/.env.example`. Use a Stripe **test** secret (`sk_test_...`) and an active recurring test Price ID. Configure the Stripe customer portal in test mode. Keep your AI key out of the browser, GitHub, and chat. Select an OpenAI model after quality and cost checks; the deployment refuses to generate without an explicit model.
3. Deploy `pro-service` and `stripe-webhook` using Supabase CLI with `supabase/config.toml`. Platform JWT verification is disabled because `pro-service` independently verifies user tokens with Supabase Auth, while Stripe uses HMAC. Never remove either handler's verification.
4. Register the webhook endpoint at `/functions/v1/stripe-webhook` for `customer.subscription.created`, `.updated`, `.deleted`, `checkout.session.completed`, `invoice.paid`, and `invoice.payment_failed`. Set its signing secret. Failed/busy reconciliation returns a retryable failure; a crashed lease expires in 90 seconds.
5. Choose an initial test allowance in the server-only table: `update public.pro_config set monthly_generations = 5 where id;` This is a test setting, not a launch promise. Cap provider project spending independently; unsuccessful provider calls may still cost money even though students receive their allowance back.
6. Test checkout and portal using Stripe's test payment methods. Confirm new Pro access, cancellation, payment failure, renewal, event redelivery, and checkout retries. Use two real test accounts to verify entitlement and file isolation. Test one small fixture for each document type and each generation kind, refusal, invalid output, timeout and persistence after reload. Live provider flows have not yet been exercised.
7. Confirm the selected price/allowance covers measured AI, email, payment and hosting costs. This build deliberately rejects live Stripe keys/events. Enabling real payments is a separate reviewed change after those decisions and live-mode testing.

## Operations and remaining limits

Generated plain text is escaped before entering the rich-text editor. Documents have no tools or access to other accounts; embedded instructions are treated as study content. The provider extracts file text. Scans/handwriting are not supported by this product flow; file size alone does not guarantee a page/token bound, so model context limits and provider spending controls remain important.

Successful imports remove their temporary upload. Failed/abandoned uploads can remain under the private `<user_id>/ai/` prefix; add scheduled cleanup before public launch. A process crash leaves a pending reservation until another generation expires it after 10 minutes. Do not automatically retry paid provider calls. A paid response lost before artifact persistence can still incur operator cost without using the student's allowance.

No public deployment, production SMTP, account export/deletion, automated backups/monitoring, or public subscription launch is included in this coding milestone. The existing personal-note recovery is complete; a general local-workspace importer remains future work.

## Verification commands

```sh
npm test
npm run build
npx --yes deno check supabase/functions/pro-service/index.ts supabase/functions/stripe-webhook/index.ts
npx --yes deno test --allow-env supabase/functions/pro-service/handler.test.ts supabase/functions/stripe-webhook/handler.test.ts
```

The Deno tests use mocked provider fetches and no network permission. PostgreSQL tests apply both real migrations and exercise database roles, ownership, scheduling, quota and billing leases.

## Provider references

Implementation references: [Supabase user authentication in Edge Functions](https://supabase.com/docs/guides/functions/auth-legacy-jwt), [Stripe subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks), [Stripe subscription object](https://docs.stripe.com/api/subscriptions/object), [OpenAI file inputs](https://developers.openai.com/api/docs/guides/file-inputs), and [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
