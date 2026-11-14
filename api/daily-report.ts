import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from './_lib/firebaseAdmin.js';
import { sendReportEmail, sendReportTelegram, sendReportWhatsApp, type DailyReportMessage, type DeliveryResult } from './_lib/notifications.js';
import { searchBusinesses as searchWithOpenAI } from './_lib/openai.js';

interface AutomationTarget {
  location: string;
  keyword: string;
  radius?: number;
  maxResults?: number;
}

interface BusinessResult {
  name: string;
  address: string;
  category?: string;
  leadScore?: number;
  [key: string]: unknown;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!['GET', 'POST'].includes(req.method || '')) return res.status(405).json({ error: 'Method not allowed' });
  if (!await isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
  if (!process.env.FIREBASE_SERVICE_ACCOUNT && process.env.NODE_ENV !== 'production') {
    return res.status(503).json({ error: 'FIREBASE_SERVICE_ACCOUNT is required for local automation writes' });
  }

  const startedAt = new Date();
  try {
    const targets = parseTargets(req);
    const existingSnapshot = await adminDb.collection('business_listings').select('name', 'address').get();
    const knownKeys = new Set(existingSnapshot.docs.map(doc => leadKey(doc.data())));
    const newLeads: BusinessResult[] = [];
    const errors: Array<{ target: AutomationTarget; error: string }> = [];
    let scanned = 0;

    for (const target of targets) {
      try {
        const results = await searchBusinesses(target);
        scanned += results.length;
        const batch = adminDb.batch();
        let writes = 0;
        for (const lead of results) {
          const key = leadKey(lead);
          if (!lead.name || !lead.address || knownKeys.has(key)) continue;
          knownKeys.add(key);
          newLeads.push(lead);
          batch.set(adminDb.collection('business_listings').doc(), {
            ...lead,
            uid: process.env.AUTOMATION_OWNER_UID || 'automation',
            status: 'new',
            connectionDone: false,
            outreachApprovalStatus: 'pending_review',
            source: 'daily_automation',
            normalizedKey: key,
            createdAt: FieldValue.serverTimestamp(),
          });
          writes++;
        }
        if (writes > 0) await batch.commit();
        await adminDb.collection('scans').add({
          ...target,
          uid: process.env.AUTOMATION_OWNER_UID || 'automation',
          count: results.length,
          results,
          source: 'daily_automation',
          timestamp: FieldValue.serverTimestamp(),
        });
      } catch (error) {
        errors.push({ target, error: error instanceof Error ? error.message : String(error) });
      }
    }

    const sortedLeads = [...newLeads].sort((a, b) => Number(b.leadScore || 0) - Number(a.leadScore || 0));
    const report: DailyReportMessage = {
      date: startedAt.toLocaleDateString('en-IN', { timeZone: process.env.REPORT_TIMEZONE || 'Asia/Kolkata' }),
      scanned,
      newLeads: newLeads.length,
      highPriority: newLeads.filter(lead => Number(lead.leadScore || 0) >= 75).length,
      failedSearches: errors.length,
      topLead: sortedLeads[0] ? { name: sortedLeads[0].name, leadScore: Number(sortedLeads[0].leadScore || 0), category: sortedLeads[0].category } : undefined,
      dashboardUrl: process.env.DASHBOARD_URL,
    };

    const reportRef = await adminDb.collection('daily_reports').add({
      ...report,
      targets,
      errors,
      newLeadNames: sortedLeads.slice(0, 20).map(lead => lead.name),
      status: errors.length === targets.length ? 'failed' : errors.length ? 'partial' : 'complete',
      startedAt: startedAt.toISOString(),
      completedAt: FieldValue.serverTimestamp(),
    });
    const deliveries = await deliverReport(report);
    await reportRef.update({ deliveries });
    return res.status(200).json({ ok: true, reportId: reportRef.id, report, deliveries, errors });
  } catch (error) {
    console.error('Daily automation failed:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Daily automation failed' });
  }
}

async function isAuthorized(req: VercelRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const authorization = req.headers.authorization;
  if (secret && authorization === `Bearer ${secret}`) return true;
  if (req.method !== 'POST' || !authorization?.startsWith('Bearer ')) return false;

  try {
    const decoded = await adminAuth.verifyIdToken(authorization.slice(7));
    const ownerUid = process.env.AUTOMATION_OWNER_UID;
    return !ownerUid || decoded.uid === ownerUid;
  } catch {
    return false;
  }
}

function parseTargets(req: VercelRequest): AutomationTarget[] {
  const submitted = req.method === 'POST' ? req.body?.targets : undefined;
  const raw = process.env.AUTOMATION_TARGETS;
  const targets = Array.isArray(submitted) && submitted.length > 0
    ? submitted as AutomationTarget[]
    : raw ? JSON.parse(raw) as AutomationTarget[] : [];
  if (!Array.isArray(targets) || targets.length === 0) throw new Error('AUTOMATION_TARGETS must be a non-empty JSON array');
  for (const target of targets) if (!target.location || !target.keyword) throw new Error('Every automation target needs location and keyword');
  return targets;
}

async function searchBusinesses(target: AutomationTarget): Promise<BusinessResult[]> {
  const { data } = await searchWithOpenAI(target.location, target.keyword, target.radius ?? 5, target.maxResults ?? 10);
  return data as BusinessResult[];
}

function leadKey(lead: { name?: unknown; address?: unknown }): string {
  return `${normalize(lead.name)}|${normalize(lead.address)}`;
}

function normalize(value: unknown): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function deliverReport(report: DailyReportMessage): Promise<DeliveryResult[]> {
  const channels: DeliveryResult['channel'][] = ['email', 'whatsapp', 'telegram'];
  const settled = await Promise.allSettled([sendReportEmail(report), sendReportWhatsApp(report), sendReportTelegram(report)]);
  return settled.map((result, index) => result.status === 'fulfilled' ? result.value : {
    channel: channels[index],
    sent: false,
    detail: result.reason instanceof Error ? result.reason.message : String(result.reason),
  });
}
