import { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Search, LayoutDashboard, ShieldCheck, Activity, Zap, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import StatsGrid from '@/components/StatsGrid';
import LeadCard from '@/components/LeadCard';
import { BusinessListing, PortfolioClient, ScanHistory } from '@/types';

interface DashboardViewProps {
  listings: BusinessListing[];
  scans: ScanHistory[];
  portfolio: PortfolioClient[];
  searchFilter: string;
  setSearchFilter: (filter: string) => void;
  dashboardFilter: string | null;
  setDashboardFilter: (filter: string | null) => void;
  activeBoardView: 'list' | 'kanban';
  setActiveBoardView: (view: 'list' | 'kanban') => void;
  onExport: () => void;
  onOpenLead: (lead: BusinessListing) => void;
  onDragEnd: (result: DropResult) => void;
  onNavigateToSearch: () => void;
}

export function DashboardView({
  listings,
  scans,
  portfolio,
  searchFilter,
  setSearchFilter,
  dashboardFilter,
  setDashboardFilter,
  activeBoardView,
  setActiveBoardView,
  onExport,
  onOpenLead,
  onDragEnd,
  onNavigateToSearch
}: DashboardViewProps) {
  const filteredListings = listings.filter(l => {
    const matchesSearch = l.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
           l.address.toLowerCase().includes(searchFilter.toLowerCase()) ||
           l.category.toLowerCase().includes(searchFilter.toLowerCase());
    if (!matchesSearch) return false;
    if (dashboardFilter === 'no-website') return !l.hasWebsite;
    if (dashboardFilter === 'poor-ux') return l.hasWebsite && !l.isWebsiteGood;
    if (dashboardFilter === 'high-priority') return (l.leadScore || 0) > 80;
    return true;
  });

  return (
    <div className="space-y-12">
      <motion.div 
        key="dashboard"
        initial={{ opacity: 0, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.99 }}
        className="space-y-6 sm:space-y-10 focus:outline-none"
      >
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-6 border-b border-border/60">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tighter text-foreground mb-1 mr-4 lg:mb-2 text-left uppercase">Neural Dashboard</h1>
            <p className="text-muted-foreground font-medium text-[11px] sm:text-sm lg:text-base text-left flex flex-wrap items-center gap-x-2">
              Target Acquisition Mode: <span className="text-primary font-bold">{listings.filter(l => l.status === 'new').length} New Prospects</span>
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={onExport} className="flex-1 sm:flex-none rounded-md border-border font-bold text-[9px] uppercase tracking-widest h-10 px-4 bg-card shadow-sm hover:bg-secondary transition-all">
              Export Dataset
            </Button>
            <Button onClick={onNavigateToSearch} className="flex-1 sm:flex-none border-none bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 font-bold text-[9px] uppercase tracking-widest px-4 sm:px-6 h-10 rounded-md gap-2 transition-all active:scale-95">
              <Plus className="w-3.5 h-3.5" /> Acquire
            </Button>
          </div>
        </header>

        <StatsGrid 
          listingCount={listings.length}
          conversionCount={listings.filter(l => l.status === 'qualified' || l.status === 'closed').length}
          scanCount={scans.length}
          portfolioCount={portfolio.length}
        />

        <div className="space-y-8 pt-6">
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
              <div className="flex gap-2">
                <div className="flex gap-1 bg-secondary p-1 rounded-md">
                  <button 
                    onClick={() => setActiveBoardView('list')}
                    className={`p-1.5 rounded-sm transition-all ${activeBoardView === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setActiveBoardView('kanban')}
                    className={`p-1.5 rounded-sm transition-all ${activeBoardView === 'kanban' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-1 bg-secondary p-1 rounded-md overflow-x-auto no-scrollbar">
                  {[
                    { id: null, label: 'All' },
                    { id: 'no-website', label: 'No Web' },
                    { id: 'poor-ux', label: 'Legacy' },
                    { id: 'high-priority', label: 'Priority' }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setDashboardFilter(f.id)}
                      className={`text-[9px] font-bold px-3 lg:px-4 py-2 rounded-sm transition-all uppercase tracking-wider whitespace-nowrap ${
                        dashboardFilter === f.id 
                          ? 'bg-card text-foreground shadow-sm' 
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {activeBoardView === 'list' ? (
            <div className="grid grid-cols-1 gap-2">
              {filteredListings.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 bg-card rounded-md border border-border shadow-sm">
                  <LayoutDashboard className="w-8 h-8 text-muted-foreground/20 mb-4" />
                  <p className="text-muted-foreground font-black uppercase tracking-widest text-[10px]">No active data streams</p>
                </div>
              ) : (
                filteredListings.slice(0, 5).map((l) => (
                  <LeadCard 
                    key={l.id} 
                    listing={l} 
                    onClick={() => onOpenLead(l)} 
                  />
                ))
              )}
            </div>
          ) : (
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="overflow-x-auto no-scrollbar -mx-6 px-6 lg:mx-0 lg:px-0 scroll-smooth">
                <div className="flex gap-4 min-w-[1000px] lg:min-w-0 lg:grid lg:grid-cols-4 lg:gap-6 pb-10 min-h-[600px]">
                  {(['new', 'qualified', 'contacted', 'closed'] as const).map(status => (
                    <Droppable droppableId={status} key={status}>
                      {(provided, snapshot) => (
                        <div 
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          className={`flex flex-col h-full bg-secondary/20 rounded-md p-4 min-h-[500px] border border-border/30 transition-colors ${snapshot.isDraggingOver ? 'bg-primary/5 border-primary/20' : ''}`}
                        >
                          <div className="flex items-center justify-between mb-6 px-1">
                            <h4 className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.25em] flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${
                                status === 'new' ? 'bg-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]' :
                                status === 'qualified' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                                status === 'contacted' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' :
                                'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                              }`} />
                              {status}
                            </h4>
                            <span className="text-[9px] font-black text-muted-foreground/50 bg-secondary px-1.5 py-0.5 rounded border border-border/50">
                              {listings.filter(l => l.status === status).length}
                            </span>
                          </div>

                          <div className="flex flex-col gap-3 h-full">
                            {listings.filter(l => l.status === status).map((biz, index) => (
                              <Draggable draggableId={biz.id} index={index} key={biz.id}>
                                {(provided, snapshot) => (
                                  <LeadCard 
                                    listing={biz} 
                                    onClick={() => onOpenLead(biz)}
                                    draggableProps={provided.draggableProps}
                                    dragHandleProps={provided.dragHandleProps}
                                    innerRef={provided.innerRef}
                                    isDragging={snapshot.isDragging}
                                    isKanban={true}
                                  />
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        </div>
                      )}
                    </Droppable>
                  ))}
                </div>
              </div>
            </DragDropContext>
          )}
        </div>
      </motion.div>

      {/* Operational Intelligence Protocol */}
      <section className="mt-12 border-t border-border pt-12 pb-12 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        <div className="max-w-4xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-[0.3em]">Operational Intelligence Protocol</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="space-y-4">
              <h3 className="text-[11px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                <Search className="w-3 h-3" /> Acquisition
              </h3>
              <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                Deploy sensors via the <b>Satellite Scanner</b> to identify local businesses. Our Gemini-powered engine audits their digital infrastructure in real-time.
              </p>
            </div>
            <div className="space-y-4">
              <h3 className="text-[11px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                <Zap className="w-3 h-3" /> Evaluation
              </h3>
              <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                Review <b>Propensity Scores</b>. A score above 7 indicates a high probability of technical debt and immediate need for infrastructure upgrades.
              </p>
            </div>
            <div className="space-y-4">
              <h3 className="text-[11px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                <MessageSquare className="w-3 h-3" /> Execution
              </h3>
              <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                Save leads to your <b>CRM</b> to unlock personalized outreach sequences. Use the <b>Lead detail</b> view to generate AI-tailored communication.
              </p>
            </div>
          </div>

          <div className="mt-12 p-4 rounded bg-primary/5 border border-primary/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[10px] text-primary font-bold uppercase tracking-widest italic">Always verify digital signatures before initiating outreach protocols.</p>
            <Badge variant="outline" className="bg-primary text-primary-foreground border-none px-3 py-1 text-[9px] font-black uppercase tracking-widest">v1.2 Active</Badge>
          </div>
        </div>
      </section>
    </div>
  );
}
