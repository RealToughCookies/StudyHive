# StudyHive implementation status

This document describes the current browser source, not the historical Electron release artifacts.

## Runtime

React 18, TypeScript, Tailwind CSS, Vite 6, Zustand, and sql.js. The browser compatibility layer provides the database, file, notification, and window-focus functions previously accessed through Electron IPC.

The schema contains 12 tables: users, settings, classes, notes, note_attachments, sticky_notes, flashcard_decks, flashcards, quizzes, quiz_attempts, pomodoro_sessions, and reminders. The database is persisted in IndexedDB alongside a separate attachment store.

## Implemented

Local login/signup; classes; rich-text notes and attachments; flashcard decks and study sessions; AI flashcards, quizzes, and study guides; quiz attempts; Pomodoro sessions; focus mode; calendar reminders; sticky notes; dashboard statistics; review history; themes; keyboard shortcuts; and a subscription demonstration.

## Correctness improvements

- Vite prebundles sql.js correctly, allowing development startup to reach the login screen.

- Focus mode, the timer page, and the floating timer use one timer and shared sound controls.
- Long breaks follow the fourth, eighth, and subsequent fourth completed work sessions.
- SQLite settings flags are normalized to booleans before components consume them.
- Database initialization preserves the user's pause-on-blur choice.
- Resetting the timer uses the latest saved duration.
- Logging out clears settings and timer state; switching accounts starts with a clean timer.
- AI clients belong to individual requests, with no global client retaining another account's key.
- API keys are session-only by default; persistent storage is an explicit option.
- Generated flashcards and quizzes are checked for the fields and answer indexes the UI requires.
- Focus mode reuses the rich-text note editor. Note autosave has its own hook and flushes pending edits when the editor unmounts.

Run `npm test` for regression checks and `npm run build` for TypeScript validation and production compilation. Neither requires an OpenAI key.

## Remaining limitations

- Local accounts are not a security boundary against someone who can access this browser's data or scripts.
- No cloud sync, server authentication, real billing, backup/export, or current Electron packaging pipeline.
- Remembered API keys are unencrypted in browser storage. A hosted service with centrally managed credentials would need a backend.
- Timers and account sessions do not survive a page reload. The countdown accounts for elapsed time between browser callbacks. After an extended suspension, it completes the current session once and starts the next phase; it does not award unattended sessions for the entire suspension.
- The rich-text editor still has substantial formatting and selection logic; this update does not replace its editing engine.
- Attachments are supported, but document-to-note import is not wired into the UI.
- Regression tests do not establish complete browser compatibility, desktop installer correctness, or live AI service availability.

## Follow-up bug audit

See [BUGFIX-AUDIT.md](BUGFIX-AUDIT.md) for the persistence, calendar, editor, study-session, and interaction fixes from the deeper audit.
