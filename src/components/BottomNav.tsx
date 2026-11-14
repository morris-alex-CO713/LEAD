import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  MapIcon, 
  ListFilter, 
  Briefcase, 
  Moon, 
  Sun,
  Columns,
  Menu,
  X,
  Zap,
  History,
  Activity,
  Settings,
  LogOut,
  UserIcon,
  Bot
} from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  theme: string;
  setTheme: React.Dispatch<React.SetStateAction<'light' | 'dark'>>;
  profile?: any;
  onLogout?: () => void;
}

const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  theme,
  setTheme,
  profile,
  onLogout
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Monitor', icon: LayoutDashboard },
    { id: 'search', label: 'Scanner', icon: MapIcon },
    { id: 'leads', label: 'CRM', icon: ListFilter },
    { id: 'kanban', label: 'Kanban', icon: Columns },
    { id: 'portfolio', label: 'Clients', icon: Briefcase },
  ];

  const drawerItems = [
    { id: 'history', label: 'History', icon: History },
    { id: 'automation', label: 'Automation', icon: Bot },
    { id: 'usage', label: 'API Usage', icon: Activity },
  ];

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    setDrawerOpen(false);
  };

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card/90 backdrop-blur-xl border-b border-border z-50 flex items-center justify-between px-4 shadow-sm">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded flex items-center justify-center shadow-lg shadow-primary/20">
            <Zap className="text-primary-foreground w-3.5 h-3.5" />
          </div>
          <span className="text-base font-bold tracking-tight text-foreground italic">prospect.io</span>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
            className="w-8 h-8 flex items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground transition-colors"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {/* Hamburger */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground transition-colors"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Drawer Overlay */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer Panel */}
      <div className={`lg:hidden fixed top-0 right-0 h-full w-72 bg-card border-l border-border z-[70] flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-primary rounded flex items-center justify-center shadow-lg shadow-primary/20">
              <Zap className="text-primary-foreground w-3.5 h-3.5" />
            </div>
            <span className="text-base font-bold tracking-tight text-foreground italic">prospect.io</span>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-3 px-2">Navigation</p>

          {/* All nav items */}
          {[...navItems, ...drawerItems].map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`flex items-center gap-3 w-full text-left text-sm font-semibold rounded-md px-3 py-2.5 transition-all ${
                activeTab === item.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              <item.icon className={`w-4 h-4 ${activeTab === item.id ? 'text-primary' : 'text-muted-foreground'}`} />
              {item.label}
            </button>
          ))}

          {/* Admin section */}
          {profile?.role === 'admin' && (
            <>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-5 mb-3 px-2">Administration</p>
              <button
                onClick={() => handleNavClick('admin')}
                className={`flex items-center gap-3 w-full text-left text-sm font-semibold rounded-md px-3 py-2.5 transition-all ${
                  activeTab === 'admin'
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <Settings className={`w-4 h-4 ${activeTab === 'admin' ? 'text-primary' : 'text-muted-foreground'}`} />
                System Config
              </button>
            </>
          )}
        </nav>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-border bg-secondary/30">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="w-9 h-9 rounded-full bg-card flex items-center justify-center shrink-0 border border-border shadow-sm">
              <UserIcon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-foreground truncate tracking-tight">
                {profile?.displayName?.split(' ')[0] || 'User'} Admin
              </span>
              <span className="text-[9px] font-bold text-primary uppercase tracking-wider truncate">Pro Access License</span>
            </div>
          </div>
          {onLogout && (
            <button
              onClick={() => { onLogout(); setDrawerOpen(false); }}
              className="flex items-center gap-3 w-full text-muted-foreground hover:text-destructive font-bold text-xs px-3 py-2 rounded-md hover:bg-destructive/10 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" /> Terminal Exit
            </button>
          )}
        </div>
      </div>

      {/* Bottom Nav Bar */}
      <div className="lg:hidden fixed bottom-1 left-4 right-4 h-16 bg-card/80 backdrop-blur-xl border border-border shadow-2xl z-50 rounded-lg flex items-center justify-around px-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center gap-1 min-w-[52px] h-full transition-all ${
              activeTab === item.id ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[9px] font-black uppercase tracking-tight">{item.label}</span>
          </button>
        ))}
        {/* More button */}
        <button
          onClick={() => setDrawerOpen(true)}
          className={`flex flex-col items-center justify-center gap-1 min-w-[52px] h-full transition-all ${
            drawerItems.some(i => i.id === activeTab) ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase tracking-tight">More</span>
        </button>
      </div>
    </>
  );
};

export default BottomNav;
