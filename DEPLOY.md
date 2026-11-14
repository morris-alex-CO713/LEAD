# Production deployment

Live app: https://lead-omega-ebon.vercel.app

The current deployment uses the repository root on Vercel, hosting both the Vite frontend and the /api functions. The older Firebase Hosting site is https://lead-mgmt-ffdb6.web.app.

## Publish

Run npm run lint, then npx vercel deploy --prod from the repository root. Production VITE_API_URL must be /api so frontend requests use the same host. Do not deploy only server/: it imports shared code from api/.

Configure OPENAI_API_KEY, OPENAI_MODEL, FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT in the Vercel production environment. Configure AUTOMATION_TARGETS, AUTOMATION_OWNER_UID, REPORT_TIMEZONE and CRON_SECRET for daily automation. The cron runs at 03:00 UTC (08:30 India time). Keep the owner UID set to the intended Firebase user.

## Email setup

Email uses Nodemailer through the existing Google Workspace mailbox. No Resend account or additional domain verification is used.

Set these in Vercel production and local .env:

- SMTP_HOST=smtp.gmail.com
- SMTP_PORT=465
- SMTP_SECURE=true
- SMTP_USER=admin@reliablefocus.com (primary mailbox, not the alias)
- SMTP_PASS=Google app password for the primary mailbox
- OUTREACH_EMAIL_FROM=sales@reliablefocus.com
- EMAIL_REPLY_TO=sales@reliablefocus.com (replies reach the existing admin mailbox through the alias)
- REPORT_EMAIL_FROM=sales@reliablefocus.com
- REPORT_EMAIL_TO=admin@reliablefocus.com (optional daily report recipient)

In the admin mailbox Gmail settings, ensure sales@reliablefocus.com is available under Accounts / Send mail as. App passwords require 2-Step Verification and may be unavailable under your Workspace policy. If app passwords are prohibited, configure OAuth2 or an approved Workspace relay instead; ordinary account passwords are not supported by this implementation for Google Workspace.

Keep SMTP_PASS private. Add it directly in Vercel environment settings or local .env, then redeploy. Outreach still requires a signed-in user and explicit draft approval. Sending is a separate action. SMTP acceptance does not prove inbox delivery. Real delivery remains unverified until credentials are configured and an authorized test message is sent.

Reference: https://support.google.com/mail/answer/22370 and https://nodemailer.com/smtp

## Git

Remote: https://github.com/morris-alex-CO713/LEAD.git

Never commit .env files, private keys, node_modules or .vercel metadata. Connect this repository in Vercel for automatic deployments after GitHub access is granted to the Vercel account.
