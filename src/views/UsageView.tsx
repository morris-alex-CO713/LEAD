import React, { useEffect, useState } from 'react';
import { Activity, TrendingUp, DollarSign, Zap, AlertCircle, Lightbulb, RefreshCw } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { getUsageStats, getUsageLogs } from '../services/usageService';
import type { UsageStats, UsageLog } from '../types/usage';

const UsageView: React.FC = () => {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [statsData, logsData] = await Promise.all([
      getUsageStats(),
      getUsageLogs(100),
    ]);
    setStats(statsData);
    setLogs(logsData);
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Activity className="w-12 h-12 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Loading usage data...</p>
        </div>
      </div>
    );
  }

  const callTypeLabels: Record<string, string> = {
    search: 'Business Search',
    outreach: 'Outreach Generation',
    renewal: 'Renewal Draft',
  };

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">API Usage Dashboard</h1>
          <p className="text-sm text-muted-foreground">Track your Gemini API consumption and costs</p>
        </div>
        <Button 
          onClick={handleRefresh} 
          disabled={refreshing}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Today's Stats */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Today's Usage
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Tokens</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {stats?.today.totalTokens.toLocaleString() || 0}
                </p>
              </div>
              <Zap className="w-8 h-8 text-primary opacity-20" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Estimated Cost</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  ${stats?.today.totalCost.toFixed(4) || '0.0000'}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500 opacity-20" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">API Calls</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {stats?.today.callCount || 0}
                </p>
              </div>
              <Activity className="w-8 h-8 text-blue-500 opacity-20" />
            </div>
          </Card>
        </div>
      </div>

      {/* This Month's Stats */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">This Month</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Tokens</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {stats?.thisMonth.totalTokens.toLocaleString() || 0}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Estimated Cost</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              ${stats?.thisMonth.totalCost.toFixed(4) || '0.0000'}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">API Calls</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {stats?.thisMonth.callCount || 0}
            </p>
          </Card>
        </div>
      </div>

      {/* Breakdown by Call Type */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Breakdown by Type (This Month)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(stats?.thisMonth.byType || {}).map(([type, data]) => (
            <Card key={type} className="p-4">
              <p className="text-sm font-semibold text-foreground mb-2">{callTypeLabels[type] || type}</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Calls:</span>
                  <span className="font-semibold">{data.count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tokens:</span>
                  <span className="font-semibold">{data.tokens.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cost:</span>
                  <span className="font-semibold">${data.cost.toFixed(4)}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Tips */}
      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex gap-3">
          <Lightbulb className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-foreground mb-2">Tips to Reduce Token Usage</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Reduce maxResults in searches (fewer businesses = fewer tokens)</li>
              <li>• Use shorter search radius to get more focused results</li>
              <li>• Avoid regenerating outreach drafts unnecessarily</li>
              <li>• Batch similar searches together when possible</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Important Note */}
      <Card className="p-4 bg-blue-500/5 border-blue-500/20">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-foreground mb-2">About This Dashboard</h3>
            <p className="text-sm text-muted-foreground">
              Gemini API doesn't provide a quota/limit endpoint. This dashboard tracks usage by logging every API call client-side. 
              Costs are estimated based on Gemini 2.5 Flash Lite pricing ($0.075/1M prompt tokens, $0.30/1M output tokens).
            </p>
          </div>
        </div>
      </Card>

      {/* Recent Activity Log */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Recent Activity</h2>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 border-b border-border">
                <tr>
                  <th className="text-left p-3 font-semibold text-foreground">Time</th>
                  <th className="text-left p-3 font-semibold text-foreground">Type</th>
                  <th className="text-right p-3 font-semibold text-foreground">Tokens</th>
                  <th className="text-right p-3 font-semibold text-foreground">Cost</th>
                  <th className="text-left p-3 font-semibold text-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center p-8 text-muted-foreground">
                      No usage data yet. Start using the app to see logs here.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="border-b border-border hover:bg-secondary/30 transition-colors">
                      <td className="p-3 text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-primary/10 text-primary">
                          {callTypeLabels[log.callType] || log.callType}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-foreground">
                        {log.tokensUsed.totalTokens.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono text-foreground">
                        ${log.estimatedCost.toFixed(4)}
                      </td>
                      <td className="p-3">
                        {log.success ? (
                          <span className="text-green-600 text-xs font-semibold">✓ Success</span>
                        ) : (
                          <span className="text-destructive text-xs font-semibold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Failed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default UsageView;
