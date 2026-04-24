import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface LoginViewProps {
  onLogin: (email: string, password: string) => boolean;
}

export function LoginView({ onLogin }: LoginViewProps) {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const handleLogin = () => {
    const success = onLogin(loginEmail, loginPassword);
    if (success) {
      toast.success("Welcome back, Akash!");
    } else {
      toast.error("Invalid credentials. Please use akash@prospect.com / prospect2026");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm bg-card border border-border shadow-2xl overflow-hidden rounded-md">
        <CardHeader className="text-left p-8 sm:p-10 space-y-2">
          <h1 className="text-3xl font-bold tracking-tighter text-foreground uppercase italic mb-4">prospect.io</h1>
          <CardTitle className="text-2xl font-bold tracking-tighter text-foreground uppercase">Access Terminal</CardTitle>
          <CardDescription className="text-muted-foreground font-medium tracking-tight text-sm">
            Secured gateway for high-density lead acquisition.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 sm:p-10 space-y-6 pt-0">
          <div className="space-y-5">
            <div className="space-y-2.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Email Address</label>
              <Input 
                type="email" 
                placeholder="akash@prospect.com" 
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="h-11 border-border bg-background rounded-md focus:ring-primary/20 transition-all font-medium"
              />
            </div>
            <div className="space-y-2.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Credentials</label>
              <Input 
                type="password" 
                placeholder="••••••••" 
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="h-11 border-border bg-background rounded-md focus:ring-primary/20 transition-all font-medium"
              />
            </div>
          </div>
          <Button 
            onClick={handleLogin} 
            className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-primary/10 mt-6"
          >
            Initialize Access
          </Button>
          <div className="text-center mt-8">
            <p className="text-[10px] text-muted-foreground/50 font-bold uppercase tracking-[0.3em]">Authorized Terminal Only</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
