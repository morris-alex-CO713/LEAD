import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from './_lib/firebaseAdmin.js';

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
  try {
    const user = await adminAuth.verifyIdToken(authorization.slice(7));
    if (process.env.AUTOMATION_OWNER_UID && user.uid !== process.env.AUTOMATION_OWNER_UID) return res.status(403).json({ error: 'Not allowed' });
    const { leadId, to, subject, email } = req.body || {};
    if (!leadId || !to || !subject || !email) return res.status(400).json({ error: 'leadId, to, subject and email are required' });
    const leadRef = adminDb.collection('business_listings').doc(leadId);
    const leadSnapshot = await leadRef.get();
    if (!leadSnapshot.exists || leadSnapshot.data()?.outreachApprovalStatus !== 'approved') return res.status(409).json({ error: 'Draft must be approved before sending' });
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.OUTREACH_EMAIL_FROM;
    if (!apiKey || !from) return res.status(503).json({ error: 'Business email sending is not configured' });
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text: email }),
    });
    if (!response.ok) return res.status(502).json({ error: `Email provider rejected the message: ${await response.text()}` });
    const providerResult = await response.json();
    await leadRef.update({ outreachApprovalStatus: 'sent', outreachSentAt: FieldValue.serverTimestamp(), outreachProviderId: providerResult.id || null, status: 'contacted' });
    return res.json({ ok: true, id: providerResult.id });
  } catch (error) {
    return res.status(401).json({ error: error instanceof Error ? error.message : 'Unauthorized' });
  }
}
