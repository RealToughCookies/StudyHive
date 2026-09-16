# StudyHive AI acceptance tests

Use http://127.0.0.1:5173/ and your existing Pro account. The owner authorized up to $1 of OpenAI usage for this round. Live AI tests have not run yet.

## Enable the test allowance

Open the connected project's Supabase SQL editor and run `supabase/operations/enable_ai_acceptance_tests.sql`. This sets the development allowance to six successful generations per Pro user per month. The script refuses to proceed unless exactly one account currently has active Pro and no AI jobs already exist in the current month. It does not change memberships or study materials. This global development setting is not a dollar spending cap.

In StudyHive, open View Pro and click Refresh membership. Expect **0 / 6**. If the SQL guard fails or the allowance differs, stop and report the message rather than removing the guard.

Use only the supplied small fixtures in `tests/fixtures/ai` for this round. Do not use a textbook or personal notes yet. Stop at the first generation error; send the error and test number before retrying. A failed generation can still cost the app money even when the student's allowance is refunded.

## No-cost file validation

In Notes, choose **Import file with AI · Pro**. Select each file below and try Create notes with AI:

- `empty.txt`: rejected as an empty file.
- `oversized.txt`: rejected for exceeding 2 MB.
- `invalid.pdf`: rejected because the file is not actually a PDF.

Expect no new notes and an unchanged **0 / 6** allowance. These checks should reject the file before contacting OpenAI. Close and reopen the import dialog between files.

## Six AI generations

Create a temporary class called **QA Test** to keep these results separate. Import all files into that class. After every generation, open View Pro and Refresh membership to check the counter.

| Test | What to do | Pass condition | Expected usage |
| --- | --- | --- | --- |
| 1 | Import `cell-biology.txt` through Notes → Import file with AI · Pro. | One editable note appears in QA Test with accurate cell-biology content. | 1 / 6 |
| 2 | Repeat with `cell-biology.pdf`. | One note is created from the one-page text PDF, with no missing content or extraction errors. | 2 / 6 |
| 3 | Repeat with `cell-biology.docx`. | One note is created from the Word document, with readable headings and body text. | 3 / 6 |
| 4 | Open the TXT-generated note and choose Generate Flashcards. | One deck appears in Flashcards, targeting 10 relevant question/answer cards. | 4 / 6 |
| 5 | Open the same source note and choose Generate Quiz. | One quiz appears, targeting 8 questions with four distinct choices and one correct answer each. | 5 / 6 |
| 6 | Open the same source note and choose Create Study Guide. | A separate study-guide note is saved; the source note is unchanged. | 6 / 6 |

Read each output. Fewer than 10 cards or 8 questions is a quality issue to report, even if saving succeeds. The original 16 notes should still be present; this run adds three imported notes, one guide, one deck and one quiz. Do not delete existing notes to make room.

Accuracy anchors for the sample material:

- Ribosomes assemble proteins; the Golgi apparatus modifies and sorts them.
- Mitochondria produce much of the ATP used during aerobic respiration.
- Simple and facilitated diffusion move down a gradient without directly using ATP.
- The sodium-potassium pump moves three sodium ions out and two potassium ions in per cycle.
- In the example, water initially moves from 2% sucrose solution A toward 10% solution B. Sucrose cannot cross that membrane.

No output should invent exam dates, references, grades, or unsupported facts. Generated text should display as formatted notes rather than executable HTML or raw JSON.

## Persistence and study tests — no additional AI usage

1. Edit a generated note, navigate away, return, and reload the page. Confirm the edit and class assignment persist. Repeat a sign-out/sign-in after the save completes.
2. Study the generated deck normally with **Optional spaced repetition · Pro** off. Confirm cards can be flipped/reviewed without scheduling being required.
3. Enable **Optional spaced repetition · Pro**, then choose **Review due cards**. Reveal and rate a card Again, another Hard, another Good, and another Easy. Exit and reload. Rated cards should no longer be immediately due; the Again card should return after about 10 minutes. Other ratings schedule at least the next day. Remaining unrated cards are still due.
4. Turn spaced repetition off. Normal study should still work; scheduled review should no longer be offered for that deck. Turning it back on should preserve existing schedules.
5. Take and submit the generated quiz. Confirm the score/review is sensible and one attempt remains in Review after a reload.
6. At **6 / 6**, request one more generation from the saved note. Expect **Monthly AI allowance reached**, no additional artifact, and usage still **6 / 6**. The server rejects this before a provider request.
7. Open **Manage subscription** in View Pro. Confirm the Stripe sandbox portal opens with the existing subscription; return without changing or cancelling it for this test.

Report: `TXT / PDF / DOCX / cards / quiz / guide / saved edits / optional review / quota / portal: pass or fail`, plus any exact error. A screenshot of incorrect generated material is useful; keep API keys and account credentials out of screenshots.

## Finish the round

In OpenAI Usage, check the StudyHive project's cost change during this run. Report the actual spend; the estimate is not a measured result. Do not increase the allowance or repeat failed requests without checking the budget.

After testing, run `supabase/operations/disable_ai_acceptance_tests.sql` to set the allowance back to zero. This blocks new AI generations and retains Pro, notes, cards, quizzes and review schedules. Keep the QA Test results until failures are resolved; deleting generated materials does not refund usage.

Automated tests cover ownership, quota reservations, malformed output, signature validation and provider failures without paid calls. This manual round checks real provider integration and usability; it does not replace the remaining public-launch checks.
