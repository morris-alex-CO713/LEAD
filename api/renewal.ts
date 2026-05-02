import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { client } = req.body;
  if (!client?.name) return res.status(400).json({ error: 'client is required' });

  const prompt = `You are a senior account manager writing a contract renewal proposal for an existing client.

Client: "${client.name}"
Industry: ${client.category || 'N/A'}
Contract Start: ${client.contractStart || 'N/A'}
Contract End: ${client.contractEnd || 'N/A'}
Services Provided: ${client.services || 'Website maintenance, SEO, digital marketing'}
Monthly Fee: ${client.monthlyFee || 'N/A'}
Performance Metrics: ${client.metrics || 'N/A'}

Generate a professional renewal proposal email that:
- Thanks them for their partnership
- Highlights key wins and results from the past contract period
- Proposes renewal with potential service upgrades
- Includes a clear call to action

Return ONLY a JSON object: { "subject": "...", "email": "..." }`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    if (!response.text) return res.status(500).json({ error: 'Empty response from Gemini' });

    // Extract usage metadata
    const usage = response.usageMetadata;
    const draft = JSON.parse(response.text);

    // Return draft with usage metadata
    return res.json({
      ...draft,
      usage: usage ? {
        promptTokens: usage.promptTokenCount || 0,
        candidatesTokens: usage.candidatesTokenCount || 0,
        totalTokens: usage.totalTokenCount || 0,
      } : null,
    });
  } catch (err: any) {
    console.error('Renewal error:', err);
    return res.status(500).json({ error: err.message || 'Renewal generation failed' });
  }
}
