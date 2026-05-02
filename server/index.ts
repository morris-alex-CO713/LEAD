import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// ── Helper ──────────────────────────────────────────────────────────────────
function extractJsonArray(text: string): unknown[] {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = codeBlock ? codeBlock[1] : text;
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array found in response. Please try again.');
  return JSON.parse(match[0]);
}

// ── POST /api/search ────────────────────────────────────────────────────────
app.post('/api/search', async (req, res) => {
  const { location, keyword, radius = 5, maxResults = 10 } = req.body;

  if (!location || !keyword) {
    return res.status(400).json({ error: 'location and keyword are required' });
  }

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
- competitorBenchmarks: array of { name: string, website: string or null, seoScore: number (1-10, REQUIRED, never null), advantage: string (REQUIRED, explain specifically what they do better digitally) }

Use Google Search to find real businesses. Always return whatever you find as a JSON array.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });

    if (!response.text) return res.status(500).json({ error: 'Empty response from Gemini' });
    if (response.text.includes('<tool_code')) {
      return res.status(500).json({ error: 'Model returned intermediate output. Please try again.' });
    }

    const results = extractJsonArray(response.text);
    const usage = response.usageMetadata;
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
});

// ── POST /api/outreach ──────────────────────────────────────────────────────
app.post('/api/outreach', async (req, res) => {
  const { lead, tone = 'professional' } = req.body;

  if (!lead?.name) return res.status(400).json({ error: 'lead is required' });

  const tonePrompts: Record<string, string> = {
    professional: 'Tone: Executive, strategic, and authoritative.',
    aggressive: 'Tone: Urgent, direct, highlighting the risk of lost revenue to competitors.',
    helpful: 'Tone: Empathetic, supportive, positioning yourself as a local partner.',
    curious: 'Tone: Low-pressure, inquisitive, asking if they are even aware of the technical gaps.',
  };

  const prompt = `You are a senior digital agency consultant writing a personalized business proposal for a potential client.

Business: "${lead.name}"
Industry: ${lead.category}
Location: ${lead.address}
Website: ${lead.website || 'None'}
SEO Score: ${lead.technicalAudit?.seoScore ?? 'N/A'}/10
Mobile Friendly: ${lead.technicalAudit?.mobileFriendly ?? 'Unknown'}
Load Speed: ${lead.technicalAudit?.loadSpeed ?? 'Unknown'}
Has Website: ${lead.hasWebsite}
Website Quality: ${lead.isWebsiteGood ? 'Good' : 'Poor/Outdated'}
Audit Finding: ${lead.auditComment}
Rating: ${lead.rating ?? 'N/A'} (${lead.reviewsCount ?? 0} reviews)

Competitors:
${(lead.competitorBenchmarks || []).map((c: any) => `- ${c.name} (SEO: ${c.seoScore}/10, Website: ${c.website || 'N/A'}) — What they do better: ${c.advantage}`).join('\n') || 'No competitor data'}

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
    const usage = response.usageMetadata;
    return res.json({
      ...JSON.parse(response.text),
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
});

// ── POST /api/renewal ──────────────────────────────────────────────────────
app.post('/api/renewal', async (req, res) => {
  const { client } = req.body;
  if (!client?.name) return res.status(400).json({ error: 'client is required' });

  const prompt = `You are a client success manager writing a renewal/re-engagement email for an existing client.

Client: "${client.name}"
Website: ${client.websiteUrl || 'N/A'}
Work Previously Done: ${client.workDone || 'Digital services'}
Project Description: ${client.detailedDescription || 'N/A'}
Contract Expiry: ${client.expiryDate ? new Date(client.expiryDate).toLocaleDateString() : 'N/A'}
Next Service Due: ${client.nextServiceDate ? new Date(client.nextServiceDate).toLocaleDateString() : 'N/A'}

Write a warm, professional renewal email that:
1. Thanks them for being a client
2. Summarizes the value delivered (based on work done)
3. Highlights what's coming up (next service / contract renewal)
4. Proposes continuing or expanding the engagement
5. Ends with a clear next step (call, meeting, reply)

Return ONLY a JSON object: { "subject": "...", "email": "..." }`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });
    if (!response.text) return res.status(500).json({ error: 'Empty response' });
    const usage = response.usageMetadata;
    return res.json({
      ...JSON.parse(response.text),
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
});


const PORT = process.env.PORT || 3001;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
