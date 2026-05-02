import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if the app is already installed/running in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      // Added a slight delay so it doesn't pop up instantly on load
      setTimeout(() => setShowPrompt(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm"
        >
          <div className="bg-card border border-border shadow-2xl rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
            <button 
              onClick={() => setShowPrompt(false)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                <Download className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 pr-4">
                <h3 className="font-bold text-base">Install Lean Gen</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Install our web app on your device for a faster, app-like experience with quick access.
                </p>
              </div>
            </div>
            
            <Button onClick={handleInstall} className="w-full font-bold shadow-lg shadow-primary/20">
              Install App
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
