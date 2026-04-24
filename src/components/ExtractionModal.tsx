import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EXTRACTION_STEPS } from '@/constants';

interface ExtractionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExtractionModal({ open, onOpenChange }: ExtractionModalProps) {
  const [extractionStep, setExtractionStep] = useState(0);

  useEffect(() => {
    let interval: any;
    if (open) {
      setExtractionStep(0);
      interval = setInterval(() => {
        setExtractionStep(prev => (prev + 1) % EXTRACTION_STEPS.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border border-border shadow-lg p-0 overflow-hidden rounded-lg">
        <div className="relative h-[220px] w-full bg-card flex flex-col items-center justify-center p-8 overflow-hidden">
          {/* Visual Background Pattern */}
          <div className="absolute inset-0 opacity-5 pointer-events-none">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(var(--primary)_0.5px,transparent_0.5px)] [background-size:16px_16px]" />
          </div>

          <div className="relative z-10 flex flex-col items-center text-center space-y-5">
            <div className="relative">
              <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
                <Zap className="w-6 h-6 text-primary fill-primary/10" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-foreground tracking-tight">Active Neural Extraction</h2>
              <div className="h-6 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.p 
                    key={extractionStep}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    className="text-primary font-mono text-[10px] tracking-widest uppercase font-bold"
                  >
                    {EXTRACTION_STEPS[extractionStep]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
          </div>
          
          <div className="absolute bottom-0 left-0 w-full h-1 bg-secondary">
            <motion.div 
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 15, ease: "linear" }}
              className="h-full bg-primary"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
