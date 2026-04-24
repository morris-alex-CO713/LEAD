import { motion } from 'motion/react';

export function LoadingView() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full"
          />
        </div>
        <p className="text-foreground font-bold uppercase tracking-[0.2em] text-[9px] opacity-40">Initializing Neural Protocol...</p>
      </div>
    </div>
  );
}
