# Daily Lead Automation

The `/api/daily-report` serverless function runs every day at `03:00 UTC` (`08:30 Asia/Kolkata`). It searches each configured target, skips businesses already in Firestore, stores new leads for manual review, writes a daily report, and delivers that report by email and WhatsApp.

Signed-in users can view recent runs and delivery status from **Automation** in the application navigation. The **Run now** button sends the user's Firebase ID token to the backend. When `AUTOMATION_OWNER_UID` is configured, only that Firebase user can start a run.

## Safety boundary

This job does not email prospects. Automated leads receive `outreachApprovalStatus: "pending_review"`. Review and verify a lead before sending outreach.

## Required setup

1. Create a Firebase service account in Firebase Console and store its one-line JSON value as `FIREBASE_SERVICE_ACCOUNT` in Vercel. Store its project ID as `FIREBASE_PROJECT_ID`.
2. Set `AUTOMATION_OWNER_UID` to the Firebase Authentication UID that should own the generated records.
3. Set `AUTOMATION_TARGETS` to a JSON array. Example:

   ```json
   [
     { "location": "Bengaluru, India", "keyword": "Dental Clinics", "radius": 5, "maxResults": 10 },
     { "location": "Bengaluru, India", "keyword": "Roofing Contractors", "radius": 10, "maxResults": 10 }
   ]
   ```

4. Generate a long random `CRON_SECRET`. Vercel automatically sends it as the cron request's bearer token.
5. Configure mailbox SMTP using `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, and `SMTP_PASS`; set `REPORT_EMAIL_FROM` and `REPORT_EMAIL_TO`. For Google Workspace, authenticate as the primary mailbox using an app password and send as its configured alias. See DEPLOY.md.
6. In Meta Business Manager, configure WhatsApp Cloud API and create an approved utility template named `daily_lead_report`. The template body must contain one variable (`{{1}}`), which receives the formatted report. Set the WhatsApp variables documented in `.env.example` and ensure the destination number has opted in.
7. Set `DASHBOARD_URL` to the production application URL.

All of these values belong in the Vercel server environment. Never prefix secrets with `VITE_`.

## Manual test

After deployment, invoke the job with the same bearer token Vercel uses:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-app.example.com/api/daily-report
```

The response contains the report, delivery results, and any target-specific errors. Runs are stored in the Firestore `daily_reports` collection; individual searches are stored in `scans`.

If email or WhatsApp variables are missing, that channel is reported as skipped while lead collection continues.
