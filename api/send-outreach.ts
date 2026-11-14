import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from './_lib/firebaseAdmin.js';
import { EmailConfigurationError, isEmailConfigured, sendEmail } from './_lib/email.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.FIREBASE_SERVICE_ACCOUNT && process.env.NODE_ENV !== 'production') {
    return res.status(503).json({ error: 'FIREBASE_SERVICE_ACCOUNT is required for local email sending' });
  }
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  let user;
  try { user = await adminAuth.verifyIdToken(authorization.slice(7)); }
  catch { return res.status(401).json({ error: 'Unauthorized' }); }
  try {
    if (process.env.AUTOMATION_OWNER_UID && user.uid !== process.env.AUTOMATION_OWNER_UID) return res.status(403).json({ error: 'Not allowed' });
    const { leadId, to, subject, email } = req.body || {};
    if (!leadId || !to || !subject || !email) return res.status(400).json({ error: 'leadId, to, subject and email are required' });
    const leadRef = adminDb.collection('business_listings').doc(leadId);
    const leadSnapshot = await leadRef.get();
    if (!leadSnapshot.exists || leadSnapshot.data()?.outreachApprovalStatus !== 'approved') return res.status(409).json({ error: 'Draft must be approved before sending' });
    const from = process.env.OUTREACH_EMAIL_FROM || process.env.SMTP_USER;
    if (!isEmailConfigured() || !from) return res.status(503).json({ error: 'Mailbox SMTP is not configured' });
    const providerResult = await sendEmail({ from, to: [to], subject, text: email });
    await leadRef.update({ outreachApprovalStatus: 'sent', outreachSentAt: FieldValue.serverTimestamp(), outreachProviderId: providerResult.id || null, status: 'contacted' });
    return res.json({ ok: true, id: providerResult.id });
  } catch (error) {
    return res.status(error instanceof EmailConfigurationError ? 503 : 502).json({ error: error instanceof EmailConfigurationError ? error.message : 'Email could not be sent or its status saved. Check the mailbox provider and delivery status before retrying.' });
  }
}
