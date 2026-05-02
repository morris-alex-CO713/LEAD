import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const tonePrompts: Record<string, string> = {
  professional: 'Tone: Executive, strategic, and authoritative.',
  aggressive: 'Tone: Urgent, direct, highlighting the risk of lost revenue to competitors.',
  helpful: 'Tone: Empathetic, supportive, positioning yourself as a local partner.',
  curious: 'Tone: Low-pressure, inquisitive, asking if they are even aware of the technical gaps.',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { lead, tone = 'professional' } = req.body;
  if (!lead?.name) return res.status(400).json({ error: 'lead is required' });

  const prompt = `You are a senior digital agency consultant writing a personalized business proposal for a potential client.

Business: "${lead.name}"
Industry: ${lead.category}
Location: ${lead.address}
Website: ${(lead as any).website || 'None'}
SEO Score: ${lead.technicalAudit?.seoScore ?? 'N/A'}/10
Mobile Friendly: ${lead.technicalAudit?.mobileFriendly ?? 'Unknown'}
Load Speed: ${lead.technicalAudit?.loadSpeed ?? 'Unknown'}
Has Website: ${(lead as any).hasWebsite}
Website Quality: ${(lead as any).isWebsiteGood ? 'Good' : 'Poor/Outdated'}
Audit Finding: ${(lead as any).auditComment}
Rating: ${(lead as any).rating ?? 'N/A'} (${(lead as any).reviewsCount ?? 0} reviews)

Competitors:
${((lead as any).competitorBenchmarks || []).map((c: any) => `- ${c.name} (SEO: ${c.seoScore}/10, Website: ${c.website || 'N/A'}) — What they do better: ${c.advantage}`).join('\n') || 'No competitor data'}

Tone: ${tonePrompts[tone] ?? tonePrompts.professional}

Generate TWO outreach drafts:

1. EMAIL: A professional client proposal email that:
   - Opens by referencing their specific business and location
   - Mentions what we found when we explored their digital presence (use the audit data)
   - Explains exactly what their competitors are doing better (name them specifically)
   - Proposes concrete solutions: website redesign, SEO, mobile optimization, speed improvements, etc.
   - Positions us as the best partner to close that gap
   - Ends with a clear call to action

2. LINKEDIN: A shorter LinkedIn message (under 300 chars) that hooks them and invites a conversation.

Return ONLY a JSON object: { "email": "...", "linkedin": "..." }`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    if (!response.text) return res.status(500).json({ error: 'Empty response from Gemini' });

    // Extract usage metadata
    const usage = response.usageMetadata;
    const drafts = JSON.parse(response.text);

    // Return drafts with usage metadata
    return res.json({
      ...drafts,
      usage: usage ? {
        promptTokens: usage.promptTokenCount || 0,
        candidatesTokens: usage.candidatesTokenCount || 0,
        totalTokens: usage.totalTokenCount || 0,
      } : null,
    });
  } catch (err: any) {
    console.error('Outreach error:', err);
    return res.status(500).json({ error: err.message || 'Outreach generation failed' });
  }
}
