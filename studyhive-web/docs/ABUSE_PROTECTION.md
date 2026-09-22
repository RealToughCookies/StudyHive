# Signup abuse protection

Turnstile integration is coded and tested. On 2026-09-22 a managed widget restricted to `studyhive-829.pages.dev` was created with pre-clearance off, and its public site key was saved in the Pages production build environment. The compatible frontend deployed successfully as commit `0141878`, and the hosted sign-in widget displayed Success. Supabase CAPTCHA enforcement is NOT enabled yet; the matching secret must be entered by the owner after the compatible frontend is deployed. A widget alone is not an authorization boundary. Supabase Auth must validate tokens server-side so direct requests cannot bypass the form.

## Enable for the hosted beta

1. Create a managed Cloudflare Turnstile widget restricted to `studyhive-829.pages.dev`. Add the final custom hostname when it exists. Do not allow arbitrary preview hostnames. The owner completes any account/terms or key-entry prompts.
2. Put its public site key in Cloudflare Pages production build variable `VITE_TURNSTILE_SITE_KEY` and build this frontend. The secret never goes in `VITE_*`, source code, or GitHub.
3. Configure Supabase Authentication → Attack Protection with Turnstile and the matching secret, then enable CAPTCHA. Coordinate this with the frontend deployment: enabling Supabase first temporarily blocks existing clients without the widget; deploying the widget alone does not stop direct API abuse.
4. Check sign-in, signup, password recovery, confirmation resend and account deletion's isolated password verification. The authenticated password-update form does not issue another challenge.
5. Verify missing, invalid, expired and reused tokens are rejected by Supabase directly, without sending real email in an automated loop. A fresh valid challenge must succeed. Include mobile Safari and blocked-script cases. Complete challenges manually; never automate CAPTCHA solving.
6. Review Supabase Auth rate limits for signup, sign-in and email sending. Keep email confirmation enabled and anonymous sign-in disabled. Test throttling in an isolated project. CAPTCHA does not replace email limits, enrollment controls, per-account quotas or provider cost alerts.

If the widget fails to load, forms remain blocked and offer retry. Tokens are cleared on expiry, errors, mode changes and after every submitted auth attempt. Existing signed-in workspace use does not require a challenge on every action.

Do not roll back to a frontend without CAPTCHA support while the backend requires CAPTCHA; that locks out users. Restore a known-good compatible frontend/widget configuration. Turning CAPTCHA off is a security decision, not an automatic fallback.

Local tests cover token forwarding, single-use handling, failed requests, expiration, mode changes, widget lifecycle, script failure/retry and account-deletion reauthentication. Provider-side enforcement and real hostname validation require the hosted checks above.

References: [Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha), [Turnstile explicit rendering](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/).
