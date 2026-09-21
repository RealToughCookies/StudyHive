# StudyHive

StudyHive is a browser study workspace for college students, built with React, TypeScript, Vite and Supabase. The cloud foundation supports real accounts, password recovery, private study data and attachments. Test-mode Pro billing, included AI, optional spaced repetition, data export and account deletion are implemented. Public launch requirements remain; see the hosted beta guide.

See [the product agreement](docs/PRODUCT.md), [cloud setup instructions](docs/CLOUD_SETUP.md) and [hosted beta setup](docs/HOSTED_BETA.md).

## Run locally

Install Node.js 22 or newer, then:

```sh
npm ci
# Configure .env.local using docs/CLOUD_SETUP.md first.
npm run dev
```

Open the URL printed by Vite (use http://127.0.0.1:5173 for the currently configured backend). Create and verify a cloud account to begin. To use the old browser-only demo without a provider, explicitly set `VITE_DATA_MODE=local` in `.env.local`.

```sh
npm test          # Regression tests for timers, settings, and account state
npm run build     # TypeScript validation and production bundle in dist/
npm run preview   # Serve the production bundle locally
```

The active source is a browser application. It does not currently include an Electron main process or Electron packaging scripts. The `release/` directory contains historical desktop builds; rebuilding this source does not update those installers. **Do not publish or distribute those old builds:** the security review found unsafe generated-content rendering and unrestricted native file operations in them. Publish the current browser source only; see [PUBLICATION.md](PUBLICATION.md).

## Study tools

- Classes with color labels and organized notes, flashcards, and quizzes.
- Rich-text notes with autosave, formatting, lists, tables, images, and file attachments.
- Manual flashcard decks and keyboard-controlled study sessions.
- AI generation using a personal key remains available only in the local demo. Cloud Pro includes server-managed AI notes, flashcards, study guides and quizzes with a monthly allowance.
- One shared Pomodoro timer across the timer page, floating timer, and focus mode. Long breaks follow every fourth completed work session.
- Dashboard statistics, study streaks, calendar reminders with repeat options, and review history.
- Draggable sticky notes, five color themes, independent dark mode, and configurable keyboard shortcuts.

Document files can be attached and downloaded. Cloud Pro can turn text-based PDF, DOCX and TXT uploads into editable notes.

## Local demo data and accounts

The following behavior applies only with `VITE_DATA_MODE=local`. For cloud authentication and storage, see [CLOUD_SETUP.md](docs/CLOUD_SETUP.md).

SQLite runs in memory through `sql.js`. Mutations are serialized and acknowledged after storage commits. The app saves the database to IndexedDB (`studyhive-sql`); attachment blobs use a separate IndexedDB database (`studyhive-files`). Accounts, notes, preferences, and history belong to the current browser profile and site origin. Clearing site data removes them. There is no cloud sync or backup/export workflow. Browsers with Web Locks allow one active StudyHive tab per origin, preventing two in-memory database copies from overwriting each other. Use one tab in browsers without Web Locks.

Login checks a locally stored bcrypt password hash. This is local account separation, not server-enforced authentication. Login sessions are not restored after a page reload. Logging out clears the active account settings and timer.

## Local demo AI features

Add your own OpenAI API key in Settings. Keys stay in memory by default until logout or reload. The optional “Remember this key on this browser” setting stores the key unencrypted in the local database. Previously saved keys remain available until removed or saved with remembering disabled.

Generating study materials sends the selected note content directly to OpenAI. API usage is billed to the key owner's account. The service currently requests `gpt-3.5-turbo`; availability and successful requests depend on that account. The application has no backend for managing shared credentials.

## Local subscription demo

Free/Premium labels and the upgrade dialog demonstrate a local tier change. There is no payment processing, real subscription, or enforced paid feature limit. AI generation requires an API key regardless of the demo tier.

## Cloud code map

- `src/services/cloud/`: Supabase configuration, account-scoped table operations.
- `src/services/studyData.ts`: named data operations used by the existing study screens, with a local-demo adapter.
- `src/components/Auth/CloudSession.tsx`, `CloudAuthForm.tsx`: session restoration, verification, sign-in and recovery.
- `supabase/migrations/`: tables, ownership policies, private files, atomic deck creation and note revision checks.
- `tests/cloud.test.tsx`: PostgreSQL isolation/permission/transaction tests.

## Existing code map

- `src/main.tsx`: database initialization and React startup.
- `src/App.tsx`, `src/components/Layout.tsx`: local login gate, navigation, global timer, and focus mode.
- `src/store/index.ts`: account, normalized settings, theme, and shared timer state.
- `src/hooks/useSharedTimer.ts`: timer lifecycle and controls.
- `src/hooks/useNoteAutosave.ts`: debounced note persistence and navigation flush.
- `src/services/database.ts`: schema and browser database persistence.
- `src/services/electronShim.ts`: browser implementation of the legacy `window.electronAPI` interface.
- `src/services/fileStorage.ts`: attachment storage.
- `src/services/openai.ts`: per-request AI clients and generated-content validation.
- `src/components/`: feature screens and editors.
- `tests/`: automated regression checks.

See [BUGFIX-AUDIT.md](BUGFIX-AUDIT.md) for the latest bug audit and validation, and [BUILT.md](BUILT.md) for the current implementation status and remaining limitations.

## Pro development milestone

The Pro service implementation includes test-mode checkout/portal, verified webhooks, server AI with usage accounting, file-to-notes import, and optional spaced repetition. Provider deployment and credentials are still required; this does not enable real billing or AI by itself. See [Pro setup and remaining launch checks](docs/PRO_SETUP.md).
