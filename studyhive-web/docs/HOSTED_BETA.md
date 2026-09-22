# Hosted beta setup

Deployed to Cloudflare Pages on 2026-09-21 at https://studyhive-829.pages.dev/. The frontend is static Vite output. Supabase continues to host authentication, data, private files and Edge Functions. Stripe stays in test mode. This is an owner-testing deployment, not approval to open paid subscriptions to the public.

## Deployment record

- Cloudflare project: `studyhive`; repository `RealToughCookies/StudyHive`, branch `main`, initial commit `de71cca`.
- Automatic non-production branch deployments disabled and verified on 2026-09-22; main auto-deploy remains enabled.
- Production address: https://studyhive-829.pages.dev/.
- Supabase Site URL and exact hosted root/recovery redirects are saved. Existing local auth redirects remain.
- `APP_ORIGIN` now points to `https://studyhive-829.pages.dev`. Pro-service preflight returned HTTP 200 with that exact allowed origin; account-deletion preflight also returned 200.
- Hosted sign-in page loads without displaying personal data. HTTPS returned 200 with the configured CSP, framing, referrer, permissions, MIME and noindex headers.
- On 2026-09-22 the owner reported all four hosted smoke checks passed: existing-account sign-in with notes/classes visible, temporary note persistence after refresh, membership refresh showing the expected plan, and matching data on a phone. These are user-reported results, not independently observed by the agent. Billing remains in test mode; broader hosted acceptance and public-launch review remain pending.

## Connect the existing repository

Sign into Cloudflare and create a **Pages** application from the existing GitHub repository `RealToughCookies/StudyHive`. Grant access only to this repository when connecting GitHub. The account owner must complete any account creation, terms acceptance or authorization prompts.

Use these build settings:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `studyhive-web` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | `22` (also recorded in `.nvmrc`) |

The repository root contains the historical application. Deploy **only `studyhive-web/dist`**, never the repository root, historical installers or the whole workspace. Pages supports the Vite build and automatic updates from GitHub. [Cloudflare Vite deployment](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/), [build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/).

Set these public build variables in Pages before building:

```text
VITE_DATA_MODE=cloud
VITE_SUPABASE_URL=https://nqrkcxigvlwfxpzolrhv.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<the project's sb_publishable_ key>
```

Get the publishable key from Supabase's API Keys page. It is designed for browser use; database ownership policies protect the data. Do not put service-role keys, database passwords, OpenAI keys, Stripe keys or webhook signing secrets in Pages or any `VITE_*` variable. Those stay in Supabase Edge Function Secrets.

Disable automatic branch-preview deployments for the initial beta, or give previews a separate test backend. Do not allow arbitrary preview URLs in Supabase Auth or Pro service CORS. The current backend intentionally supports a single exact frontend origin.

## Set the final hosted address

After the first successful deployment, record the actual HTTPS `pages.dev` address. Do not guess it. A custom domain can wait.

1. In Supabase Authentication → URL Configuration, set Site URL to the hosted address. Add the exact app root URL and the password-reset return URL (`/?auth=recovery`) to Redirect URLs. Keep the exact local development URLs only if still needed. [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).
2. Change the server `APP_ORIGIN` secret to that HTTPS origin, without a path. This switches checkout, portal, AI and deletion to the hosted origin. **Those services will then reject localhost**; regular local database/auth access is a separate path. Keep this cutover deliberate and use the hosted site for subsequent acceptance tests.
3. Keep the existing Stripe test key, test price and webhook URL. Checkout and portal return URLs come from `APP_ORIGIN`; the webhook still points to Supabase. Do not replace any provider keys with live keys.
4. Verify the new deployment before sharing its address. The build uses `public/_headers` to prevent framing, disable unused device permissions, suppress referrers and discourage indexing. These headers are copied into `dist/` by Vite and interpreted by Pages. The CSP currently limits framing, base URLs and embedded objects; it is not a complete script/resource allowlist. [Pages headers](https://developers.cloudflare.com/pages/configuration/headers/).

Noindex is not access control. Before inviting external testers, decide enrollment rules, configure production email delivery and enforce AI/storage budgets. For an invite-only beta, restrict signup on the backend or use an appropriately configured access gate; hiding the URL is insufficient. The existing Supabase project contains the owner's notes. Prefer a separate staging project for destructive simulations or broad external testing, without copying private notes into fixtures.

## Hosted acceptance checks

- Sign in, reload and sign out; verify no personal data is visible when signed out.
- Create/verify a disposable account; resend confirmation and reset its password using the hosted URLs in the same browser.
- Save a note, upload/download an attachment, export data, and reload on a second device.
- Check a second account cannot read or change the first account's records/files.
- Complete test checkout, refresh membership, open the portal and test account deletion/cancellation using disposable accounts. Re-run webhook delivery checks.
- Check response headers and browser console errors on the actual hosted site. Local Vite does not apply the Pages `_headers` rules.
- Confirm AI allowance and provider budget before generating; previous owner authorization was for the small development test round, not unlimited hosted testing.

Do not publish the beta broadly until email delivery, storage quotas, abuse controls and monitoring are ready. Renewal and failed-payment tests, backup restoration and public policies remain launch work.

## Rollback

If the frontend deployment fails, restore a known-good Pages deployment. If reverting the origin cutover, restore `APP_ORIGIN=http://127.0.0.1:5173` and the former Auth URL settings together, then verify the local server. No schema migration is required for this hosting setup. The three existing migrations were applied manually; do not replay them.
