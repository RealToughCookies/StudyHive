# Production authentication email

Status checked 2026-09-26: custom SMTP is OFF for production project `nqrkcxigvlwfxpzolrhv`. No sender domain or provider has been confirmed by the owner. No SMTP settings, credentials, DNS or email templates were changed. Production email acceptance remains blocked on a verified sender/provider.

Supabase's built-in sender is for testing and restricts recipients. Configure custom SMTP before opening registration to the public. See [Supabase SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp).

## Prepared setup

1. Confirm an owner-controlled domain and email provider. Resend is a supported option; this is a proposal, not an activated account or paid commitment. A dedicated sending subdomain such as `auth.<owned-domain>` keeps authentication mail separate from marketing. Do not use the Cloudflare `pages.dev` hostname as a sending domain.
2. In the provider, add and verify the sending domain using its exact DNS records. Check existing MX/SPF/DKIM/DMARC before editing; preserve any existing mailbox service. Do not invent DNS values or publish duplicate SPF records. Confirm domain ownership and verification in the provider.
3. Configure the sender as `StudyHive` with an address on the verified domain. Preserve an accessible support contact. Disable provider click tracking for authentication links.
4. For Resend SMTP: host `smtp.resend.com`, port `465` (TLS), username `resend`, password = the provider API key supplied privately. See [Resend SMTP documentation](https://resend.com/docs/send-with-smtp). Store this credential only in Supabase Auth SMTP settings; never in browser environment variables, Git, docs or chat. A key scoped to sending on the verified domain is preferable when supported.
5. Use the **production** project's Authentication → Emails → SMTP Settings. Keep email confirmation and Turnstile enabled. Confirm Site URL and exact recovery redirects still point at `https://studyhive-829.pages.dev/` and `https://studyhive-829.pages.dev/?auth=recovery`. A sender domain does not require changing the hosted website address.
6. Review Supabase/provider delivery limits against the intended beta size. Keep conservative limits initially; record configured limits instead of assuming provider defaults.

## Acceptance and recovery

With owner-approved disposable recipients, test signup confirmation, resend and forgotten-password delivery through the hosted app. Confirm the sender, inbox/spam placement, correct hosted return URL, link expiry and successful sign-in after recovery. Test at least Gmail and Outlook delivery. Record timestamps/outcomes, not raw reset links, tokens or keys. The owner completes CAPTCHA and password entry. Sending test emails needs an explicit recipient and authorization.

If delivery fails, inspect provider events and Supabase Auth logs with credentials/tokens redacted. Fix the provider/DNS configuration or pause new enrollment; do not disable confirmation or CAPTCHA as a workaround. Supabase's built-in sender is not a production fallback. Keep the isolated restore-test project disconnected from production SMTP.
