export interface UsageLog {
  id?: string;
  timestamp: number;
  callType: 'search' | 'outreach' | 'renewal';
  tokensUsed: {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
  };
  estimatedCost: number; // in USD
  success: boolean;
  errorMessage?: string;
  metadata?: {
    location?: string;
    keyword?: string;
    leadName?: string;
    clientName?: string;
    tone?: string;
  };
}

export interface UsageStats {
  today: {
    totalTokens: number;
    totalCost: number;
    callCount: number;
    byType: Record<string, { tokens: number; cost: number; count: number }>;
  };
  thisMonth: {
    totalTokens: number;
    totalCost: number;
    callCount: number;
    byType: Record<string, { tokens: number; cost: number; count: number }>;
  };
}
