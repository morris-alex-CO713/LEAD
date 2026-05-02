import { motion } from 'motion/react';
import { Search, Plus, LayoutDashboard, Zap, MessageSquare, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import StatsGrid from '@/components/StatsGrid';
import LeadCard from '@/components/LeadCard';
import { BusinessListing, ScanHistory, PortfolioClient } from '@/types';

interface DashboardViewProps {
  listings: BusinessListing[];
  scans: ScanHistory[];
  portfolio: PortfolioClient[];
  searchFilter: string;
  setSearchFilter: (v: string) => void;
  dashboardFilter: string | null;
  setDashboardFilter: (v: string | null) => void;
  filteredListings: BusinessListing[];
  onLeadClick: (lead: BusinessListing) => void;
  onExportCSV: () => void;
  onNewSearch: () => void;
}

export function DashboardView({
  listings, scans, portfolio,
  searchFilter, setSearchFilter,
  dashboardFilter, setDashboardFilter,
  filteredListings, onLeadClick,
  onExportCSV, onNewSearch,
}: DashboardViewProps) {
  return (
    <motion.div
      key="dashboard"
      initial={{ opacity: 0, scale: 0.99 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.99 }}
      className="space-y-6 sm:space-y-10"
    >
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-6 border-b border-border/60">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tighter text-foreground mb-1 mr-4 lg:mb-2 uppercase">Neural Dashboard</h1>
          <p className="text-muted-foreground font-medium text-[11px] sm:text-sm lg:text-base flex flex-wrap items-center gap-x-2">
            Target Acquisition Mode: <span className="text-primary font-bold">{listings.filter(l => l.status === 'new').length} New Prospects</span>
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={onExportCSV} className="flex-1 sm:flex-none rounded-md border-border font-bold text-[9px] uppercase tracking-widest h-10 px-4 bg-card shadow-sm hover:bg-secondary transition-all">
            Export Dataset
          </Button>
          <Button onClick={onNewSearch} className="flex-1 sm:flex-none border-none bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 font-bold text-[9px] uppercase tracking-widest px-4 sm:px-6 h-10 rounded-md gap-2 transition-all active:scale-95">
            <Plus className="w-3.5 h-3.5" /> Acquire
          </Button>
        </div>
      </header>

      {/* Stats */}
      <StatsGrid
        listingCount={listings.length}
        conversionCount={listings.filter(l => l.status === 'qualified' || l.status === 'closed').length}
        scanCount={scans.length}
        portfolioCount={portfolio.length}
      />

      {/* Recent Acquisitions */}
      <div className="space-y-6 pt-2">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border/60">
          <h2 className="text-xl lg:text-2xl font-bold text-foreground tracking-tight">Recent Acquisitions</h2>
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search database..."
                className="pl-11 h-10 w-full md:w-64 lg:w-72 border-border bg-card shadow-sm rounded-md font-medium text-sm placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/10 transition-all"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>
            <div className="flex gap-1 bg-secondary p-1 rounded-md overflow-x-auto no-scrollbar">
              {([
                { id: null, label: 'All' },
                { id: 'no-website', label: 'No Web' },
                { id: 'poor-ux', label: 'Legacy' },
                { id: 'high-priority', label: 'Priority' },
              ] as { id: string | null; label: string }[]).map(f => (
                <button
                  key={String(f.id)}
                  onClick={() => setDashboardFilter(f.id)}
                  className={`text-[9px] font-bold px-3 lg:px-4 py-2 rounded-sm transition-all uppercase tracking-wider whitespace-nowrap ${
                    dashboardFilter === f.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {filteredListings.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-card rounded-md border border-border shadow-sm">
              <LayoutDashboard className="w-8 h-8 text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground font-black uppercase tracking-widest text-[10px]">No active data streams</p>
            </div>
          ) : (
            filteredListings.slice(0, 5).map((l) => (
              <LeadCard key={l.id} listing={l} onClick={() => onLeadClick(l)} />
            ))
          )}
        </div>
      </div>

      {/* Operational Intelligence Protocol */}
      <section className="mt-12 border-t border-border pt-12 pb-12">
        <div className="max-w-4xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-[0.3em]">Operational Intelligence Protocol</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="space-y-4">
              <h3 className="text-[11px] font-black text-primary uppercase tracking-widest flex items-center gap-2"><Search className="w-3 h-3" /> Acquisition</h3>
              <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">Deploy sensors via the <b>Satellite Scanner</b> to identify local businesses. Our Gemini-powered engine audits their digital infrastructure in real-time.</p>
            </div>
            <div className="space-y-4">
              <h3 className="text-[11px] font-black text-primary uppercase tracking-widest flex items-center gap-2"><Zap className="w-3 h-3" /> Evaluation</h3>
              <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">Review <b>Propensity Scores</b>. A score above 7 indicates a high probability of technical debt and immediate need for infrastructure upgrades.</p>
            </div>
            <div className="space-y-4">
              <h3 className="text-[11px] font-black text-primary uppercase tracking-widest flex items-center gap-2"><MessageSquare className="w-3 h-3" /> Execution</h3>
              <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">Save leads to your <b>CRM</b> to unlock personalized outreach sequences. Use the <b>Lead detail</b> view to generate AI-tailored communication.</p>
            </div>
          </div>
          <div className="mt-12 p-4 rounded bg-primary/5 border border-primary/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[10px] text-primary font-bold uppercase tracking-widest italic">Always verify digital signatures before initiating outreach protocols.</p>
            <Badge variant="outline" className="bg-primary text-primary-foreground border-none px-3 py-1 text-[9px] font-black uppercase tracking-widest">v1.2 Active</Badge>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
