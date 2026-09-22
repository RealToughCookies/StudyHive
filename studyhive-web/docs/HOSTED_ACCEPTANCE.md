# Hosted acceptance record and next checks

Use https://studyhive-829.pages.dev/, not localhost or a deployment-preview URL.

## Completed on 2026-09-22

- Owner reported successful sign-in and notes access after Supabase Turnstile enforcement was enabled. This is user-reported acceptance.
- Direct sign-in requests with missing and invalid CAPTCHA tokens returned `captcha_failed`. These checks used a nonexistent address and sent no email.
- Production build and 121 automated tests passed before deployment. Storage API concurrency and physical file cleanup are separate acceptance checks.

- Live read-only storage health check returned `stored_files=1`, `counted_files=1`, and zero for all five anomaly columns. This checks metadata only; it does not establish file-byte recoverability.

## Next: disposable-account authentication

1. Use an empty disposable account whose inbox the owner controls. Do not delete or reset the main account for testing.
2. If the test account does not exist, create it on the hosted site, complete verification, and follow the newest confirmation email. Confirm the returned address is the hosted site and sign in.
3. Sign out, choose **Forgot password?**, complete verification, and send one recovery email. The owner enters and saves the new password privately through the newest link.
4. Sign out again. Confirm the new password signs in and an old password fails. Stop on an unexpected error; do not repeatedly resend email.
5. Record the date, browser, redirect outcome and result without recording passwords, tokens or recovery links. Existing-account sign-in does not prove signup or recovery email delivery.

## Storage fixtures and limits

Use the generated `StudyHive-storage-check` fixture folder, containing 26 numbered text files. Each file identifies itself as disposable test data. The account must be Free and show **0 / 25 files stored** before this scenario. Do not downgrade a real subscription for this check.

1. Create a note named **Disposable storage check**. Attach files 01–24 using **Add Files** and verify Settings shows **24 / 25**.
2. For the final-slot race, open that note in two browser tabs signed into the same test account. Select file 25 in one tab and file 26 in the other; initiate the uploads together. Exactly one should succeed. Near-simultaneous manual attempts are a smoke check, not proof of independent-session concurrency; retain the automated/concurrent Storage API check as pending until measured.
3. Refresh both tabs and Settings. There must be 25 stored files and 25 registered attachments, with one rejected upload. Verify an existing file still downloads while at the limit.
4. With owner confirmation, remove one disposable attachment through the app. Usage should become 24. Upload the rejected file again; usage should return to 25.
5. Export the disposable account. Verify all 25 attachments are present and downloaded bytes match the fixture text. Keep exports private and outside Git.
6. Run `supabase/operations/storage_health.sql`; all anomaly columns should be zero. This query checks metadata, not underlying file availability.

## Cleanup remains a distinct test

Fresh files are deliberately protected for 24 hours. An old unregistered test upload must be prepared under a confirmed disposable account and allowed to age. Compare its disappearance with a saved attachment that must remain downloadable. Confirm removal through the app before deleting anything. Do not backdate or delete production Storage metadata to shortcut this test. Cleanup that reports zero files is not proof of physical deletion.

Do not claim full acceptance from this checklist alone. Cross-account file access, active Pro and expired-Pro capacity, failed removal retries, independent concurrent requests and mobile recovery still require recorded outcomes. No paid AI call is needed for these checks.
