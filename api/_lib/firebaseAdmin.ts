import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function getCredential() {
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!rawServiceAccount) return applicationDefault();
  const serviceAccount = JSON.parse(rawServiceAccount);
  if (typeof serviceAccount.private_key === 'string') {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
  return cert(serviceAccount);
}

const app = getApps()[0] ?? initializeApp({
  credential: getCredential(),
  projectId: process.env.FIREBASE_PROJECT_ID || 'lead-mgmt-ffdb6',
});

export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);
