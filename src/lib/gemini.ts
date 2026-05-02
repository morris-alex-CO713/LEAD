export interface CompetitorBenchmark {
  name: string;
  website: string | null;
  seoScore: number;
  advantage: string;
}

export interface BusinessResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
  website: string | null;
  phone: string | null;
  email: string | null;
  socialLinks: string[];
  category: string;
  rating: number | null;
  reviewsCount: number | null;
  hasWebsite: boolean;
  isWebsiteGood: boolean;
  auditComment: string;
  technicalAudit: {
    seoScore: number;
    mobileFriendly: boolean;
    loadSpeed: 'Fast' | 'Average' | 'Slow';
  };
  leadScore: number;
  outreachStrategy: string;
  competitorBenchmarks?: CompetitorBenchmark[];
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function searchAndAuditBusinesses(
  location: string,
  keyword: string,
  radius = 5,
  maxResults = 10
): Promise<BusinessResult[]> {
  const res = await fetch(`${API_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location, keyword, radius, maxResults }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Search failed (${res.status})`);
  }
  const data = await res.json();
  
  // Log usage if available
  if (data.usage) {
    const { logUsage, calculateCost } = await import('../services/usageService');
    const tokensUsed = {
      promptTokens: data.usage.promptTokens,
      candidatesTokens: data.usage.candidatesTokens,
      totalTokens: data.usage.totalTokens,
    };
    await logUsage({
      callType: 'search',
      tokensUsed,
      estimatedCost: calculateCost(tokensUsed),
      success: true,
      metadata: { location, keyword },
    }).catch(err => console.error('Failed to log usage:', err));
  }
  
  return data.results || data;
}

export async function generateOutreachDrafts(
  lead: object,
  tone: string
): Promise<{ email: string; linkedin: string }> {
  const res = await fetch(`${API_BASE}/outreach`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lead, tone }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Outreach generation failed (${res.status})`);
  }
  const data = await res.json();
  
  // Log usage if available
  if (data.usage) {
    const { logUsage, calculateCost } = await import('../services/usageService');
    const tokensUsed = {
      promptTokens: data.usage.promptTokens,
      candidatesTokens: data.usage.candidatesTokens,
      totalTokens: data.usage.totalTokens,
    };
    await logUsage({
      callType: 'outreach',
      tokensUsed,
      estimatedCost: calculateCost(tokensUsed),
      success: true,
      metadata: { leadName: (lead as any).name, tone },
    }).catch(err => console.error('Failed to log usage:', err));
  }
  
  return { email: data.email, linkedin: data.linkedin };
}

export async function generateRenewalDraft(
  client: object
): Promise<{ subject: string; email: string }> {
  const res = await fetch(`${API_BASE}/renewal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || `Renewal generation failed (${res.status})`);
  }
  const data = await res.json();
  
  // Log usage if available
  if (data.usage) {
    const { logUsage, calculateCost } = await import('../services/usageService');
    const tokensUsed = {
      promptTokens: data.usage.promptTokens,
      candidatesTokens: data.usage.candidatesTokens,
      totalTokens: data.usage.totalTokens,
    };
    await logUsage({
      callType: 'renewal',
      tokensUsed,
      estimatedCost: calculateCost(tokensUsed),
      success: true,
      metadata: { clientName: (client as any).name },
    }).catch(err => console.error('Failed to log usage:', err));
  }
  
  return { subject: data.subject, email: data.email };
}
