import React from 'react';
import { 
  LayoutDashboard, 
  MapIcon, 
  ListFilter, 
  Briefcase, 
  Moon, 
  Sun 
} from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  theme: string;
  setTheme: React.Dispatch<React.SetStateAction<'light' | 'dark'>>;
}

const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  theme,
  setTheme
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Monitor', icon: LayoutDashboard },
    { id: 'search', label: 'Scanner', icon: MapIcon },
    { id: 'leads', label: 'CRM', icon: ListFilter },
    { id: 'portfolio', label: 'Clients', icon: Briefcase },
  ];

  return (
    <div className="lg:hidden fixed bottom-1 left-4 right-4 h-16 bg-card/80 backdrop-blur-xl border border-border shadow-2xl z-50 rounded-lg flex items-center justify-around px-2">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveTab(item.id)}
          className={`flex flex-col items-center justify-center gap-1 min-w-[64px] h-full transition-all ${
            activeTab === item.id ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <item.icon className="w-5 h-5" />
          <span className="text-[10px] font-black uppercase tracking-tight">{item.label}</span>
        </button>
      ))}
      <button
        onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
        className="flex flex-col items-center justify-center gap-1 min-w-[64px] h-full text-muted-foreground hover:text-primary transition-all"
      >
        {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        <span className="text-[10px] font-black uppercase tracking-tight">Theme</span>
      </button>
    </div>
  );
};

export default BottomNav;
