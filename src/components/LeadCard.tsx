import React from 'react';
import {
  CheckCircle,
  Trash2,
  MessageSquare,
  Globe,
  ArrowUpRight,
  MapPin
} from 'lucide-react';
import { motion } from 'motion/react';
import { BusinessListing } from '../types';
import type { DraggableProvidedDraggableProps, DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';

interface LeadCardProps {
  listing: BusinessListing;
  onClick: () => void;
  isDragging?: boolean;
  // Kanban drag props
  isKanban?: boolean;
  innerRef?: (el: HTMLElement | null) => void;
  draggableProps?: DraggableProvidedDraggableProps;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
}

const CardContent: React.FC<{ listing: BusinessListing }> = ({ listing }) => (
  <>
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded flex items-center justify-center shrink-0 border border-border transition-all ${
          listing.status === 'qualified' ? 'bg-emerald-500/10 text-emerald-500' :
          listing.status === 'rejected'  ? 'bg-destructive/10 text-destructive' :
          listing.status === 'contacted' ? 'bg-amber-500/10 text-amber-500' :
          listing.status === 'closed'    ? 'bg-blue-500/10 text-blue-500' :
          'bg-secondary text-muted-foreground'
        }`}>
          {listing.status === 'qualified' ? <CheckCircle className="w-5 h-5" /> :
           listing.status === 'rejected'  ? <Trash2 className="w-5 h-5" /> :
           listing.status === 'contacted' ? <MessageSquare className="w-5 h-5" /> :
           <Globe className="w-5 h-5" />}
        </div>
        <div className="flex flex-col min-w-0">
          <h4 className="text-[12px] font-bold text-foreground tracking-tight truncate leading-tight uppercase">
            {listing.name}
          </h4>
          <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1.5 mt-0.5 truncate">
            {listing.category} <span className="w-0.5 h-0.5 bg-border rounded-full" /> {listing.address}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.name + ' ' + listing.address)}`}
              target="_blank"
              rel="noreferrer"
              onClick={e => e.stopPropagation()}
              className="shrink-0 text-primary hover:text-primary/70 transition-colors"
              title="Open in Google Maps"
            >
              <MapPin className="w-3 h-3" />
            </a>
          </p>
        </div>
      </div>
      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
    </div>

    <div className="flex items-center gap-3">
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 mb-0.5">
          <div className={`w-1.5 h-1.5 rounded-full ${
            listing.hasWebsite ? (listing.isWebsiteGood ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-destructive'
          }`} />
          <span className={`text-[8px] font-bold uppercase tracking-wider ${
            listing.hasWebsite ? (listing.isWebsiteGood ? 'text-emerald-500' : 'text-amber-500') : 'text-destructive'
          }`}>
            {listing.hasWebsite ? (listing.isWebsiteGood ? 'Optimized' : 'Legacy') : 'Offline'}
          </span>
        </div>
        <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-[0.1em]">{listing.leadScore} Propensity Score</p>
      </div>
    </div>

    <div className="flex items-center justify-between pt-3 border-t border-border/50 bg-secondary/5 -mx-4 px-4 mt-auto">
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <span className="text-[8px] font-bold text-primary uppercase tracking-tighter leading-none">{listing.leadScore}</span>
          <span className="text-[6px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Yield</span>
        </div>
        <div className="w-[1px] h-4 bg-border/50" />
        <div className="flex flex-col">
          <span className="text-[8px] font-bold text-foreground uppercase tracking-tighter leading-none">
            {listing.technicalAudit?.loadSpeed ?? 'N/A'}
          </span>
          <span className="text-[6px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Latency</span>
        </div>
      </div>
      {listing.website && <Globe className="w-2.5 h-2.5 text-muted-foreground/30" />}
    </div>
  </>
);

const baseClass = (isDragging?: boolean) =>
  `group bg-card border border-border p-4 rounded shadow-sm hover:shadow-md hover:border-primary/50 transition-all cursor-pointer relative overflow-hidden flex flex-col gap-3 min-h-[140px] ${
    isDragging ? 'shadow-2xl ring-2 ring-primary/20 scale-[1.02]' : ''
  }`;

const LeadCard: React.FC<LeadCardProps> = ({
  listing, onClick, isDragging,
  isKanban, innerRef, draggableProps, dragHandleProps,
}) => {
  if (isKanban) {
    return (
      <div
        ref={innerRef}
        {...draggableProps}
        {...dragHandleProps}
        className={baseClass(isDragging)}
        onClick={onClick}
      >
        <CardContent listing={listing} />
      </div>
    );
  }

  return (
    <motion.div
      layout
      className={baseClass(isDragging)}
      onClick={onClick}
    >
      <CardContent listing={listing} />
    </motion.div>
  );
};

export default LeadCard;
