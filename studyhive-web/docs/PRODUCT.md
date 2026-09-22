# StudyHive product agreement

StudyHive is a public browser service for individual college students. Accounts use email/password, email verification and password recovery. Each student owns a private workspace accessible from their devices. Sharing is deferred.

| Capability | Free | Pro |
| --- | --- | --- |
| Classes, notes, timers and manually created flashcards | Yes | Yes |
| AI-generated study materials and quizzes | No | Yes |
| Upload documents and turn them into editable notes with AI | No | Yes |
| Spaced repetition | No | Optional per deck; normal study remains available |

Students will not supply API keys. Server-side AI and billing must enforce entitlements and usage limits. The tentative price is $10/year; it is not final and depends on cost estimates. Avoid promising unlimited AI.

Working defaults for the remaining implementation: text-based PDF, DOCX and TXT for AI imports; no OCR initially; monthly AI allowance with unsuccessful generations not consuming allowance. Preserve generated material after Pro expires, but stop new AI generation and scheduled review. These defaults can be revisited before billing work.

## Implementation stages

1. **Cloud foundation (connected and verified):** authentication UI, private database/files, existing study-feature data access, session restoration, password recovery, server-enforced ownership, note edit conflict detection and Pro permission foundation.
2. **Pro service (deployed in test mode; owner reports Pro activation and working AI, see [setup](PRO_SETUP.md)):** payment checkout/portal, verified webhooks, server-owned subscription state, AI endpoints, usage accounting, private document extraction and editable generated notes. Optional spaced-repetition study mode and scheduling are implemented.
3. **Launch completion (export and Free/Pro account deletion tested):** hosted deployment, privacy/terms, quotas and abuse controls, responsive/accessibility review, live multi-account/email/payment checks, backups, monitoring and deployment.

The old local demo remains explicitly selectable. Its local accounts, API-key feature and demo subscription labels are not production authentication, included Pro AI or real billing.

## File capacity implementation — 2026-09-22

Added server-enforced beta file counts (25 Free / 100 active Pro), transactional accounting, and a Settings usage panel. Existing files survive downgrade/overage. Migrations are deployed; hosted Storage API acceptance remains pending. See STORAGE_LIMITS.md.

## Abuse and upload cleanup implementation — 2026-09-22

Added owner-confirmed cleanup for old unregistered uploads (saved attachments protected), and optional Turnstile integration across public auth forms and deletion reauthentication. Both are deployed. Supabase rejects missing/invalid CAPTCHA tokens, and the owner confirmed hosted sign-in. Full hosted acceptance remains pending; see HOSTED_ACCEPTANCE.md. Backup and restore requirements are tracked in BACKUP_RECOVERY.md.
