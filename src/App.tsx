import { useState, useEffect, useRef } from 'react';
import { auth, db } from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot,
  collection,
  query,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { 
  OperationType, 
  handleFirestoreError, 
  testFirestoreConnection 
} from './lib/firestore-errors';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { 
  Plus, 
  CheckCircle, 
  ExternalLink,
  Trash2,
  Map as MapIcon,
  Trophy,
  History,
  LayoutDashboard,
  ShieldCheck,
  ChevronRight,
  User as UserIcon,
  MapPin,
  Settings,
  LogOut,
  Search,
  Loader2,
  Zap,
  Activity,
  BarChart3,
  Monitor,
  Star,
  ArrowUpRight,
  Globe,
  Calendar,
  Mail,
  PhoneCall,
  MessageSquare,
  ListFilter,
  TrendingDown,
  Radio,
  Sun,
  Moon,
  Columns as ColumnsIcon,
  TableProperties
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  DragDropContext, 
  Droppable, 
  Draggable, 
  DropResult 
} from '@hello-pangea/dnd';
import { motion, AnimatePresence } from 'motion/react';
import BusinessSelectorMap from './components/Map';
import { 
  BusinessResult,
  searchAndAuditBusinesses 
} from './lib/gemini';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
// --- Constants ---
const SUGGESTED_NICHES = [
  "Roofing Contractors",
  "Dental Clinics",
  "Auto Repair Shops",
  "Personal HVAC",
  "Plumbing Services",
  "Real Estate Agents",
  "Boutique Law Firms",
  "Local Gyms",
  "Pet Grooming",
  "Coffee Roasters"
];

// --- Types ---
interface BusinessListing extends BusinessResult {
  id: string;
  uid: string;
  status: 'new' | 'contacted' | 'qualified' | 'rejected' | 'closed';
  createdAt: any;
  connectionDone?: boolean;
  reachedMode?: 'Email' | 'LinkedIn' | 'Phone' | 'Other';
  outreachDrafts?: {
    email?: string;
    linkedin?: string;
    lastGenerated?: number;
  };
}

interface UserProfile {
  email: string;
  role: 'admin' | 'client';
  displayName: string;
}

interface ScanHistory {
  id: string;
  location: string;
  keyword: string;
  count: number;
  timestamp: any;
  results: BusinessResult[];
  radius?: number;
}

// --- App Component ---
export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('prospect_theme');
      if (saved) return saved as 'light' | 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  const [user, setUser] = useState<{ email: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [listings, setListings] = useState<BusinessListing[]>([]);
  const [scans, setScans] = useState<ScanHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchLocation, setSearchLocation] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchRadius, setSearchRadius] = useState(5); // Default 5km
  const [searchMaxResults, setSearchMaxResults] = useState(10); // Default 10 results
  const [activeTab, setActiveTab] = useState('dashboard');
  const [previousTab, setPreviousTab] = useState('dashboard');
  const [searchFilter, setSearchFilter] = useState('');
  const [dashboardFilter, setDashboardFilter] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<BusinessResult[]>([]);
  
  // CRM States
  const [crmSearch, setCrmSearch] = useState('');
  const [crmCategoryFilter, setCrmCategoryFilter] = useState<string | null>(null);
  const [crmStatusTab, setCrmStatusTab] = useState<'all' | 'reached'>('all');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Map state
  const [selectedLat, setSelectedLat] = useState(0);
  const [selectedLng, setSelectedLng] = useState(0);

  // Outreach & Kanban States
  const [selectedLeadForOutreach, setSelectedLeadForOutreach] = useState<BusinessListing | null>(null);
  const [generatingOutreach, setGeneratingOutreach] = useState(false);
  const [activeBoardView, setActiveBoardView] = useState<'list' | 'kanban'>('list');
  const mainContentRef = useRef<HTMLElement>(null);

  // Scroll to top on tab change
  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo(0, 0);
    }
  }, [activeTab, selectedLeadForOutreach]);

  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const openLeadDetail = (lead: BusinessListing) => {
    setPreviousTab(activeTab);
    setSelectedLeadForOutreach(lead);
    setActiveTab('lead-detail');
  };

  const closeLeadDetail = () => {
    setSelectedLeadForOutreach(null);
    setActiveTab(previousTab || 'dashboard');
  };

  const generateOutreach = async (lead: BusinessListing) => {
    if (!lead) return;
    setGeneratingOutreach(true);
    try {
      const prompt = `Synthesize a high-conversion, professional personalized outreach sequence for "${lead.name}".
      Target Industry: ${lead.category}
      Location: ${lead.address}
      
      Vulnerability Analysis:
      - SEO Infrastructure Score: ${lead.technicalAudit.seoScore}/10
      - Performance Latency: ${lead.technicalAudit.loadSpeed || 'Unknown'}
      - Domain Discovery Strategy: ${lead.outreachStrategy}
      
      Requirements:
      1. One concise, value-first Email centered on fixing their specific technical gaps.
      2. One high-engagement LinkedIn connection request note.
      3. Tone: Executive, strategic, and authoritative. Avoid generic fluff.`;

      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              email: { type: Type.STRING },
              linkedin: { type: Type.STRING }
            },
            required: ["email", "linkedin"]
          }
        }
      });

      const responseData = JSON.parse(response.text || '{}');
      
      const updatedLead = {
        ...lead,
        outreachDrafts: {
          email: responseData.email,
          linkedin: responseData.linkedin,
          lastGenerated: Date.now()
        }
      };
      
      setListings(prev => prev.map(l => l.id === lead.id ? updatedLead : l));
      setSelectedLeadForOutreach(updatedLead);
      if (activeTab !== 'lead-detail') {
        setActiveTab('lead-detail');
      }

      await updateDoc(doc(db, 'business_listings', lead.id), {
        outreachDrafts: updatedLead.outreachDrafts
      });
      
      toast.success("AI Outreach Drafts Generated!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate outreach drafts.");
    } finally {
      setGeneratingOutreach(false);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId as BusinessListing['status'];
    
    if (newStatus === listings.find(l => l.id === draggableId)?.status) return;

    setListings(prev => prev.map(l => l.id === draggableId ? { ...l, status: newStatus } : l));
    
    try {
      await updateDoc(doc(db, 'business_listings', draggableId), {
        status: newStatus
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status.");
    }
  };

  // Scan History Detail
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);

  // Manual Add Dialog
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  const [extractionStep, setExtractionStep] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const EXTRACTION_STEPS = [
    "Initializing neural acquisition...",
    "Deploying target discovery probes...",
    "Executing technical audit sequence...",
    "Evaluating market vertical density...",
    "Calculating lead potential vectors...",
    "Finalizing strategic data extraction..."
  ];

  useEffect(() => {
    let interval: any;
    if (searching) {
      setExtractionStep(0);
      interval = setInterval(() => {
        setExtractionStep(prev => (prev + 1) % EXTRACTION_STEPS.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [searching]);
  const [manualLead, setManualLead] = useState({
    name: '',
    address: '',
    category: '',
    website: '',
    phone: '',
    email: '',
  });

  useEffect(() => {
    // Apply theme
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    localStorage.setItem('prospect_theme', theme);
  }, [theme]);

  useEffect(() => {
    testFirestoreConnection();

    // Check local storage for persistent session
    const savedUser = localStorage.getItem('prospect_user');
    if (savedUser) {
      const u = JSON.parse(savedUser);
      setUser(u);
      setProfile({
        email: u.email,
        role: 'admin',
        displayName: 'Akash Admin'
      });
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setListings([]);
      setScans([]);
      return;
    }

    // Business Listings Subscription
    const listingsPath = 'business_listings';
    const qListings = query(collection(db, listingsPath), orderBy('createdAt', 'desc'));
    const unsubscribeListings = onSnapshot(qListings, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BusinessListing));
      setListings(data);
    }, (error) => {
      console.error("Listings error", error);
    });

    // Scans History Subscription
    const scansPath = 'scans';
    const qScans = query(collection(db, scansPath), orderBy('timestamp', 'desc'));
    const unsubscribeScans = onSnapshot(qScans, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScanHistory));
      setScans(data);
    });

    return () => {
      unsubscribeListings();
      unsubscribeScans();
    };
  }, [user]);

  const handleLogin = () => {
    if (loginEmail === 'akash@prospect.com' && loginPassword === 'prospect2026') {
      const u = { email: loginEmail };
      setUser(u);
      setProfile({
        email: loginEmail,
        role: 'admin',
        displayName: 'Akash Admin'
      });
      localStorage.setItem('prospect_user', JSON.stringify(u));
      toast.success("Welcome back, Akash!");
    } else {
      toast.error("Invalid credentials. Please use akash@prospect.com / prospect2026");
    }
  };

  const handleLogout = () => {
    setUser(null);
    setProfile(null);
    localStorage.removeItem('prospect_user');
    toast.success("Logged out successfully.");
  };

  const handleSearch = async () => {
    if (!searchLocation || !searchKeyword) {
      toast.error("Please enter both location and keyword.");
      return;
    }
    setSearching(true);
    try {
      const results = await searchAndAuditBusinesses(searchLocation, searchKeyword, searchRadius, searchMaxResults);
      if (results.length === 0) {
        toast.info("No businesses found or AI error.");
      } else {
        toast.success(`Found ${results.length} businesses!`);
        setSearchResults(results);
        setActiveTab('search-results');

        // Log to scan history with ALL results
        await addDoc(collection(db, 'scans'), {
          location: searchLocation,
          keyword: searchKeyword,
          count: results.length,
          timestamp: serverTimestamp(),
          uid: auth.currentUser?.uid || 'akash-prospect-admin',
          results: results,
          radius: searchRadius
        });
      }
    } catch (e) {
      toast.error("Search failed.");
    } finally {
      setSearching(false);
    }
  };

  const downloadCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    
    // Flatten logic for nested objects
    const flatten = (obj: any, prefix = '') => {
      let result: any = {};
      for (const key in obj) {
        const name = prefix ? `${prefix}_${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          Object.assign(result, flatten(obj[key], name));
        } else if (Array.isArray(obj[key])) {
          result[name] = obj[key].join('; ');
        } else {
          result[name] = obj[key];
        }
      }
      return result;
    };

    const flattenedData = data.map(item => flatten(item));
    const headers = Object.keys(flattenedData[0]).join(',');
    const rows = flattenedData.map(obj => 
      Object.keys(flattenedData[0]).map(header => {
        const val = obj[header];
        return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : (val === null || val === undefined ? '' : val);
      }).join(',')
    ).join('\n');

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers + "\n" + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const saveListing = async (biz: BusinessResult) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'business_listings'), {
        ...biz,
        uid: auth.currentUser?.uid || 'akash-prospect-admin',
        status: 'new',
        createdAt: serverTimestamp(),
        connectionDone: false
      });
      toast.success("Lead saved to dashboard!");
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'business_listings');
    }
  };

  const addManualLead = async () => {
    if (!manualLead.name) return toast.error("Business name is required");
    try {
      const bizData: any = {
        ...manualLead,
        socialLinks: [],
        rating: null,
        reviewsCount: 0,
        hasWebsite: !!manualLead.website,
        isWebsiteGood: true,
        auditComment: "Manually added lead",
        technicalAudit: { seoScore: 10, mobileFriendly: true, loadSpeed: 'Fast' },
        leadScore: 50,
        outreachStrategy: "Manual entry - research needed.",
        uid: auth.currentUser?.uid || 'akash-prospect-admin',
        status: 'new',
        createdAt: serverTimestamp(),
        connectionDone: false
      };
      await addDoc(collection(db, 'business_listings'), bizData);
      setIsManualAddOpen(false);
      setManualLead({ name: '', address: '', category: '', website: '', phone: '', email: '' });
      toast.success("Manual lead added!");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'business_listings');
    }
  };

  const updateStatus = async (id: string, status: BusinessListing['status']) => {
    try {
      await updateDoc(doc(db, 'business_listings', id), { status });
      toast.success(`Status updated to ${status}`);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'business_listings');
    }
  };

  const deleteListing = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'business_listings', id));
      toast.success("Lead removed.");
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'business_listings');
    }
  };

  const updateLeadStatus = async (id: string, updates: Partial<BusinessListing>) => {
    try {
      await updateDoc(doc(db, 'business_listings', id), updates);
      toast.success("Lead updated successfully.");
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'business_listings');
    }
  };

  const filteredListings = listings.filter(l => {
    const matchesSearch = l.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
           l.address.toLowerCase().includes(searchFilter.toLowerCase()) ||
           l.category.toLowerCase().includes(searchFilter.toLowerCase());
    if (!matchesSearch) return false;
    if (dashboardFilter === 'no-website') return !l.hasWebsite;
    if (dashboardFilter === 'poor-ux') return l.hasWebsite && !l.isWebsiteGood;
    if (dashboardFilter === 'high-priority') return (l.leadScore || 0) > 80;
    return true;
  });

  const exportToCSV = () => {
    if (listings.length === 0) return;
    const headers = ["Name", "Address", "Website", "Phone", "Email", "Category", "Status", "Lead Score"];
    const rows = listings.map(l => [
      l.name, l.address, l.website || "", l.phone || "", l.email || "", l.category, l.status, l.leadScore
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `prospect_leads_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV Exported successfully!");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background font-inter">
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
            />
          </div>
          <p className="text-foreground font-black uppercase tracking-[0.2em] text-[10px]">Accessing Secure Channels...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 font-inter">
        <Card className="w-full max-w-sm bg-card border border-border shadow-2xl overflow-hidden rounded-md">
          <CardHeader className="text-center p-8 space-y-2">
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 bg-primary rounded-md flex items-center justify-center shadow-lg shadow-primary/20">
                <ShieldCheck className="text-primary-foreground w-7 h-7" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">Sign in to Prospect.io</CardTitle>
            <CardDescription className="text-muted-foreground font-medium tracking-normal text-sm">
              Secured access for lead acquisition
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-4 pt-0">
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

  return (
    <div className="h-screen bg-background text-foreground font-inter flex overflow-hidden selection:bg-primary selection:text-primary-foreground">
      <Toaster position="top-right" expand={true} richColors theme={theme} />
      
      {/* SIDEBAR - Hidden on mobile */}
      <aside className="hidden lg:flex w-64 bg-card flex-col justify-between shrink-0 border-r border-border shadow-sm relative z-20">
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
                {[
                  { id: 'dashboard', label: 'Monitor', icon: LayoutDashboard },
                  { id: 'search', label: 'Scanner', icon: MapIcon },
                  { id: 'leads', label: 'CRM Leads', icon: ListFilter },
                  { id: 'history', label: 'History', icon: History },
                ].map((item) => (
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
              onClick={handleLogout} 
              className="flex items-center gap-3 w-full text-muted-foreground hover:text-destructive font-bold text-xs px-3 py-2 rounded-md hover:bg-destructive/10 transition-all focus:outline-none"
            >
              <LogOut className="w-3.5 h-3.5" /> Terminal Exit
            </button>
          </div>
        </div>
      </aside>

      {/* BOTTOM NAV - Mobile only */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around px-2 z-50 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        {[
          { id: 'dashboard', label: 'Monitor', icon: LayoutDashboard },
          { id: 'search', label: 'Scanner', icon: MapIcon },
          { id: 'leads', label: 'CRM', icon: ListFilter },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center gap-1 min-w-[64px] h-full transition-all ${
              activeTab === item.id ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-tight">{item.label}</span>
          </button>
        ))}
        <button
          onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
          className="flex flex-col items-center justify-center gap-1 min-w-[64px] h-full text-muted-foreground hover:text-primary transition-all"
        >
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          <span className="text-[10px] font-bold uppercase tracking-tight">Theme</span>
        </button>
      </div>

      {/* Extraction Modal */}
      <Dialog open={searching} onOpenChange={setSearching}>
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

      {/* MAIN CONTENT */}
      <main ref={mainContentRef} className={`flex-1 overflow-y-auto mb-16 lg:mb-0 ${activeTab === 'lead-detail' ? 'p-0' : 'p-4 sm:p-6 lg:p-12'}`}>
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
                key="dashboard"
                initial={{ opacity: 0, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.99 }}
                className="space-y-10"
              >
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-4 border-b border-border/60">
                  <div>
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground mb-1 lg:mb-2 text-left">Dashboard</h1>
                    <p className="text-muted-foreground font-medium text-xs sm:text-base lg:text-lg text-left">You have <span className="text-primary font-semibold">{listings.filter(l => l.status === 'new').length} new prospects</span> waiting for review.</p>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <Button variant="outline" onClick={exportToCSV} className="flex-1 sm:flex-none rounded-md border-border font-bold text-[10px] lg:text-[11px] uppercase tracking-wider h-10 px-4 lg:px-6 bg-card shadow-sm hover:bg-secondary hover:text-foreground transition-all">
                      Export Dataset
                    </Button>
                    <Button onClick={() => setActiveTab('search')} className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 font-bold text-[10px] lg:text-[11px] uppercase tracking-wider px-4 lg:px-8 h-10 rounded-md gap-2 transition-all active:scale-95">
                      <Plus className="w-4 h-4" /> Acquire
                    </Button>
                  </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 lg:gap-6">
                  <div className="col-span-1 md:col-span-1 lg:col-span-4 bg-card rounded-md p-6 shadow-sm border border-border relative overflow-hidden group transition-all hover:shadow-md">
                    <p className="text-muted-foreground font-bold text-[10px] uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                       <BarChart3 className="w-4 h-4 text-primary" /> Pipeline Stats
                    </p>
                    <div className="flex justify-between items-end relative z-10">
                        <div>
                          <h3 className="text-2xl lg:text-3xl font-bold text-foreground mb-0.5 tracking-tight">{listings.length}</h3>
                          <p className="text-muted-foreground font-bold text-[10px] uppercase tracking-widest">Total Active</p>
                        </div>
                        <div className="text-right">
                          <h3 className="text-2xl lg:text-3xl font-bold text-foreground mb-0.5 tracking-tight">
                            {listings.filter(l => l.status === 'qualified').length}
                          </h3>
                          <p className="text-muted-foreground font-bold text-[10px] uppercase tracking-widest">Qualified</p>
                        </div>
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-1 lg:col-span-4 bg-card rounded-md p-6 shadow-sm border border-border relative overflow-hidden group transition-all hover:shadow-md">
                    <div className="flex justify-between mb-4 relative z-10">
                       <p className="text-muted-foreground font-bold text-[10px] uppercase tracking-[0.2em] flex items-center gap-2">
                         <Zap className="w-4 h-4 text-primary" /> Discovery
                       </p>
                       <span className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest">Growth</span>
                    </div>
                    <div className="flex items-center gap-4 lg:gap-8 relative z-10">
                        <div>
                          <h3 className="text-2xl lg:text-3xl font-bold text-foreground mb-0.5 tracking-tight">{scans.length}</h3>
                          <p className="text-muted-foreground font-bold text-[10px] uppercase tracking-widest">Total Scans</p>
                        </div>
                        <div className="flex-1 h-1.5 lg:h-2 bg-secondary rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: "70%" }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="h-full bg-primary rounded-full"
                          />
                        </div>
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-primary rounded-md p-6 shadow-xl relative overflow-hidden flex flex-col justify-between border border-primary/20 transition-all hover:scale-[1.01]">
                    <p className="text-primary-foreground/70 font-bold text-[10px] uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                       <Star className="w-4 h-4 text-amber-300" /> Momentum
                    </p>
                    <div>
                      <h3 className="text-3xl font-bold text-primary-foreground flex items-center gap-2 tracking-tighter italic">
                        24% <ArrowUpRight className="w-6 h-6 text-amber-300" />
                      </h3>
                      <p className="text-primary-foreground/70 font-bold text-[10px] uppercase tracking-widest mt-1">Lead Velocity Factor</p>
                    </div>
                    {/* Decorative background element */}
                    <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                  </div>
                </div>

                <div className="space-y-8 pt-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border/60">
                    <h2 className="text-xl lg:text-2xl font-bold text-foreground tracking-tight">Recent Acquisitions</h2>
                    <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                       <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input 
                            placeholder="Search database..." 
                            className="pl-11 h-10 w-full md:w-64 lg:w-72 border-border bg-card shadow-sm rounded-md font-medium text-sm placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/10 transition-all"
                            value={searchFilter}
                            onChange={(e) => setSearchFilter(e.target.value)}
                          />
                       </div>
                      <div className="flex gap-2">
                        <div className="flex gap-1 bg-secondary p-1 rounded-md">
                          <button 
                            onClick={() => setActiveBoardView('list')}
                            className={`p-1.5 rounded-sm transition-all ${activeBoardView === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                          >
                            <TableProperties className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setActiveBoardView('kanban')}
                            className={`p-1.5 rounded-sm transition-all ${activeBoardView === 'kanban' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                          >
                            <ColumnsIcon className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex gap-1 bg-secondary p-1 rounded-md overflow-x-auto no-scrollbar">
                       {[
                         { id: null, label: 'All' },
                         { id: 'no-website', label: 'No Web' },
                         { id: 'poor-ux', label: 'Legacy' },
                         { id: 'high-priority', label: 'Priority' }
                       ].map(f => (
                         <button
                           key={f.id}
                           onClick={() => setDashboardFilter(f.id)}
                           className={`text-[9px] font-bold px-3 lg:px-4 py-2 rounded-sm transition-all uppercase tracking-wider whitespace-nowrap ${
                             dashboardFilter === f.id 
                               ? 'bg-card text-foreground shadow-sm' 
                               : 'text-muted-foreground hover:text-foreground'
                           }`}
                         >
                           {f.label}
                         </button>
                       ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {activeBoardView === 'list' ? (
                  <div className="grid grid-cols-1 gap-2">
                    {filteredListings.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-12 bg-card rounded-md border border-border shadow-sm">
                         <LayoutDashboard className="w-8 h-8 text-muted-foreground/20 mb-4" />
                         <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">No active data streams</p>
                      </div>
                    ) : (
                      filteredListings.map((l) => (
                        <motion.div 
                          layout
                          key={l.id} 
                          className="group flex items-center justify-between p-3 bg-card border border-border rounded-md hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer relative overflow-hidden"
                          onClick={() => openLeadDetail(l)}
                        >
                          <div className="flex items-center gap-3">
                             <div 
                               className={`w-9 h-9 rounded flex items-center justify-center shrink-0 border border-border transition-all ${
                                 l.status === 'qualified' ? 'bg-emerald-500/10 text-emerald-500' :
                                 l.status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                                 l.status === 'contacted' ? 'bg-primary/10 text-primary' : 
                                 l.status === 'closed' ? 'bg-blue-500/10 text-blue-500' :
                                 'bg-secondary text-muted-foreground'
                               } ${l.website ? 'hover:scale-105 hover:shadow-md cursor-pointer active:scale-95' : ''}`}
                               onClick={(e) => {
                                 if (l.website) {
                                    e.stopPropagation();
                                    window.open(l.website, '_blank');
                                 }
                               }}
                             >
                                {l.status === 'qualified' ? <CheckCircle className="w-5 h-5" /> :
                                 l.status === 'rejected' ? <Trash2 className="w-5 h-5" /> :
                                 l.status === 'contacted' ? <MessageSquare className="w-5 h-5" /> : 
                                 l.status === 'closed' ? <Trophy className="w-5 h-5" /> :
                                 <UserIcon className="w-5 h-5" />}
                             </div>
                             <div>
                                <h4 className="font-bold text-foreground text-sm tracking-tight flex items-center gap-2">
                                  {l.name}
                                  <Badge variant="outline" className="text-[8px] font-black px-1 py-0 uppercase border-none bg-secondary/50">
                                    {l.status}
                                  </Badge>
                                  {l.rating && (
                                    <span className="flex items-center gap-1 text-[8px] text-amber-500 bg-amber-500/10 px-1 py-0.5 rounded font-black border border-amber-500/20">
                                      <Star className="w-2.5 h-2.5 fill-current" /> {l.rating}
                                    </span>
                                  )}
                                </h4>
                                <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                   {l.category} <span className="w-1 h-1 bg-border rounded-full" /> {l.address}
                                </p>
                             </div>
                          </div>

                          <div className="flex items-center gap-2 lg:gap-6">
                             <div className="hidden sm:flex items-center gap-3">
                               <div className="flex flex-col items-end">
                                 <div className="flex items-center gap-2 mb-0.5">
                                   <div className={`w-1.5 h-1.5 rounded-full ${
                                     l.hasWebsite ? (l.isWebsiteGood ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-destructive'
                                   }`} />
                                   <span className={`text-[9px] font-bold uppercase tracking-wider ${
                                     l.hasWebsite ? (l.isWebsiteGood ? 'text-emerald-500' : 'text-amber-500') : 'text-destructive'
                                   }`}>
                                      {l.hasWebsite ? (l.isWebsiteGood ? 'Optimized' : 'Legacy') : 'Offline'}
                                   </span>
                                 </div>
                                 <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{l.leadScore} Score</p>
                               </div>
                            </div>

                            <div className="flex items-center gap-2">
                               <ArrowUpRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                            </div>
                          </div>
                       </motion.div>
                      ))
                    )}
                  </div>
                ) : (
                  <DragDropContext onDragEnd={onDragEnd}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-10 overflow-x-auto min-h-[600px] no-scrollbar">
                      {(['new', 'qualified', 'contacted', 'closed'] as const).map(status => (
                        <Droppable droppableId={status} key={status}>
                          {(provided, snapshot) => (
                            <div 
                              {...provided.droppableProps}
                              ref={provided.innerRef}
                              className={`flex flex-col h-full bg-secondary/20 rounded-md p-4 min-h-[500px] border border-border/30 transition-colors ${snapshot.isDraggingOver ? 'bg-primary/5 border-primary/20' : ''}`}
                            >
                              <div className="flex items-center justify-between mb-6 px-1">
                                <h4 className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.25em] flex items-center gap-2">
                                  <div className={`w-1.5 h-1.5 rounded-full ${
                                    status === 'new' ? 'bg-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]' :
                                    status === 'qualified' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                                    status === 'contacted' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' :
                                    'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                                  }`} />
                                  {status}
                                </h4>
                                <span className="text-[9px] font-black text-muted-foreground/50 bg-secondary px-1.5 py-0.5 rounded border border-border/50">
                                  {listings.filter(l => l.status === status).length}
                                </span>
                              </div>

                              <div className="flex flex-col gap-3 h-full">
                                {listings.filter(l => l.status === status).map((biz, index) => {
                                  return (
                                    // @ts-expect-error - key is required by React but not in DraggableProps
                                    <Draggable draggableId={biz.id} index={index} key={biz.id}>
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          onClick={() => openLeadDetail(biz)}
                                          className={`bg-card p-4 rounded-sm border border-border shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group relative overflow-hidden ${snapshot.isDragging ? 'shadow-2xl border-primary scale-[1.02] z-50' : ''}`}
                                        >
                                          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                          <h5 className="font-bold text-xs text-foreground truncate mb-1 tracking-tight">{biz.name}</h5>
                                          <div className="flex items-center justify-between mb-4">
                                            <p className="text-[9px] text-muted-foreground font-medium truncate">{biz.category}</p>
                                            <div className={`px-1 rounded text-[8px] font-black ${biz.technicalAudit.seoScore > 7 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                              {biz.technicalAudit.seoScore}/10
                                            </div>
                                          </div>
                                          
                                          <div className="flex items-center justify-between pt-3 border-t border-border/50 bg-secondary/5 -mx-4 px-4 mt-auto">
                                            <div className="flex items-center gap-3">
                                              <div className="flex flex-col">
                                                <span className="text-[8px] font-black text-primary uppercase tracking-tighter leading-none">{biz.leadScore}</span>
                                                <span className="text-[6px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Propensity</span>
                                              </div>
                                              <div className="w-[1px] h-4 bg-border/50" />
                                              <div className="flex flex-col">
                                                <span className="text-[8px] font-black text-foreground uppercase tracking-tighter leading-none">{biz.technicalAudit.loadSpeed.replace('s', '')}s</span>
                                                <span className="text-[6px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Latency</span>
                                              </div>
                                            </div>
                                            {biz.website && <Globe className="w-2.5 h-2.5 text-muted-foreground/30" />}
                                          </div>
                                        </div>
                                      )}
                                    </Draggable>
                                  );
                                })}
                                {provided.placeholder}
                              </div>
                            </div>
                          )}
                        </Droppable>
                      ))}
                    </div>
                   </DragDropContext>
                )}
                </motion.div>
              )}

              {activeTab === 'search' && (
                <motion.div 
              key="search"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-6xl mx-auto space-y-10"
            >
                <header className="text-left space-y-1 sm:space-y-1.5">
                 <p className="text-[10px] font-bold text-primary uppercase tracking-[0.3em]">Business Discovery</p>
                 <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground">Acquisition Engine</h1>
                 <p className="text-muted-foreground font-medium text-xs sm:text-base lg:text-lg max-w-2xl">
                   Identify high-potential leads with legacy digital footprints across any geographic region.
                 </p>
               </header>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7">
                  <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden relative group">
                    <div className="p-5 border-b border-border flex justify-between items-center bg-card relative z-10">
                       <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-primary rounded-md flex items-center justify-center shadow-md">
                             <MapIcon className="w-4 h-4 text-primary-foreground" />
                          </div>
                          <div>
                             <h4 className="font-bold text-foreground text-sm tracking-tight">Geo-Targeting</h4>
                             <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Focus coordinates</p>
                          </div>
                       </div>
                       <Badge variant="secondary" className="font-bold text-[9px] tracking-widest px-3 py-1">v2.4 EXTRACTION</Badge>
                    </div>
                    <div className="relative h-[380px]">
                       <BusinessSelectorMap 
                         lat={selectedLat} 
                         lng={selectedLng} 
                         radius={searchRadius}
                         onSelect={(lat, lng) => {
                           setSelectedLat(lat);
                           setSelectedLng(lng);
                           if(!searchLocation) setSearchLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                         }} 
                       />
                       <div className="absolute bottom-6 left-6 right-6">
                          <div className="bg-card/90 backdrop-blur-md p-3.5 rounded-lg border border-border shadow-lg flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                <MapPin className="text-primary w-4 h-4" />
                                <span className="font-bold text-foreground text-xs tracking-tight truncate max-w-[200px]">
                                   {selectedLat ? `${selectedLat.toFixed(6)}, ${selectedLng.toFixed(6)}` : "Deploy Marker to Target"}
                                </span>
                             </div>
                             <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                          </div>
                       </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 space-y-5">
                  <div className="bg-card rounded-lg p-5 shadow-sm border border-border">
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Target Location</label>
                          <Input 
                            placeholder="e.g. Austin, TX" 
                            value={searchLocation}
                            onChange={(e) => setSearchLocation(e.target.value)}
                            className="h-11 border-border rounded-md font-bold px-5 bg-secondary focus:bg-card transition-all"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Market Vertical</label>
                          <Input 
                            placeholder="e.g. Plumbers" 
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                            className="h-11 border-border rounded-md font-bold px-5 bg-secondary focus:bg-card transition-all"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1.5">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Radius (KM)</label>
                              <Input 
                                type="number"
                                placeholder="5" 
                                value={searchRadius}
                                onChange={(e) => setSearchRadius(Number(e.target.value))}
                                className="h-11 border-border rounded-md font-bold px-5 bg-secondary focus:bg-card transition-all"
                              />
                           </div>
                           <div className="space-y-1.5">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Max Results</label>
                              <Input 
                                type="number"
                                placeholder="10" 
                                value={searchMaxResults}
                                onChange={(e) => setSearchMaxResults(Number(e.target.value))}
                                className="h-11 border-border rounded-md font-bold px-5 bg-secondary focus:bg-card transition-all"
                              />
                           </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Suggested</label>
                        <div className="flex flex-wrap gap-2">
                          {SUGGESTED_NICHES.map(niche => (
                            <button 
                              key={niche}
                              onClick={() => setSearchKeyword(niche)}
                              className={`text-[9px] px-3 py-1.5 rounded-sm border transition-all font-bold uppercase tracking-wider ${
                                searchKeyword === niche 
                                  ? 'bg-primary text-primary-foreground border-primary shadow-sm' 
                                  : 'bg-card text-muted-foreground border-border hover:border-muted-foreground'
                              }`}
                            >
                              {niche}
                            </button>
                          ))}
                        </div>
                      </div>

                      <Button 
                        onClick={handleSearch} 
                        disabled={searching}
                        className="w-full h-11 font-bold text-[10px] uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-3"
                      >
                        {searching ? "Extracting Data..." : "Run Extraction"}
                        {!searching && <ChevronRight className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <Card className="bg-foreground rounded-md p-5 text-background border-none shadow-xl overflow-hidden relative group">
                     <Settings className="absolute -right-6 -bottom-6 w-20 h-20 text-background/5 rotate-12" />
                     <h3 className="text-base font-bold mb-4 tracking-tight">Protocol</h3>
                     <ul className="space-y-3">
                        {[
                          'Exhaustive location crawl',
                          'AI digital asset audit',
                          'Direct delivery to pipeline'
                        ].map((item, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-[10px] font-medium text-background/60">
                             <CheckCircle className="w-3.5 h-3.5 text-lime-400 shrink-0" />
                             {item}
                          </li>
                        ))}
                     </ul>
                  </Card>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'search-results' && (
            <motion.div 
              key="search-results"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
               <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 pb-4 border-b border-border overflow-hidden">
                 <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] mb-1 sm:mb-2">Discovery Results</p>
                    <h1 className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight text-foreground truncate">Extraction Report</h1>
                    <p className="text-muted-foreground font-medium text-[9px] sm:text-[10px] lg:text-xs mt-0.5 sm:mt-1 truncate">Detected {searchResults.length} targets for {searchLocation}.</p>
                 </div>
                 <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                   <Button variant="outline" size="sm" onClick={() => downloadCSV(searchResults, 'search_extraction')} className="flex-1 sm:flex-none border-border font-bold text-[8px] sm:text-[9px] uppercase tracking-wider h-8 sm:h-10 px-3 sm:px-4 bg-card shadow-sm hover:bg-secondary">
                     Export
                   </Button>
                   <Button variant="outline" size="sm" onClick={() => setActiveTab('search')} className="flex-1 sm:flex-none border-border font-bold text-[8px] sm:text-[9px] uppercase tracking-wider h-8 sm:h-10 px-3 sm:px-4 bg-card shadow-sm hover:bg-secondary">
                     Reset
                   </Button>
                   <Button 
                     size="sm"
                     className="flex-1 sm:flex-none font-bold text-[8px] sm:text-[9px] uppercase tracking-wider h-8 sm:h-10 px-4 sm:px-6 shadow-md active:scale-95 transition-all w-full sm:w-auto mt-2 sm:mt-0"
                     onClick={() => {
                       searchResults.forEach(saveListing);
                       toast.success("Strategic data merged!");
                     }}
                   >
                     Save to CRM
                   </Button>
                 </div>
               </header>

              <div className="bg-card rounded-md border border-border shadow-sm overflow-x-auto">
                <Table className="min-w-[800px] lg:min-w-full">
                  <TableHeader>
                    <TableRow className="bg-secondary/30 hover:bg-secondary/30 border-b border-border">
                      <TableHead className="text-muted-foreground font-bold text-[9px] uppercase tracking-wider px-6 h-11">Target Identity</TableHead>
                      <TableHead className="text-muted-foreground font-bold text-[9px] uppercase tracking-wider px-6 h-11">AI Audit Report</TableHead>
                      <TableHead className="text-muted-foreground font-bold text-[9px] uppercase tracking-wider px-6 h-11 text-center">Lead Strength</TableHead>
                      <TableHead className="text-muted-foreground font-bold text-[9px] uppercase tracking-wider px-6 h-11">Operational Comms</TableHead>
                      <TableHead className="text-muted-foreground font-bold text-[9px] uppercase tracking-wider px-6 h-11 text-right pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((biz, idx) => {
                      const alreadySaved = listings.some(l => l.name === biz.name);
                      return (
                        <TableRow 
                          key={idx} 
                          className="border-b border-border hover:bg-secondary/40 transition-all group cursor-pointer"
                          onClick={() => openLeadDetail(biz)}
                        >
                          <TableCell className="px-6 py-3">
                             <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-foreground flex items-center justify-center text-background font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
                                   {biz.name.charAt(0)}
                                </div>
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                     <span className="font-bold text-foreground text-[13px] tracking-tight">{biz.name}</span>
                                     {biz.website && (
                                       <a 
                                          href={biz.website} 
                                          target="_blank" 
                                          rel="noreferrer" 
                                          className="text-muted-foreground hover:text-primary transition-colors"
                                          onClick={e => e.stopPropagation()}
                                       >
                                          <ExternalLink className="w-3 h-3" />
                                       </a>
                                     )}
                                  </div>
                                  <span className="text-[10px] font-medium text-muted-foreground truncate max-w-[180px]">{biz.address}</span>
                                </div>
                             </div>
                          </TableCell>
                          <TableCell className="px-6 py-3">
                            <div className="flex flex-col gap-1.5">
                               <div className="flex items-center gap-2">
                                  {biz.hasWebsite ? (
                                    biz.isWebsiteGood ? (
                                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-none px-1.5 py-0 text-[8px] font-bold uppercase tracking-wider rounded-sm">Optimized</Badge>
                                    ) : (
                                      <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-none px-1.5 py-0 text-[8px] font-bold uppercase tracking-wider rounded-sm">Legacy</Badge>
                                    )
                                  ) : (
                                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-none px-1.5 py-0 text-[8px] font-bold uppercase tracking-wider rounded-sm">Dark Target</Badge>
                                  )}
                               </div>
                               <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                     <Monitor className="w-3 h-3 text-border" /> {biz.technicalAudit.loadSpeed}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                     <Zap className="w-3 h-3 text-border" /> SEO: {biz.technicalAudit.seoScore}
                                  </div>
                                </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-6 py-3">
                             <div className="flex flex-col items-center gap-1">
                                <div className={`px-2 py-0.5 rounded text-[11px] font-bold shadow-inner ${
                                  biz.leadScore > 75 ? 'bg-destructive/10 text-destructive' :
                                  biz.leadScore > 40 ? 'bg-primary/10 text-primary' :
                                  'bg-secondary text-muted-foreground'
                                }`}>
                                   {biz.leadScore}
                                </div>
                                {biz.rating && (
                                  <span className="flex items-center gap-1 text-[8px] font-bold text-amber-500 uppercase tracking-widest">
                                     <Star className="w-2.5 h-2.5 fill-current" /> {biz.rating}
                                  </span>
                                )}
                             </div>
                          </TableCell>
                          <TableCell className="px-6 py-3">
                            <div className="flex flex-col text-[10px] font-medium text-muted-foreground gap-1 mt-1">
                               <div className="flex items-center gap-2 italic">
                                  <PhoneCall className="w-2.5 h-2.5 opacity-50" />
                                  {biz.phone || "Private"}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Mail className="w-2.5 h-2.5 opacity-50" />
                                  {biz.email || "Missing"}
                                </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-6 py-3 text-right pr-6">
                            <Button 
                              size="sm"
                              variant={alreadySaved ? "ghost" : "default"}
                              className={`rounded font-bold text-[9px] uppercase tracking-wider px-3 h-8 transition-all active:scale-95 shadow-sm ${
                                alreadySaved ? 'text-muted-foreground/40 cursor-not-allowed' : ''
                              }`}
                              onClick={() => saveListing(biz)}
                              disabled={alreadySaved}
                            >
                              {alreadySaved ? "Saved" : "Add to CRM"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              {searchResults.length > itemsPerPage && (
                <div className="flex items-center justify-between pt-6 border-t border-border">
                   <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Showing Page {currentPage} of {Math.ceil(searchResults.length / itemsPerPage)}
                   </p>
                   <div className="flex gap-1.5">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        className="h-9 px-4 rounded-md font-bold border-border text-muted-foreground hover:bg-secondary transition-all"
                      >
                        Prev
                      </Button>
                      <div className="flex gap-1 items-center px-1">
                         {Array.from({ length: Math.ceil(searchResults.length / itemsPerPage) }).map((_, i) => (
                           <button
                             key={i}
                             onClick={() => setCurrentPage(i + 1)}
                             className={`w-9 h-9 rounded-md font-bold text-xs transition-all ${
                               currentPage === i + 1 
                                 ? 'bg-primary text-primary-foreground shadow-md' 
                                 : 'bg-card text-muted-foreground border border-border hover:border-muted-foreground hover:text-foreground'
                             }`}
                           >
                             {i + 1}
                           </button>
                         ))}
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={currentPage === Math.ceil(searchResults.length / itemsPerPage)}
                        onClick={() => setCurrentPage(prev => Math.min(Math.ceil(searchResults.length / itemsPerPage), prev + 1))}
                        className="h-9 px-4 rounded-md font-bold border-border text-muted-foreground hover:bg-secondary transition-all"
                      >
                        Next
                      </Button>
                   </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'leads' && (
            <motion.div 
              key="leads"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 pb-6 border-b border-border">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] mb-1 sm:mb-2 leading-none">Intelligence Command</p>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-foreground uppercase truncate">CRM Lead Database</h1>
                  <p className="text-muted-foreground font-medium text-[11px] sm:text-xs mt-2 max-w-lg truncate">Manage your targets and track outreach synchronization status.</p>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                   <Button 
                    variant="outline" 
                    size="sm"
                    onClick={exportToCSV}
                    className="flex-1 sm:flex-none h-10 px-5 rounded-md border-border font-bold text-[9px] uppercase tracking-widest bg-card shadow-sm hover:bg-secondary transition-all"
                   >
                     Export
                   </Button>
                </div>
              </header>

              {/* Filters & Tools */}
              <div className="flex flex-col gap-6">
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2 relative group">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                       <Input 
                         placeholder="Search repository by name, address or niche..." 
                         className="pl-12 h-11 bg-card border-border rounded-md shadow-sm focus:ring-1 focus:ring-primary/20 transition-all font-medium text-sm"
                         value={crmSearch}
                         onChange={(e) => setCrmSearch(e.target.value)}
                       />
                    </div>
                    <div className="flex items-center gap-1.5 p-1 bg-secondary/50 border border-border rounded-md shadow-sm">
                       <button 
                         onClick={() => setCrmStatusTab('all')}
                         className={`flex-1 h-9 rounded-sm text-[9px] font-bold uppercase tracking-widest transition-all ${
                            crmStatusTab === 'all' ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:bg-card'
                         }`}
                       >
                         Active Leads
                       </button>
                       <button 
                         onClick={() => setCrmStatusTab('reached')}
                         className={`flex-1 h-9 rounded-sm text-[9px] font-bold uppercase tracking-widest transition-all ${
                            crmStatusTab === 'reached' ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:bg-card'
                         }`}
                       >
                         Reached
                       </button>
                    </div>
                    <div className="flex items-center gap-2">
                       <select 
                         className="w-full h-11 bg-card border-border rounded-md px-4 shadow-sm text-xs font-bold uppercase tracking-wider text-foreground outline-none focus:ring-1 focus:ring-primary/20"
                         onChange={(e) => setCrmCategoryFilter(e.target.value === 'all' ? null : e.target.value)}
                       >
                          <option value="all">All Categories</option>
                          {Array.from(new Set(listings.map(l => l.category))).map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                       </select>
                    </div>
                 </div>

                 <div className="flex flex-wrap gap-2">
                    {SUGGESTED_NICHES.slice(0, 6).map(niche => (
                      <button 
                        key={niche}
                        onClick={() => setCrmSearch(niche)}
                        className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-[9px] font-bold text-muted-foreground uppercase tracking-widest rounded-sm transition-all border border-border"
                      >
                        {niche}
                      </button>
                    ))}
                 </div>
              </div>

              {/* Data Table */}
              <div className="bg-card rounded-md border border-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto selection:bg-primary/10">
                  <Table className="min-w-[800px] lg:min-w-full">
                    <TableHeader>
                      <TableRow className="bg-secondary/30 hover:bg-secondary/30 border-b border-border">
                        <TableHead className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-4 sm:px-8 h-12 sm:h-14">Target Intel</TableHead>
                        <TableHead className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-4 sm:px-8 h-12 sm:h-14">Extraction Date</TableHead>
                        <TableHead className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-4 sm:px-8 h-12 sm:h-14">Engagement Status</TableHead>
                        <TableHead className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-4 sm:px-8 h-12 sm:h-14">Efficiency</TableHead>
                        <TableHead className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-4 sm:px-8 h-12 sm:h-14 text-right pr-4 sm:pr-8">Strategic Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {listings
                        .filter(l => {
                          const matchesCrmSearch = l.name.toLowerCase().includes(crmSearch.toLowerCase()) || 
                                                 l.category.toLowerCase().includes(crmSearch.toLowerCase()) ||
                                                 l.address.toLowerCase().includes(crmSearch.toLowerCase());
                          const matchesStatus = crmStatusTab === 'all' ? true : l.connectionDone;
                          const matchesCategory = crmCategoryFilter ? l.category === crmCategoryFilter : true;
                          return matchesCrmSearch && matchesStatus && matchesCategory;
                        })
                        .length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-64 text-center">
                             <div className="space-y-4">
                                <div className="w-12 h-12 bg-secondary rounded flex items-center justify-center mx-auto">
                                   <Search className="w-5 h-5 text-muted-foreground/30" />
                                </div>
                                <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">No intelligence records found matching your filters</p>
                             </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        listings
                          .filter(l => {
                            const matchesCrmSearch = l.name.toLowerCase().includes(crmSearch.toLowerCase()) || 
                                                   l.category.toLowerCase().includes(crmSearch.toLowerCase()) ||
                                                   l.address.toLowerCase().includes(crmSearch.toLowerCase());
                            const matchesStatus = crmStatusTab === 'all' ? true : l.connectionDone;
                            const matchesCategory = crmCategoryFilter ? l.category === crmCategoryFilter : true;
                            return matchesCrmSearch && matchesStatus && matchesCategory;
                          })
                          .map((lead) => (
                          <TableRow 
                            key={lead.id} 
                            className="group hover:bg-secondary/40 transition-all border-b border-border cursor-pointer"
                            onClick={() => openLeadDetail(lead)}
                          >
                            <TableCell className="px-8 py-5">
                               <div className="flex items-center gap-4">
                                  <div className={`w-10 h-10 rounded flex items-center justify-center text-xs font-black shadow-sm transition-transform group-hover:scale-105 ${
                                    lead.connectionDone ? 'bg-primary text-primary-foreground' : 'bg-foreground text-background'
                                  }`}>
                                     {lead.name.charAt(0)}
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                     <h3 className="font-bold text-foreground text-sm tracking-tight leading-none mb-1.5 truncate max-w-[200px]">{lead.name}</h3>
                                     <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="border-none text-[8px] font-black uppercase rounded px-1.5 py-0">{lead.category}</Badge>
                                        <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[150px]">{lead.address}</span>
                                     </div>
                                  </div>
                               </div>
                            </TableCell>
                            <TableCell className="px-8 py-5">
                               <div className="flex items-center gap-2 text-muted-foreground">
                                  <Calendar className="w-3 h-3 opacity-50" />
                                  <span className="text-xs font-bold">
                                    {lead.createdAt?.seconds ? new Date(lead.createdAt.seconds * 1000).toLocaleDateString() : 'Active Session'}
                                  </span>
                               </div>
                            </TableCell>
                            <TableCell className="px-8 py-5">
                               {lead.connectionDone ? (
                                 <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2 text-primary">
                                       <CheckCircle className="w-3.5 h-3.5" />
                                       <span className="text-[9px] font-black uppercase tracking-wider">Sync Established</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                       <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[8px] font-bold uppercase tracking-widest px-1.5 py-0">
                                          via {lead.reachedMode || 'Unknown'}
                                       </Badge>
                                    </div>
                                 </div>
                               ) : (
                                 <div className="flex items-center gap-2 text-muted-foreground">
                                    <div className="w-1.5 h-1.5 rounded-full bg-border" />
                                    <span className="text-[9px] font-bold uppercase tracking-widest">Pending Outreach</span>
                                 </div>
                               )}
                            </TableCell>
                            <TableCell className="px-8 py-5">
                               <div className="flex flex-col gap-1">
                                  <div className="flex items-center justify-between text-[9px] font-black text-muted-foreground mb-1">
                                     <span>LEAD SCORE</span>
                                     <span className={lead.leadScore > 75 ? 'text-primary' : 'text-foreground'}>{lead.leadScore}%</span>
                                  </div>
                                  <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
                                     <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${lead.leadScore}%` }}
                                      className={`h-full rounded-full ${lead.leadScore > 75 ? 'bg-primary' : 'bg-muted-foreground/30'}`} 
                                     />
                                  </div>
                               </div>
                            </TableCell>
                            <TableCell className="px-8 py-5 text-right pr-8">
                               <div className="flex items-center justify-end gap-2">
                                  {!lead.connectionDone ? (
                                    <div className="flex gap-1.5">
                                       {['Email', 'LinkedIn', 'Phone'].map((mode) => (
                                         <Button 
                                           key={mode}
                                           size="sm"
                                           onClick={() => updateLeadStatus(lead.id, { connectionDone: true, reachedMode: mode as any })}
                                           className="h-8 px-2.5 bg-card border border-border text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary rounded transition-all active:scale-95 shadow-sm"
                                         >
                                           {mode === 'Email' && <Mail className="w-3.5 h-3.5" />}
                                           {mode === 'LinkedIn' && <Globe className="w-3.5 h-3.5" />}
                                           {mode === 'Phone' && <PhoneCall className="w-3.5 h-3.5" />}
                                         </Button>
                                       ))}
                                    </div>
                                  ) : (
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      className="h-8 px-3 text-muted-foreground hover:text-foreground font-bold text-[9px] uppercase tracking-widest gap-2"
                                      onClick={() => updateLeadStatus(lead.id, { connectionDone: false })}
                                    >
                                      Reset Status
                                    </Button>
                                  )}
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => deleteListing(lead.id)}
                                    className="w-8 h-8 p-0 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded transition-all"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                               </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {!selectedScanId ? (
                <>
                  <header className="flex justify-between items-end pb-4 border-b border-border">
                    <div>
                      <p className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] mb-2">Audit Trails</p>
                      <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-foreground">Discovery Vault</h1>
                      <p className="text-muted-foreground font-medium text-[10px] lg:text-xs mt-1">Archived sequence logs of historical business scans.</p>
                    </div>
                  </header>

                  <Card className="bg-card rounded-md border border-border shadow-sm overflow-x-auto">
                    <Table className="min-w-[700px] lg:min-w-full">
                      <TableHeader>
                        <TableRow className="bg-secondary/30 hover:bg-secondary/30 border-b border-border">
                          <TableHead className="text-muted-foreground font-bold text-[9px] uppercase tracking-widest pl-6 h-11">Temporal Marker</TableHead>
                          <TableHead className="text-muted-foreground font-bold text-[9px] uppercase tracking-widest h-11">Target Vector</TableHead>
                          <TableHead className="text-muted-foreground font-bold text-[9px] uppercase tracking-widest h-11 text-center">Dataset Density</TableHead>
                          <TableHead className="text-muted-foreground font-bold text-[9px] uppercase tracking-widest text-right pr-6 h-11">Resolution</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scans.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="h-64 text-center">
                               <div className="space-y-4">
                                  <History className="w-10 h-10 text-muted-foreground/20 mx-auto" />
                                  <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">No historical data found</p>
                               </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          scans.map((scan) => (
                            <TableRow 
                              key={scan.id} 
                              className="group hover:bg-secondary/20 cursor-pointer border-b border-border transition-all"
                              onClick={() => setSelectedScanId(scan.id)}
                            >
                              <TableCell className="pl-6 py-4">
                                <div className="flex flex-col">
                                   <span className="text-[11px] font-bold text-foreground">
                                     {new Date(scan.timestamp?.seconds * 1000).toLocaleDateString()}
                                   </span>
                                   <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-tighter">
                                     {new Date(scan.timestamp?.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                   </span>
                                </div>
                              </TableCell>
                              <TableCell className="py-4">
                                <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 rounded bg-foreground flex items-center justify-center text-[10px] font-black text-background">
                                     {scan.keyword.charAt(0).toUpperCase()}
                                   </div>
                                   <div>
                                      <p className="text-[13px] font-bold text-foreground leading-tight">{scan.keyword}</p>
                                      <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                                        <MapPin className="w-3 h-3 opacity-50" /> {scan.location}
                                      </p>
                                   </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center py-4">
                                 <Badge variant="secondary" className="border-none font-bold text-[9px] rounded px-2 py-0.5">
                                   {scan.count} Objects
                                 </Badge>
                              </TableCell>
                              <TableCell className="text-right pr-6 py-4">
                                 <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 h-8 px-4 font-bold text-[9px] uppercase tracking-widest transition-all text-muted-foreground hover:text-foreground">
                                   Inspect <ChevronRight className="ml-2 w-3 h-3" />
                                 </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </Card>
                </>
              ) : (
                <div className="space-y-6">
                   <Button 
                     variant="ghost" 
                     onClick={() => setSelectedScanId(null)}
                     className="px-0 hover:bg-transparent text-muted-foreground hover:text-foreground font-bold text-[10px] uppercase tracking-widest gap-2"
                   >
                     <ChevronRight className="w-4 h-4 rotate-180" /> Back to vault
                   </Button>
                   
                   <div className="bg-card border border-border rounded-md p-6 lg:p-8 shadow-sm">
                      <div className="flex justify-between items-start border-b border-border pb-6 lg:pb-8">
                         <div>
                            <p className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] mb-2">Detailed Sequence Report</p>
                            <h2 className="text-2xl lg:text-3xl font-bold tracking-tighter text-foreground uppercase">
                               {scans.find(s => s.id === selectedScanId)?.keyword}
                            </h2>
                            <p className="text-muted-foreground font-medium text-[10px] lg:text-xs mt-1 flex items-center gap-2">
                               <MapPin className="w-3.5 h-3.5 opacity-50" /> {scans.find(s => s.id === selectedScanId)?.location}
                            </p>
                         </div>
                         <div className="flex flex-col items-end gap-3">
                             <Badge className="bg-emerald-500/10 text-emerald-500 border-none font-bold uppercase text-[8px] px-3 rounded-sm">Completed</Badge>
                             <Button 
                               size="sm" 
                               variant="outline" 
                               className="h-8 px-4 font-bold text-[9px] uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary"
                               onClick={() => {
                                 const scan = scans.find(s => s.id === selectedScanId);
                                 if (scan && scan.results) downloadCSV(scan.results, `scan_history_${scan.id}`);
                               }}
                             >
                               Download Sheet
                             </Button>
                         </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6 lg:py-8">
                         {[
                           { label: 'Discovery Count', value: scans.find(s => s.id === selectedScanId)?.count, icon: Zap },
                           { label: 'Audit Strategy', value: 'High Density', icon: ShieldCheck },
                           { label: 'Sync Status', value: 'Verified', icon: Activity }
                         ].map((item, i) => (
                           <div key={i} className="space-y-1.5">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                <item.icon className="w-3 h-3 opacity-50" /> {item.label}
                              </p>
                              <p className="text-xl font-bold text-foreground">{item.value}</p>
                           </div>
                         ))}
                      </div>

                      <div className="pt-4 space-y-8">
                         <div>
                            <h4 className="text-[10px] font-bold text-foreground uppercase tracking-widest mb-4">Historical Dataset</h4>
                            <div className="border border-border rounded-md overflow-x-auto">
                               <Table>
                                 <TableHeader>
                                    <TableRow className="bg-secondary/30">
                                       <TableHead className="text-[9px] font-bold uppercase text-muted-foreground px-4 h-10">Name</TableHead>
                                       <TableHead className="text-[9px] font-bold uppercase text-muted-foreground px-4 h-10">Category</TableHead>
                                       <TableHead className="text-[9px] font-bold uppercase text-muted-foreground text-center px-4 h-10">Score</TableHead>
                                       <TableHead className="text-[9px] font-bold uppercase text-muted-foreground text-right pr-6 h-10">Web Presence</TableHead>
                                    </TableRow>
                                 </TableHeader>
                                 <TableBody>
                                    {scans.find(s => s.id === selectedScanId)?.results?.map((res, i) => (
                                      <TableRow key={i} className="hover:bg-secondary/20 transition-all border-b border-border/50">
                                        <TableCell className="font-bold text-foreground text-xs px-4 py-3">{res.name}</TableCell>
                                        <TableCell className="text-[10px] text-muted-foreground uppercase tracking-tighter px-4 py-3">{res.category}</TableCell>
                                        <TableCell className="text-center font-mono font-bold text-primary px-4 py-3">{res.leadScore}</TableCell>
                                        <TableCell className="text-right pr-6 py-3">
                                           <div className="flex gap-1 justify-end">
                                              {res.hasWebsite ? (
                                                <Badge className="bg-emerald-500/10 text-emerald-500 border-none text-[8px] uppercase px-1.5 py-0 rounded-sm">Live</Badge>
                                              ) : (
                                                <Badge className="bg-destructive/10 text-destructive border-none text-[8px] uppercase px-1.5 py-0 rounded-sm">Dark</Badge>
                                              )}
                                           </div>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                 </TableBody>
                               </Table>
                            </div>
                         </div>

                         <div className="space-y-3">
                            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sequence Metadata</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                               This discovery sequence was initiated on {new Date(scans.find(s => s.id === selectedScanId)?.timestamp?.seconds * 1000).toLocaleString()}. 
                               The engine targeted the "{scans.find(s => s.id === selectedScanId)?.keyword}" sector within a {scans.find(s => s.id === selectedScanId)?.radius || 5}km radius.
                            </p>
                            <div className="p-4 bg-secondary/50 rounded-md border border-border border-dashed">
                               <p className="text-[10px] font-mono text-muted-foreground leading-relaxed uppercase">
                                 [Sequence ID: {selectedScanId}]<br/>
                                 [Resolution: Success]<br/>
                                 [Radius Limit: {scans.find(s => s.id === selectedScanId)?.radius || 5}km]<br/>
                                 [Coordinates: {scans.find(s => s.id === selectedScanId)?.location}]
                               </p>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'admin' && profile?.role === 'admin' && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-12"
            >
              <header className="pb-4 border-b border-border">
                <p className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] mb-2 leading-none">System Architecture</p>
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground uppercase">Admin Control</h1>
                <p className="text-muted-foreground font-medium text-xs mt-1">Global database and system management</p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                {[
                  { label: 'Pipeline Leads', value: listings.length, color: 'primary', icon: LayoutDashboard },
                  { label: 'Discovery Scans', value: scans.length, color: 'primary', icon: History },
                  { label: 'Critical Tasks', value: listings.filter(l => !l.hasWebsite).length, color: 'destructive', icon: ExternalLink },
                ].map((item, idx) => (
                  <Card key={idx} className="border-border shadow-sm p-6 flex flex-col items-start gap-4 bg-card rounded-md">
                    <div className={`w-10 h-10 rounded bg-secondary flex items-center justify-center`}>
                      <item.icon className={`w-5 h-5 text-muted-foreground`} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black tracking-tight text-foreground">{item.value}</h3>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">{item.label}</p>
                    </div>
                  </Card>
                ))}
              </div>
              
              <Card className="border-border shadow-sm overflow-hidden bg-card rounded-md">
                 <div className="p-10 lg:p-14 flex flex-col items-center justify-center text-center space-y-4 max-w-xl mx-auto">
                    <div className="w-12 h-12 bg-foreground rounded flex items-center justify-center shadow-md">
                      <Settings className="w-6 h-6 text-background" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-bold text-xl text-foreground">System Integrity</h3>
                      <p className="text-xs lg:text-sm text-muted-foreground font-medium leading-relaxed">
                        Data is synchronized with Google Maps API and audited via Gemini 1.5 Flash.
                      </p>
                    </div>
                    <div className="pt-2 flex gap-3">
                       <Button size="sm" className="bg-primary text-primary-foreground px-6 h-10 rounded-md font-bold shadow-sm">Synchronize</Button>
                       <Button size="sm" variant="outline" className="px-6 h-10 border-border font-bold rounded-md bg-secondary/50 text-muted-foreground hover:text-foreground">Logs</Button>
                    </div>
                 </div>
              </Card>
            </motion.div>
          )}

          {activeTab === 'lead-detail' && selectedLeadForOutreach && (
            <motion.div 
              key="lead-detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col bg-background min-h-screen"
            >
              <div className="flex flex-col">
                <div className="relative h-64 lg:h-72 bg-primary/5 border-b border-border p-8 lg:p-12 flex items-end">
                  <div className="absolute top-6 left-6 z-30">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={closeLeadDetail}
                      className="h-9 px-4 rounded border-border bg-card/80 backdrop-blur-md font-bold text-[10px] uppercase tracking-widest transition-all hover:bg-secondary hover:text-foreground shadow-2xl"
                    >
                      <ChevronRight className="w-4 h-4 mr-2 rotate-180" /> Return to Command
                    </Button>
                  </div>

                   <div className="absolute inset-0 overflow-hidden">
                      <div className="absolute inset-0 bg-[radial-gradient(var(--primary)_0.5px,transparent_0.5px)] [background-size:16px_16px] opacity-10" />
                      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-card to-transparent" />
                   </div>
                   <div className="relative z-10 flex items-center gap-6 w-full">
                      <div className="w-20 h-20 lg:w-28 lg:h-28 bg-foreground text-background rounded-md flex items-center justify-center text-3xl lg:text-5xl font-black shadow-2xl">
                        {selectedLeadForOutreach.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 lg:mb-3">
                           <h2 className="text-3xl lg:text-5xl font-black tracking-tighter text-foreground leading-none">{selectedLeadForOutreach.name}</h2>
                           <Badge variant="outline" className="bg-primary/10 text-primary border-none font-bold uppercase text-[9px] lg:text-[10px] px-2 py-0.5 lg:px-3 lg:py-1">{selectedLeadForOutreach.status}</Badge>
                        </div>
                        <p className="text-muted-foreground font-medium text-sm lg:text-base flex items-center gap-2">
                           <MapPin className="w-4 h-4 lg:w-5 lg:h-5 text-primary" /> {selectedLeadForOutreach.address}
                        </p>
                      </div>
                      <div className="text-right hidden sm:block">
                         <div className="text-4xl lg:text-6xl font-black text-primary tracking-tighter leading-none">{selectedLeadForOutreach.leadScore}</div>
                         <div className="text-[10px] lg:text-[11px] font-black text-muted-foreground uppercase tracking-[0.25em] mt-2">Acquisition Velocity</div>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
                   <div className="lg:col-span-2 p-8 lg:p-12 lg:space-y-16 space-y-10 border-r border-border">
                      <section className="space-y-6">
                         <div className="flex items-center justify-between">
                            <h3 className="text-[10px] lg:text-[11px] font-black text-foreground uppercase tracking-[0.25em]">Deployment Intelligence</h3>
                            <div className="flex items-center gap-2 text-muted-foreground font-bold text-[10px] lg:text-[11px] uppercase tracking-widest">
                               <Globe className="w-4 h-4" /> Site Integrity
                            </div>
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-6 bg-secondary/30 rounded border border-border/50 group hover:shadow-lg transition-all">
                               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">SEO Ecosystem</p>
                               <div className="flex items-center justify-between">
                                  <div className="text-3xl font-black text-foreground">{selectedLeadForOutreach.technicalAudit.seoScore}/10</div>
                                  <div className={`w-2.5 h-2.5 rounded-full ${selectedLeadForOutreach.technicalAudit.seoScore > 7 ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
                               </div>
                               <div className="mt-4 w-full h-2 bg-border rounded-full overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${selectedLeadForOutreach.technicalAudit.seoScore * 10}%` }}
                                    transition={{ duration: 1, delay: 0.5 }}
                                    className={`h-full ${selectedLeadForOutreach.technicalAudit.seoScore > 7 ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                                  />
                               </div>
                            </div>
                            <div className="p-6 bg-secondary/30 rounded border border-border/50 hover:shadow-lg transition-all">
                               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">UX Latency</p>
                               <div className="text-3xl font-black text-foreground uppercase">{selectedLeadForOutreach.technicalAudit.loadSpeed}</div>
                               <p className="text-[11px] font-medium text-muted-foreground mt-3 italic">Infrastructure needs immediate optimization</p>
                            </div>
                         </div>
                      </section>

                      <section className="space-y-8">
                         <div className="flex items-center justify-between">
                            <h3 className="text-[10px] lg:text-[11px] font-black text-foreground uppercase tracking-[0.25em]">Strategic Benchmarking</h3>
                            <div className="flex gap-6">
                               <div className="flex flex-col items-end">
                                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1.5">Market Avg</span>
                                  <span className="text-sm font-bold text-foreground">
                                    {(listings.filter(l => l.category === selectedLeadForOutreach.category).reduce((acc, curr) => acc + curr.leadScore, 0) / (listings.filter(l => l.category === selectedLeadForOutreach.category).length || 1)).toFixed(1)}%
                                  </span>
                               </div>
                               <div className="flex flex-col items-end">
                                  <span className="text-[9px] font-black text-primary uppercase tracking-widest leading-none mb-1.5">Target Potential</span>
                                  <span className="text-sm font-bold text-primary">{selectedLeadForOutreach.leadScore}%</span>
                               </div>
                            </div>
                         </div>
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                               <div className="flex justify-between text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                  <span>SEO vs Category Average</span>
                                  <span>{selectedLeadForOutreach.technicalAudit.seoScore} / 10</span>
                                </div>
                               <div className="h-3 bg-secondary rounded-full overflow-hidden flex gap-1 p-0.5">
                                  <div className="h-full bg-primary/20 rounded-full" style={{ width: `${(listings.filter(l => l.category === selectedLeadForOutreach.category).reduce((acc, curr) => acc + curr.technicalAudit.seoScore, 0) / (listings.filter(l => l.category === selectedLeadForOutreach.category).length || 1)) * 10}%` }} />
                                  <div className="h-full bg-primary rounded-full shadow-[0_0_8px_rgba(59,130,246,0.3)]" style={{ width: `${selectedLeadForOutreach.technicalAudit.seoScore * 10}%` }} />
                               </div>
                            </div>
                            <div className="flex flex-col justify-center p-6 bg-primary/5 rounded border border-primary/10 relative overflow-hidden group">
                               <Zap className="absolute -right-4 -bottom-4 w-16 h-16 text-primary/5 group-hover:scale-110 transition-transform" />
                               <p className="text-[11px] font-bold text-foreground mb-1.5 relative z-10">Opportunity Insight</p>
                               <p className="text-xs text-muted-foreground leading-relaxed relative z-10">
                                 {selectedLeadForOutreach.leadScore > (listings.filter(l => l.category === selectedLeadForOutreach.category).reduce((acc, curr) => acc + curr.leadScore, 0) / (listings.filter(l => l.category === selectedLeadForOutreach.category).length || 1)) 
                                   ? "This target shows higher-than-average digital deficit, making it a priority acquisition target."
                                   : "Target is performing within market norms. High-touch personalized strategy recommended."}
                               </p>
                            </div>
                         </div>
                         
                         {/* Live Site Preview */}
                         <div className="relative rounded border border-border h-80 lg:h-[400px] bg-secondary group shadow-xl overflow-hidden">
                            {selectedLeadForOutreach.website ? (
                               <>
                                 <img 
                                   src={`https://s0.wp.com/mshots/v1/${encodeURIComponent(selectedLeadForOutreach.website)}?w=1280&h=960`} 
                                   alt="Site Preview" 
                                   referrerPolicy="no-referrer"
                                   className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                                 />
                                 <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-8">
                                    <div className="space-y-4">
                                       <h4 className="text-white text-xl font-bold tracking-tight">Active Surveillance Feedback</h4>
                                       <a 
                                         href={selectedLeadForOutreach.website} 
                                         target="_blank" 
                                         rel="noreferrer" 
                                         className="inline-flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded font-bold text-[10px] uppercase tracking-widest hover:scale-105 transition-all active:scale-95"
                                       >
                                          Visit Terminal <ExternalLink className="w-4 h-4" />
                                       </a>
                                    </div>
                                 </div>
                               </>
                            ) : (
                               <div className="w-full h-full flex flex-col items-center justify-center text-center p-12 space-y-4">
                                  <div className="w-20 h-20 bg-muted/20 rounded-full flex items-center justify-center border border-dashed border-muted-foreground/30">
                                     <Monitor className="w-10 h-10 text-muted-foreground/30" />
                                  </div>
                                  <div className="space-y-2">
                                     <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">No Digital Asset Detected</p>
                                     <p className="text-xs text-muted-foreground/60 max-w-[200px] mx-auto italic font-medium">This target may require an intensive manual infrastructure audit.</p>
                                  </div>
                               </div>
                            )}
                         </div>

                         <div className="bg-foreground text-background p-8 lg:p-10 rounded-md shadow-2xl relative overflow-hidden group">
                            <Zap className="absolute -right-6 -top-6 w-32 h-32 text-background/10 rotate-12 group-hover:scale-110 transition-transform duration-700" />
                            <h4 className="text-[11px] font-black uppercase tracking-[0.3em] mb-6 text-background/50">Acquisition Protocol</h4>
                            <p className="text-lg lg:text-xl font-bold tracking-tight italic leading-relaxed relative z-10">
                               "{selectedLeadForOutreach.outreachStrategy}"
                            </p>
                         </div>
                      </section>

                      <section className="space-y-6">
                         <div className="flex items-center justify-between">
                            <h3 className="text-[11px] font-black text-foreground uppercase tracking-[0.25em]">AI Synthesis Engine</h3>
                            <Button 
                              size="lg" 
                              onClick={() => generateOutreach(selectedLeadForOutreach)}
                              disabled={generatingOutreach}
                              className="h-10 lg:h-12 rounded bg-primary text-primary-foreground font-black text-[10px] lg:text-[11px] uppercase tracking-widest px-8 shadow-2xl shadow-primary/30 active:scale-95 transition-all hover:scale-[1.02]"
                            >
                               {generatingOutreach ? (
                                 <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Neural Processing...</>
                               ) : (
                                 <><Zap className="w-4 h-4 mr-2" /> Generate Sequence</>
                               )}
                            </Button>
                         </div>

                         <AnimatePresence mode="wait">
                            {selectedLeadForOutreach.outreachDrafts ? (
                               <motion.div 
                                 initial={{ opacity: 0, scale: 0.98 }}
                                 animate={{ opacity: 1, scale: 1 }}
                                 className="grid grid-cols-1 md:grid-cols-2 gap-8"
                               >
                                  <div className="space-y-4">
                                     <div className="flex items-center justify-between px-1">
                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Primary Electronic Mail</p>
                                        <Button 
                                          variant="outline" 
                                          size="sm" 
                                          className="h-8 border-border bg-card font-bold text-[9px] uppercase tracking-widest px-3 hover:bg-secondary"
                                          onClick={() => {
                                            navigator.clipboard.writeText(selectedLeadForOutreach.outreachDrafts?.email || '');
                                            toast.success("Draft secure - copied to clipboard.");
                                          }}
                                        >
                                           <ColumnsIcon className="w-3.5 h-3.5 mr-2" /> Copy
                                        </Button>
                                     </div>
                                     <div className="p-6 bg-secondary/50 border border-border rounded-md text-sm font-medium leading-relaxed max-h-64 overflow-y-auto custom-scrollbar-themed">
                                        <div className="whitespace-pre-wrap">{selectedLeadForOutreach.outreachDrafts.email}</div>
                                     </div>
                                  </div>
                                  <div className="space-y-4">
                                     <div className="flex items-center justify-between px-1">
                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">LinkedIn Direct Proxy</p>
                                        <Button 
                                          variant="outline" 
                                          size="sm" 
                                          className="h-8 border-border bg-card font-bold text-[9px] uppercase tracking-widest px-3 hover:bg-secondary"
                                          onClick={() => {
                                            navigator.clipboard.writeText(selectedLeadForOutreach.outreachDrafts?.linkedin || '');
                                            toast.success("Draft secure - copied to clipboard.");
                                          }}
                                        >
                                           <ColumnsIcon className="w-3.5 h-3.5 mr-2" /> Copy
                                        </Button>
                                     </div>
                                     <div className="p-6 bg-secondary/50 border border-border rounded-md text-sm font-medium leading-relaxed max-h-64 overflow-y-auto custom-scrollbar-themed">
                                        <div className="whitespace-pre-wrap">{selectedLeadForOutreach.outreachDrafts.linkedin}</div>
                                     </div>
                                  </div>
                               </motion.div>
                            ) : (
                               <div className="h-48 lg:h-64 bg-secondary/20 border border-border border-dashed rounded-md flex flex-col items-center justify-center text-center p-12 space-y-4 group">
                                  <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center animate-pulse group-hover:scale-110 transition-all">
                                     <Loader2 className="w-8 h-8 text-muted-foreground/30" />
                                  </div>
                                  <div className="space-y-2">
                                     <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">Sequence Analysis Pending Extraction</p>
                                     <p className="text-xs text-muted-foreground/50 max-w-[250px] mx-auto italic font-medium leading-relaxed">Intelligence synthesis requires manual triggers below to generate personalized outreach logic.</p>
                                  </div>
                               </div>
                            )}
                         </AnimatePresence>
                      </section>
                   </div>

                   <div className="p-8 lg:p-12 bg-secondary/20 space-y-12">
                       <section className="space-y-6">
                          <h4 className="text-[11px] font-black text-foreground uppercase tracking-[0.3em] pb-3 border-b border-border/30">Target Metadata</h4>
                          <div className="space-y-6">
                             {[
                               { label: 'Category', value: selectedLeadForOutreach.category, icon: Star },
                               { label: 'Market Vertical', value: selectedLeadForOutreach.category, icon: Zap },
                               { label: 'Phone Channel', value: selectedLeadForOutreach.phone || 'N/A', icon: PhoneCall },
                               { label: 'Digital Mail', value: selectedLeadForOutreach.email || 'N/A', icon: Mail }
                             ].map((item, i) => (
                               <div key={i} className="space-y-2">
                                  <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                                     <item.icon className="w-3.5 h-3.5 opacity-40 text-primary" /> {item.label}
                                  </div>
                                  <p className="text-sm font-bold text-foreground leading-tight">{item.value}</p>
                               </div>
                             ))}
                          </div>
                       </section>

                       <section className="space-y-6">
                          <h4 className="text-[11px] font-black text-foreground uppercase tracking-[0.3em] pb-3 border-b border-border/30">Social Topology</h4>
                          <div className="flex flex-wrap gap-3">
                             {selectedLeadForOutreach.socialLinks && selectedLeadForOutreach.socialLinks.length > 0 ? (
                               selectedLeadForOutreach.socialLinks.map((link, i) => (
                                 <a 
                                   key={i} 
                                   href={link} 
                                   target="_blank" 
                                   rel="noreferrer"
                                   className="w-10 h-10 lg:w-12 lg:h-12 rounded bg-card border border-border flex items-center justify-center hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all shadow-xl hover:scale-110 active:scale-95"
                                 >
                                    <ExternalLink className="w-4 h-4 lg:w-5 lg:h-5" />
                                 </a>
                               ))
                             ) : (
                               <p className="text-[10px] font-bold text-muted-foreground italic tracking-wide">No social footprints detected via digital scan.</p>
                             )}
                          </div>
                       </section>

                       <div className="pt-12 border-t border-border/50">
                          <Button 
                            variant="destructive" 
                            size="lg" 
                            className="w-full h-12 lg:h-14 font-black text-[11px] lg:text-[12px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 rounded shadow-2xl shadow-destructive/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            onClick={() => {
                              deleteListing(selectedLeadForOutreach.id);
                              closeLeadDetail();
                            }}
                          >
                             <Trash2 className="w-4 h-4 lg:w-5 lg:h-5" /> Decommission Lead
                          </Button>
                       </div>
                   </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Intelligence Guide */}
        <section className="mt-20 border-t border-border pt-12 pb-24 px-6 lg:px-12 bg-secondary/5 relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
           <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-3 mb-8">
                 <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                 </div>
                 <h2 className="text-sm font-black text-foreground uppercase tracking-[0.3em]">Operational Intelligence Protocol</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                 <div className="space-y-4">
                    <h3 className="text-[11px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                       <Search className="w-3 h-3" /> Acquisition
                    </h3>
                    <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                       Deploy sensors via the <b>Satellite Scanner</b> to identify local businesses. Our Gemini-powered engine audits their digital infrastructure in real-time.
                    </p>
                 </div>
                 <div className="space-y-4">
                    <h3 className="text-[11px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                       <Zap className="w-3 h-3" /> Evaluation
                    </h3>
                    <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                       Review <b>Propensity Scores</b>. A score above 7 indicates a high probability of technical debt and immediate need for infrastructure upgrades.
                    </p>
                 </div>
                 <div className="space-y-4">
                    <h3 className="text-[11px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                       <MessageSquare className="w-3 h-3" /> Execution
                    </h3>
                    <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                       Save leads to your <b>CRM</b> to unlock personalized outreach sequences. Use the <b>Lead detail</b> view to generate AI-tailored communication.
                    </p>
                 </div>
              </div>

              <div className="mt-12 p-4 rounded bg-primary/5 border border-primary/10 flex flex-col md:flex-row items-center justify-between gap-4">
                 <p className="text-[10px] text-primary font-bold uppercase tracking-widest italic">Always verify digital signatures before initiating outreach protocols.</p>
                 <Badge variant="outline" className="bg-primary text-primary-foreground border-none px-3 py-1 text-[9px] font-black uppercase tracking-widest">v1.2 Active</Badge>
              </div>
           </section>
      </main>
    </div>
  );
}
