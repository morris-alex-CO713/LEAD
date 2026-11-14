import OpenAI from 'openai';

const model = process.env.OPENAI_MODEL || 'gpt-5.5';

function getClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export interface TokenUsage {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
}

const businessSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    businesses: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          address: { type: 'string' },
          lat: { type: 'number' },
          lng: { type: 'number' },
          website: { type: ['string', 'null'] },
          phone: { type: ['string', 'null'] },
          email: { type: ['string', 'null'] },
          socialLinks: { type: 'array', items: { type: 'string' } },
          category: { type: 'string' },
          rating: { type: ['number', 'null'] },
          reviewsCount: { type: ['number', 'null'] },
          hasWebsite: { type: 'boolean' },
          isWebsiteGood: { type: 'boolean' },
          auditComment: { type: 'string' },
          technicalAudit: {
            type: 'object',
            additionalProperties: false,
            properties: {
              seoScore: { type: 'number' },
              mobileFriendly: { type: 'boolean' },
              loadSpeed: { type: 'string', enum: ['Fast', 'Average', 'Slow'] },
            },
            required: ['seoScore', 'mobileFriendly', 'loadSpeed'],
          },
          leadScore: { type: 'number' },
          outreachStrategy: { type: 'string' },
          competitorBenchmarks: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                name: { type: 'string' },
                website: { type: ['string', 'null'] },
                seoScore: { type: 'number' },
                advantage: { type: 'string' },
              },
              required: ['name', 'website', 'seoScore', 'advantage'],
            },
          },
        },
        required: ['name', 'address', 'lat', 'lng', 'website', 'phone', 'email', 'socialLinks', 'category', 'rating', 'reviewsCount', 'hasWebsite', 'isWebsiteGood', 'auditComment', 'technicalAudit', 'leadScore', 'outreachStrategy', 'competitorBenchmarks'],
      },
    },
  },
  required: ['businesses'],
} as const;

export async function searchBusinesses(location: string, keyword: string, radius = 5, maxResults = 10) {
  const response = await getClient().responses.create({
    model,
    tools: [{ type: 'web_search' }],
    tool_choice: 'required',
    input: `Find real ${keyword} businesses in ${location} within approximately ${radius} km. Return up to ${Math.min(maxResults, 25)} businesses. Use current web sources. Do not invent businesses or contact details. Evaluate their public digital presence, assign a lead score from 1-100 where a strong business with a weak website is a better lead, and compare each with relevant competitors.`,
    text: { format: { type: 'json_schema', name: 'business_search_results', strict: true, schema: businessSchema } },
  });
  const parsed = JSON.parse(response.output_text) as { businesses: unknown[] };
  return { data: parsed.businesses, usage: mapUsage(response.usage) };
}

export async function createOutreach(lead: any, tone = 'professional') {
  const response = await getClient().responses.create({
    model,
    input: `Write personalized outreach for this business lead. Tone: ${tone}. Reference only facts present in the supplied data, explain concrete digital improvements, and end with a clear low-pressure call to action.\n\nLead data:\n${JSON.stringify(lead)}`,
    text: { format: { type: 'json_schema', name: 'outreach_drafts', strict: true, schema: {
      type: 'object', additionalProperties: false,
      properties: { email: { type: 'string' }, linkedin: { type: 'string' } },
      required: ['email', 'linkedin'],
    } } },
  });
  return { data: JSON.parse(response.output_text), usage: mapUsage(response.usage) };
}

export async function createRenewal(clientData: any) {
  const response = await getClient().responses.create({
    model,
    input: `Write a warm, professional renewal email for this existing client. Thank them, summarize delivered value, mention upcoming service or expiry dates when available, propose continuing or expanding the engagement, and end with a clear next step. Do not invent results.\n\nClient data:\n${JSON.stringify(clientData)}`,
    text: { format: { type: 'json_schema', name: 'renewal_draft', strict: true, schema: {
      type: 'object', additionalProperties: false,
      properties: { subject: { type: 'string' }, email: { type: 'string' } },
      required: ['subject', 'email'],
    } } },
  });
  return { data: JSON.parse(response.output_text), usage: mapUsage(response.usage) };
}

function mapUsage(usage: { input_tokens?: number; output_tokens?: number; total_tokens?: number } | undefined): TokenUsage | null {
  if (!usage) return null;
  return {
    promptTokens: usage.input_tokens || 0,
    candidatesTokens: usage.output_tokens || 0,
    totalTokens: usage.total_tokens || 0,
  };
}
