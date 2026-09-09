# StudyHive bug audit — 2026-09-07

Reviewed the current browser source across persistence, accounts/settings, notes and attachments, classes, flashcards, quizzes, calendar/reminders, dashboard/review history, keyboard handling, and timers. Historical desktop binaries were not modified.

The existing 12 tests passed before this audit. The expanded suite now has 37 passing tests. Reproductions included incorrect date values, duplicate database rows, storage commit failures, an empty-deck crash, list editing through DOM selections, and overlapping note saves.

## Fixes

| Area | Failure | Change |
| --- | --- | --- |
| Database persistence | Awaited mutations returned before IndexedDB committed; failed writes could appear successful. | Serialize mutations, wait for storage completion, reject failures, and restore the prior in-memory database after a failed operation. |
| Related writes | Deck/card creation and signup could stop halfway through; later reads of SQLite's global insert ID could target the wrong record. | Add atomic batches with explicit references to earlier insert results; use batches for all deck creation paths and account/settings creation. |
| Deletion | Classes left decks assigned to deleted class IDs; notes/quizzes/decks left related records dangling. | Persistent SQL triggers unassign class relationships, detach independently useful material from deleted notes, and remove owned child records. |
| Multiple tabs | Independent sql.js database copies could overwrite each other's data. | Hold an exclusive Web Lock for the active app tab; explain how to reopen the app in a second tab. |
| Startup | Initialization failures produced a blank page. | Show the failure and a reload control. |
| Note filters | The Unassigned filter converted an empty option to zero, which did not match SQL NULL. | Match null/undefined class IDs explicitly. |
| Note autosave | A failed older save could be retried on exit after a newer successful edit, overwriting it. | Track edit revisions and in-flight writes; only retry the current revision. |
| Leaving notes | Closing/reloading a page during the debounce interval could silently discard edits. | Flush when the page becomes hidden and request browser confirmation while edits or writes remain outstanding. |
| Lists | Enter in the middle of a custom list item created an empty item without moving the trailing text. | Split the DOM range at the caret and retain trailing inline content; leave Shift+Enter to the browser. |
| Study guides | Generated Markdown appeared literally in the HTML editor and lost the source class. | Convert Markdown to editor HTML, disable raw model HTML, and retain the source class. Load the Markdown renderer on demand. |
| AI input/account changes | List-based generation sent note markup; an old generation request could complete after the active account changed. | Extract note text for list-based generation and check the active account before saving generated material. |
| Attachments | Canceling file selection could hang; downloads used internal names and lost MIME types. | Handle native chooser cancellation, retain file blobs/MIME types, and download with the original name. |
| Attachment failures | Deleting an attachment removed the blob before its metadata deletion was durable. Failed uploads could leave unreferenced blobs. | Delete metadata first; preserve the file if that fails; clean up uploaded blobs if metadata creation fails; display actionable errors. |
| Calendar/reminders | UTC conversion selected the wrong local date; January 31 repeated on March 3; a full-cell hover overlay intercepted date selection. | Use local calendar-day keys, clamp monthly repeats to the next month's last valid day, and keep date selection separate from the explicit Add action. |
| Review/history | Comparing SQLite timestamps with ISO strings excluded valid records on the cutoff day; timezone-less UTC timestamps displayed as local times. | Compare normalized SQLite datetimes and parse stored UTC timestamps explicitly. |
| Dashboard | Statistics stayed stale when the global timer completed while the dashboard remained open. | Refresh dashboard data after durable mutations. |
| Quiz submission | Double submission created duplicate attempts; save failures still showed completion; answers could change during persistence. | Guard submissions, keep failures retryable, and freeze answer/navigation changes while saving. |
| Flashcard sessions | Empty decks crashed; a single-card deck showed completion before review. | Render an empty state and base completion on reviewed card IDs. |
| Keyboard shortcuts | Recording a shortcut triggered global navigation; study-session shortcuts conflicted with page shortcuts. | Let the active recorder/session consume its keys before global navigation, which now respects handled events. |
| Timer | Delayed browser callbacks subtracted only one second; a notification failure could interrupt session recording. | Account for elapsed seconds and isolate notification errors from persistence. |
| Delayed settings saves | A save finishing after logout could put the former account's settings back in memory. | Check the active account before applying the saved settings. |

## Validation

- `npm test`: 37 passed, 0 failed.
- `npm run build`: TypeScript validation and the production bundle succeeded.
- Tests use React's test renderer, jsdom for DOM selection/event behavior, real sql.js, an in-memory IndexedDB transport with injected failures, and stubbed AI responses.
- Browser smoke check: login screen loaded without JavaScript errors.
- Browser multi-tab check: a second app tab showed the expected lock message; after closing the first tab and reloading, the second displayed the login screen.
- Manual deck creation was exercised through its React form against real SQL, verifying that cards belong to the newly created deck.
- No live OpenAI requests were made. Test accounts and documents in automated tests exist only in the test fixtures.

The build still reports toolchain warnings about CJS configuration, old Browserslist data, and browser-externalized Node imports in dependencies. These did not prevent compilation or the browser startup check. This audit did not perform a dependency security audit.

## Scope and remaining constraints

This is a functional bug audit, not a claim that every possible defect has been eliminated or a production security certification. Accounts and billing retain their documented local/demo design. Remembered API keys remain unencrypted browser data by explicit user choice.

The single-tab safeguard requires Web Locks; use one app tab in browsers without that API. Database and attachment blobs are stored separately, so a browser crash between those stores' operations may leave an unused blob requiring cleanup. No historical orphan repair or user-data purge was performed.

Browser termination cannot guarantee an unfinished write will complete if the user chooses to leave anyway. After a long browser suspension, the timer finishes the current phase once and starts the next phase; it does not invent a series of completed sessions. Timers and login sessions still reset on reload.

The regression suite does not replace a full end-to-end browser compatibility matrix, historical installer testing, or live AI-service verification.
