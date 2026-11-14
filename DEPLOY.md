# Production deployment

The current deployment uses the repository root on Vercel, hosting both the Vite frontend and the /api functions. The older Firebase Hosting site is https://lead-mgmt-ffdb6.web.app.

## Publish

Run npm run lint, then npx vercel deploy --prod from the repository root. Production VITE_API_URL must be /api so frontend requests use the same host. Do not deploy only server/: it imports shared code from api/.

Configure OPENAI_API_KEY, OPENAI_MODEL, FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT in the Vercel production environment. Configure AUTOMATION_TARGETS, AUTOMATION_OWNER_UID, REPORT_TIMEZONE and CRON_SECRET for daily automation. The cron runs at 03:00 UTC (08:30 India time). Keep the owner UID set to the intended Firebase user.

## Email setup

Email code uses Resend. Verify a domain in Resend by adding the DNS records it provides. Add these secrets/settings to Vercel production and local .env if testing locally:

- RESEND_API_KEY: Resend sending API key.
- OUTREACH_EMAIL_FROM: Your Name <outreach@your-verified-domain.com>.
- REPORT_EMAIL_FROM: Reports <reports@your-verified-domain.com> (for daily reports).
- REPORT_EMAIL_TO: Your report recipient address (for daily reports).

Redeploy after changing production environment variables. Outreach requires a signed-in Firebase user and an approved draft; sending is a separate user action. Daily reports skip email when its variables are missing. No real email delivery is verified until a configured sender and recipient are tested.

## Git

Remote: https://github.com/morris-alex-CO713/LEAD.git

Never commit .env files, private keys, node_modules or .vercel metadata. Connect this repository in Vercel for automatic deployments after GitHub access is granted to the Vercel account.
