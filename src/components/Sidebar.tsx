import React from 'react';
import { 
  Zap, 
  Moon, 
  Sun, 
  LayoutDashboard, 
  MapIcon, 
  ListFilter, 
  Briefcase, 
  History, 
  Settings, 
  UserIcon, 
  LogOut,
  Columns,
  Activity
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  theme: string;
  setTheme: React.Dispatch<React.SetStateAction<'light' | 'dark'>>;
  profile: any;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  theme,
  setTheme,
  profile,
  onLogout
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Monitor', icon: LayoutDashboard },
    { id: 'search', label: 'Scanner', icon: MapIcon },
    { id: 'leads', label: 'CRM Leads', icon: ListFilter },
    { id: 'kanban', label: 'Kanban Board', icon: Columns },
    { id: 'portfolio', label: 'Portfolio Vault', icon: Briefcase },
    { id: 'history', label: 'History', icon: History },
    { id: 'usage', label: 'API Usage', icon: Activity },
  ];

  return (
    <aside className="hidden lg:flex w-64 bg-card flex-col justify-between shrink-0 border-r border-border shadow-sm relative z-20 font-sans">
      <div className="flex flex-col h-full">
        <div className="logo flex items-center justify-between p-6 mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
              <Zap className="text-primary-foreground w-4 h-4" />
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground italic">prospect.io</span>
          </div>
          <button 
            onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
            className="w-8 h-8 flex items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground transition-colors"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-4 pt-2">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-2 px-3">General</p>
            <ul className="space-y-1">
              {menuItems.map((item) => (
                <li key={item.id}>
                  <button 
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-3 w-full text-left text-sm font-semibold rounded-md px-3 py-2 transition-all ${
                      activeTab === item.id 
                        ? 'bg-primary/10 text-primary' 
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    <item.icon className={`w-4 h-4 ${activeTab === item.id ? 'text-primary' : 'text-muted-foreground'}`} />
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {profile?.role === 'admin' && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-2 px-3">Administration</p>
              <ul className="space-y-1">
                <li>
                  <button 
                    onClick={() => setActiveTab('admin')}
                    className={`flex items-center gap-3 w-full text-left text-sm font-semibold rounded-md px-3 py-2 transition-all ${
                      activeTab === 'admin' 
                        ? 'bg-primary/10 text-primary' 
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    <Settings className={`w-4 h-4 ${activeTab === 'admin' ? 'text-primary' : 'text-muted-foreground'}`} />
                    System Config
                  </button>
                </li>
              </ul>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-border bg-secondary/30">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="w-9 h-9 rounded-full bg-card flex items-center justify-center shrink-0 border border-border shadow-sm">
              <UserIcon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-foreground truncate tracking-tight">{profile?.displayName?.split(' ')[0]} Admin</span>
              <span className="text-[9px] font-bold text-primary uppercase tracking-wider truncate">Pro Access License</span>
            </div>
          </div>
          <button 
            onClick={onLogout} 
            className="flex items-center gap-3 w-full text-muted-foreground hover:text-destructive font-bold text-xs px-3 py-2 rounded-md hover:bg-destructive/10 transition-all focus:outline-none"
          >
            <LogOut className="w-3.5 h-3.5" /> Terminal Exit
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
