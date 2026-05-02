# Deployment Guide

## Architecture
- **Frontend** → Firebase Hosting (free CDN)
- **Backend** → Vercel (serverless Express)
- **Database** → Firebase Firestore (already live)

---

## 1. Deploy Backend (Vercel)

### First time setup
```bash
npm install -g vercel
cd server
vercel login
vercel
```
Follow the prompts:
- Link to existing project? **Yes** → `lead-mgmt`
- Or create new project

### Set environment variable on Vercel
In Vercel Dashboard → Project `lead-mgmt` → Settings → Environment Variables:
```
GEMINI_API_KEY = your-gemini-api-key
```

### Deploy to production
```bash
cd server
vercel --prod
```
Copy the deployment URL, e.g. `https://lead-mgmt.vercel.app`

---

## 2. Configure Frontend with Backend URL

Update your `.env` file (or set in Firebase Hosting / CI):
```
VITE_API_URL=https://lead-mgmt.vercel.app/api
```

> ⚠️ The `VITE_` prefix is required — Vite only exposes variables with this prefix to the browser.

---

## 3. Deploy Frontend (Firebase Hosting)

### First time setup
```bash
npm install -g firebase-tools
firebase login
firebase use lead-mgmt-ffdb6
```

### Build & deploy
```bash
npm run build
firebase deploy --only hosting
```

Or use the combined script:
```bash
npm run deploy:frontend
```

Your app will be live at:
`https://lead-mgmt-ffdb6.web.app`

---

## 4. Full deploy (both at once)
```bash
npm run deploy
```

---

## Environment Variables Summary

| Variable | Where | Value |
|---|---|---|
| `GEMINI_API_KEY` | Vercel Dashboard | Your Gemini API key |
| `VITE_API_URL` | `.env` before build | `https://your-backend.vercel.app/api` |

---

## Local Development
```bash
# Terminal 1 - Frontend
npm run dev

# Terminal 2 - Backend
npm run dev:server
```

Make sure `.env` has:
```
VITE_API_URL=http://localhost:3001/api
```
And `server/.env` has:
```
GEMINI_API_KEY=your-gemini-api-key
```
