<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/27561c7f-2db0-4e55-a300-d464bcec7ffb

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set `OPENAI_API_KEY` in `.env` to an OpenAI Platform API key
3. Run the app:
   `npm run dev`

## Authentication Setup

This app now uses **Firebase Authentication** with email/password sign-in.

### First Time Setup:

1. **Enable Email/Password Authentication in Firebase Console:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project: `gen-lang-client-0707304351`
   - Navigate to **Authentication** → **Sign-in method**
   - Enable **Email/Password** provider
   - Click **Save**

2. **Create Your Account:**
   - Run the app (`npm run dev`)
   - Click **"Need an account? Sign Up"**
   - Enter your email and password (minimum 6 characters)
   - Click **"Create Account"**

3. **Sign In:**
   - Use your registered email and password
   - Click **"Initialize Access"**

### Important Notes:

- **No more hardcoded credentials** - The old `akash@prospect.com / prospect2026` login has been removed
- **Real Firebase Authentication** - Your login is now secured by Firebase Auth
- **Firestore Permissions** - Now properly authenticated, so Firestore operations will work correctly
- **Persistent Sessions** - Firebase handles session management automatically

### Troubleshooting:

If you get authentication errors:
- Make sure Email/Password authentication is enabled in Firebase Console
- Check that your password is at least 6 characters
- Verify your Firebase configuration in `firebase-applet-config.json`
