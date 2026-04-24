import React from 'react';
import { motion } from 'motion/react';
import { BarChart3, Zap, ShieldCheck, Star } from 'lucide-react';

interface StatsGridProps {
  listingCount: number;
  conversionCount: number;
  scanCount: number;
  portfolioCount: number;
}

const StatsGrid: React.FC<StatsGridProps> = ({ 
  listingCount, 
  conversionCount, 
  scanCount, 
  portfolioCount 
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 lg:gap-6">
      <div className="col-span-1 md:col-span-1 lg:col-span-4 bg-card rounded-md p-6 shadow-sm border border-border relative overflow-hidden group transition-all hover:shadow-md">
        <p className="text-muted-foreground font-bold text-[10px] uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" /> Acquisition Pipeline
        </p>
        <div className="flex justify-between items-end relative z-10">
          <div>
            <h3 className="text-2xl lg:text-3xl font-bold text-foreground mb-0.5 tracking-tight">{listingCount}</h3>
            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">Active Data Points</p>
          </div>
          <div className="text-right">
            <h3 className="text-2xl lg:text-3xl font-bold text-emerald-500 mb-0.5 tracking-tight italic">
              {conversionCount}
            </h3>
            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest text-emerald-500/70">Conversion Count</p>
          </div>
        </div>
      </div>

      <div className="col-span-1 md:col-span-1 lg:col-span-4 bg-card rounded-md p-6 shadow-sm border border-border relative overflow-hidden group transition-all hover:shadow-md">
        <div className="flex justify-between mb-4 relative z-10">
          <p className="text-muted-foreground font-bold text-[10px] uppercase tracking-[0.3em] flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" /> Technical Audit Yield
          </p>
          <span className="text-[9px] font-bold text-primary/30 uppercase tracking-widest">Efficiency</span>
        </div>
        <div className="flex items-center gap-4 lg:gap-8 relative z-10">
          <div className="shrink-0">
            <h3 className="text-2xl lg:text-3xl font-bold text-foreground mb-0.5 tracking-tight">{scanCount}</h3>
            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">Scans Deployed</p>
          </div>
          <div className="flex-1 h-3 bg-secondary rounded overflow-hidden p-0.5">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (scanCount / 50) * 100)}%` }}
              transition={{ duration: 1.5, ease: "circOut" }}
              className="h-full bg-primary rounded shadow-[0_0_10px_rgba(var(--primary),0.3)]"
            />
          </div>
        </div>
      </div>

      <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-primary rounded-md p-6 shadow-xl relative overflow-hidden flex flex-col justify-between border border-primary/20 transition-all hover:scale-[1.01] hover:shadow-primary/30">
        <p className="text-primary-foreground/70 font-bold text-[10px] uppercase tracking-[0.3em] mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Revenue Integrity
        </p>
        <div className="flex items-baseline gap-3">
          <h3 className="text-3xl font-bold text-primary-foreground flex items-center gap-2 tracking-tighter italic">
            {portfolioCount} <span className="text-xs font-medium not-italic opacity-60">Clients</span>
          </h3>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/10 text-white font-bold text-[10px] uppercase tracking-tighter">
            Active <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>
        <p className="text-primary-foreground/70 font-bold text-[9px] uppercase tracking-widest mt-2 border-t border-white/10 pt-2">Portfolio Retention Metric</p>
        <div className="absolute top-2 right-2 opacity-10">
          <Star className="w-24 h-24 rotate-12 text-white" />
        </div>
      </div>
    </div>
  );
};

export default StatsGrid;
