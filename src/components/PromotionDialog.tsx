import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Briefcase } from 'lucide-react';
import { BusinessListing } from '@/types';

interface PromotionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLead: BusinessListing | null;
  onPromote: (details: PromotionDetails) => Promise<void>;
}

export interface PromotionDetails {
  workDone: string;
  detailedDescription: string;
  expiryMonths: number;
  nextServiceMonths: number;
}

export function PromotionDialog({ open, onOpenChange, selectedLead, onPromote }: PromotionDialogProps) {
  const [promotionDetails, setPromotionDetails] = useState<PromotionDetails>({
    workDone: '',
    detailedDescription: '',
    expiryMonths: 12,
    nextServiceMonths: 6,
  });

  const handlePromote = async () => {
    await onPromote(promotionDetails);
    setPromotionDetails({ workDone: '', detailedDescription: '', expiryMonths: 12, nextServiceMonths: 6 });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border shadow-2xl p-0 overflow-hidden rounded-md">
        <div className="p-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded flex items-center justify-center border border-primary/20">
              <Briefcase className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Promote to Client</h2>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">{selectedLead?.name}</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Delivered Services</label>
              <Input 
                placeholder="e.g. Website Redesign, SEO Audit, GMB Cleanup" 
                value={promotionDetails.workDone}
                onChange={(e) => setPromotionDetails(prev => ({ ...prev, workDone: e.target.value }))}
                className="h-10 border-border bg-background rounded focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Project Narrative</label>
              <textarea 
                placeholder="Detailed audit findings and implemented solutions..." 
                value={promotionDetails.detailedDescription}
                onChange={(e) => setPromotionDetails(prev => ({ ...prev, detailedDescription: e.target.value }))}
                className="w-full h-24 p-3 bg-background border border-border rounded text-sm font-medium focus:ring-primary/20 focus:outline-none custom-scrollbar-themed"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Expiration (Months)</label>
                <Input 
                  type="number" 
                  value={promotionDetails.expiryMonths}
                  onChange={(e) => setPromotionDetails(prev => ({ ...prev, expiryMonths: parseInt(e.target.value) }))}
                  className="h-10 border-border bg-background rounded focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Next Cycle (Months)</label>
                <Input 
                  type="number" 
                  value={promotionDetails.nextServiceMonths}
                  onChange={(e) => setPromotionDetails(prev => ({ ...prev, nextServiceMonths: parseInt(e.target.value) }))}
                  className="h-10 border-border bg-background rounded focus:ring-primary/20"
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="bg-secondary/30 p-6 flex flex-row gap-3">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="flex-1 h-11 border-border font-black text-[10px] uppercase tracking-widest rounded bg-card hover:bg-secondary"
          >
            Cancel
          </Button>
          <Button 
            onClick={handlePromote}
            className="flex-1 h-11 bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-widest rounded shadow-lg shadow-primary/10 active:scale-95"
          >
            Confirm Acquisition
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
