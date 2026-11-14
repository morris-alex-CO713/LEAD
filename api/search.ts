import type { VercelRequest, VercelResponse } from '@vercel/node';
import { searchBusinesses } from './_lib/openai.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { location, keyword, radius = 5, maxResults = 10 } = req.body;
  if (!location || !keyword) return res.status(400).json({ error: 'location and keyword are required' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
  try {
    const { data, usage } = await searchBusinesses(location, keyword, radius, maxResults);
    return res.json({ results: data, usage });
  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Search failed' });
  }
}
