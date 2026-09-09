# Publishing StudyHive

Publish the current browser source only. Do not upload `release/`, old installers, unpacked desktop applications, `node_modules/`, local databases, environment files, or credentials.

## Security review — September 8, 2026

The Codex Security source review inspected all 40 authored files under `src/`, tests, build configuration, local storage and account behavior, AI content handling, and the inspectable entry points of the historical desktop builds.

Two medium-severity findings affect the historical Electron builds: generated study guides can become executable HTML, and the renderer's file bridge exposes overly broad native filesystem operations. Those artifacts have not been rebuilt or fixed. Their exclusion from publication is required; rebuilding the browser source does not update them.

No exploitable vulnerability was established in the current browser source during this review. The credential-pattern checks found no matching secrets in the reviewed publication files. These checks do not prove that every possible vulnerability or credential format is absent. Native binaries, WASM internals, and third-party source were not exhaustively audited, and no live AI or desktop exploit was run.

The source scan was sealed before the following dependency changes. A separate npm advisory check initially reported 15 affected packages (9 high, 4 moderate, 2 low). Vite was updated to 6.4.3, the test runner's esbuild to 0.28.2, and compatible affected transitive dependencies were updated. Unused `mammoth`, `pdfjs-dist`, `react-router-dom`, and `rehype-raw` dependencies were removed; no active feature imports them.

After those changes:

- `npm audit`: 0 reported vulnerabilities.
- `npm test`: 37 passed, 0 failed.
- `npm run build`: TypeScript and production compilation passed.

Build warnings about browser-externalized Node modules in sql.js/bcryptjs remain. Browser compatibility, future advisories, and an actual hosted deployment need their own checks.

## Before pushing

Keep `package-lock.json` and use `npm ci` to reproduce the reviewed dependency tree. Run `npm audit`, `npm test`, and `npm run build` again if dependencies or application code change.

The supplied source bundle contains an explicit selection of `src/`, `public/`, `tests/`, and root source/configuration/documentation files. It excludes historical releases and local generated output. The expanded `.gitignore` also excludes environment variants, credential files, and SQLite data. An example environment file, if added later, must contain placeholders only.

This workspace was not a Git repository at review time, so no commit history, staged tree, or remote repository was verified. Before pushing, inspect the actual staged files with `git diff --cached --name-only` and `git diff --cached`. Do not force-add ignored artifacts. Files already committed remain tracked despite ignore rules.

## Application limits

Accounts separate local study data in the UI; they do not protect against someone with access to the browser profile or scripts running on the same origin. Remembered API keys are explicitly stored unencrypted; new keys remain session-only by default. AI generation sends the selected note to OpenAI using the user's own key. Do not embed a shared API key in the frontend.

Publishing source is separate from deploying a service. Use HTTPS for hosting and review response headers and origin isolation before a public deployment. Rich notes can contain external images; an application-owned HTML and external-resource policy remains a useful follow-up hardening measure.
