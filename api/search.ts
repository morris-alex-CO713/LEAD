import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

function extractJsonArray(text: string): unknown[] {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = codeBlock ? codeBlock[1] : text;
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array found in response. Please try again.');
  return JSON.parse(match[0]);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { location, keyword, radius = 5, maxResults = 10 } = req.body;
  if (!location || !keyword) return res.status(400).json({ error: 'location and keyword are required' });

  const prompt = `You are a business intelligence API. Search for real "${keyword}" businesses in ${location} within ${radius}km and return data for up to ${maxResults} of them.

CRITICAL: Your entire response must be ONLY a valid JSON array. No text before or after. No markdown. No explanation. Start with [ and end with ].

For each business found, include:
- name: string
- address: string (full street address)
- lat: number (precise latitude)
- lng: number (precise longitude)
- website: string or null
- phone: string or null
- email: string or null
- socialLinks: array of strings
- category: string
- rating: number or null (0-5)
- reviewsCount: number or null
- hasWebsite: boolean
- isWebsiteGood: boolean (false if outdated/slow/not mobile-friendly)
- auditComment: string (1-2 sentence website audit)
- technicalAudit: { seoScore: number (1-10), mobileFriendly: boolean, loadSpeed: "Fast"|"Average"|"Slow" }
- leadScore: number (1-100, high = bad website but good reviews = hot lead)
- outreachStrategy: string (2-sentence personalized pitch)
- competitorBenchmarks: array of { name, website, seoScore, advantage }

Use Google Search to find real businesses. Always return whatever you find as a JSON array.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });

    if (!response.text) return res.status(500).json({ error: 'Empty response from Gemini' });
    if (response.text.includes('<tool_code')) return res.status(500).json({ error: 'Model returned intermediate output. Please try again.' });

    // Extract usage metadata
    const usage = response.usageMetadata;
    const results = extractJsonArray(response.text);

    // Return results with usage metadata
    return res.json({
      results,
      usage: usage ? {
        promptTokens: usage.promptTokenCount || 0,
        candidatesTokens: usage.candidatesTokenCount || 0,
        totalTokens: usage.totalTokenCount || 0,
      } : null,
    });
  } catch (err: any) {
    console.error('Search error:', err);
    return res.status(500).json({ error: err.message || 'Search failed' });
  }
}
