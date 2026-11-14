import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createRenewal } from './_lib/openai.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { client } = req.body;
  if (!client?.name) return res.status(400).json({ error: 'client is required' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
  try {
    const { data, usage } = await createRenewal(client);
    return res.json({ ...data, usage });
  } catch (error) {
    console.error('Renewal error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Renewal generation failed' });
  }
}
