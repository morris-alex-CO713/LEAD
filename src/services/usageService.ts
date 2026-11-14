import { collection, addDoc, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { UsageLog, UsageStats } from '../types/usage';

const USAGE_COLLECTION = 'usage_logs';

// Display-only OpenAI pricing. Configure rates for the selected model in .env.
const PRICING = {
  promptTokens: Number(import.meta.env.VITE_OPENAI_INPUT_COST_PER_MILLION || 0) / 1_000_000,
  candidatesTokens: Number(import.meta.env.VITE_OPENAI_OUTPUT_COST_PER_MILLION || 0) / 1_000_000,
};

export function calculateCost(tokensUsed: UsageLog['tokensUsed']): number {
  return (
    tokensUsed.promptTokens * PRICING.promptTokens +
    tokensUsed.candidatesTokens * PRICING.candidatesTokens
  );
}

export async function logUsage(log: Omit<UsageLog, 'id' | 'timestamp'>): Promise<void> {
  try {
    await addDoc(collection(db, USAGE_COLLECTION), {
      ...log,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Failed to log usage:', error);
  }
}

export async function getUsageLogs(limitCount = 50): Promise<UsageLog[]> {
  try {
    const q = query(
      collection(db, USAGE_COLLECTION),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UsageLog));
  } catch (error) {
    console.error('Failed to fetch usage logs:', error);
    return [];
  }
}

export async function getUsageStats(): Promise<UsageStats> {
  const now = Date.now();
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

  try {
    const todayQuery = query(
      collection(db, USAGE_COLLECTION),
      where('timestamp', '>=', startOfToday)
    );
    const monthQuery = query(
      collection(db, USAGE_COLLECTION),
      where('timestamp', '>=', startOfMonth)
    );

    const [todaySnapshot, monthSnapshot] = await Promise.all([
      getDocs(todayQuery),
      getDocs(monthQuery),
    ]);

    const calculateStats = (docs: any[]) => {
      const stats = {
        totalTokens: 0,
        totalCost: 0,
        callCount: docs.length,
        byType: {} as Record<string, { tokens: number; cost: number; count: number }>,
      };

      docs.forEach(doc => {
        const data = doc.data() as UsageLog;
        stats.totalTokens += data.tokensUsed.totalTokens;
        stats.totalCost += data.estimatedCost;

        if (!stats.byType[data.callType]) {
          stats.byType[data.callType] = { tokens: 0, cost: 0, count: 0 };
        }
        stats.byType[data.callType].tokens += data.tokensUsed.totalTokens;
        stats.byType[data.callType].cost += data.estimatedCost;
        stats.byType[data.callType].count += 1;
      });

      return stats;
    };

    return {
      today: calculateStats(todaySnapshot.docs),
      thisMonth: calculateStats(monthSnapshot.docs),
    };
  } catch (error) {
    console.error('Failed to fetch usage stats:', error);
    return {
      today: { totalTokens: 0, totalCost: 0, callCount: 0, byType: {} },
      thisMonth: { totalTokens: 0, totalCost: 0, callCount: 0, byType: {} },
    };
  }
}
