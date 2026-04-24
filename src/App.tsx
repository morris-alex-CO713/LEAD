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
  onSnapshot,
  collection,
  query,
  orderBy,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { 
  testFirestoreConnection 
} from './lib/firestore-errors';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { 
  Plus, 
  History,
  LayoutDashboard,
  Map as MapIcon,
  Search,
  Zap,
  Star,
  ArrowUpRight,
  Globe,
  Calendar,
  Mail,
  PhoneCall,
  MessageSquare,
  ListFilter,
  Sun,
  Moon,
  Columns as ColumnsIcon,
  TableProperties,
  Briefcase,
  Clock,
  Wrench,
  AlertTriangle,
  User as UserIcon,
  CheckCircle,
  Trash2,
  Trophy,
  MapPin,
  ChevronRight,
  Settings,
  ExternalLink,
  Monitor,
  Activity,
  ShieldCheck,
  Loader2,
  LogOut,
  Target,
  Copy,
  Cpu,
  Database,
  LayoutGrid,
  Share2
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
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import StatsGrid from './components/StatsGrid';
import LeadCard from './components/LeadCard';
import { FirebaseService } from './services/firebaseService';
import { 
  BusinessListing, 
  PortfolioClient, 
  ScanHistory,
  UserProfile
} from './types';

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
  const [portfolio, setPortfolio] = useState<PortfolioClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchLocation, setSearchLocation] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchRadius, setSearchRadius] = useState(5); // Default 5km
  const [searchMaxResults, setSearchMaxResults] = useState(10); // Default 10 results
  const [activeTab, setActiveTab] = useState('dashboard');
  const [previousTab, setPreviousTab] = useState('dashboard');
  const [searchFilter, setSearchFilter] = useState('');
  const [isClientView, setIsClientView] = useState(false);
  const [sharedLead, setSharedLead] = useState<BusinessListing | null>(null);

  // Check for shared lead on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get('share') || params.get('client');
    if (sharedId) {
      setIsClientView(true);
      // We'll fetch the lead if it's not in our listings (though we might not have it yet)
    }
  }, []);

  // Fetch shared lead if in client view
  useEffect(() => {
    if (isClientView) {
      const params = new URLSearchParams(window.location.search);
      const sharedId = params.get('share') || params.get('client');
      if (sharedId) {
        // Try to find in current listings first
        const found = listings.find(l => l.id === sharedId);
        if (found) {
          setSharedLead(found);
        } else {
          // If not found, it might be loading or we need to fetch it explicitly if rules allow
          // For now, if we have the list, and it's not there, we display a message
          if (listings.length > 0) {
            // Not found in full list
          }
        }
      }
    }
  }, [isClientView, listings]);
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
  const [outreachTone, setOutreachTone] = useState<'professional' | 'aggressive' | 'helpful' | 'curious'>('professional');
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
      const tonePrompts = {
        professional: "Tone: Executive, strategic, and authoritative.",
        aggressive: "Tone: Urgent, direct, and highlighting the risk of lost revenue to competitors.",
        helpful: "Tone: Empathetic, supportive, and positioning yourself as a local partner.",
        curious: "Tone: Low-pressure, inquisitive, and asking if they are even aware of the technical gaps."
      };

      const prompt = `Synthesize a high-conversion, personalized outreach sequence for "${lead.name}".
      Target Industry: ${lead.category}
      Location: ${lead.address}
      
      Vulnerability Analysis:
      - SEO Infrastructure Score: ${lead.technicalAudit.seoScore}/10
      - Performance Latency: ${lead.technicalAudit.loadSpeed || 'Unknown'}
      - Domain Discovery Strategy: ${lead.outreachStrategy}
      
      Requirements:
      1. One concise, value-first Email centered on fixing their specific technical gaps.
      2. One high-engagement LinkedIn connection request note.
      3. ${tonePrompts[outreachTone]} Avoid generic fluff.`;

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
    const lead = listings.find(l => l.id === draggableId);
    
    if (newStatus === lead?.status) return;

    setListings(prev => prev.map(l => l.id === draggableId ? { ...l, status: newStatus } : l));
    
    try {
      await updateDoc(doc(db, 'business_listings', draggableId), {
        status: newStatus
      });

      // Automatically trigger promotion flow if moved to closed
      if (newStatus === 'closed' && lead) {
         setSelectedLeadForOutreach(lead);
         setIsPromotionDialogOpen(true);
         toast.info(`Acquisition protocol initiated for ${lead.name}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status.");
    }
  };

  // Scan History Detail
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);

  // Manual Add Dialog
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  const [isPromotionDialogOpen, setIsPromotionDialogOpen] = useState(false);
  const [promotionDetails, setPromotionDetails] = useState({
    workDone: '',
    detailedDescription: '',
    expiryMonths: 12,
    nextServiceMonths: 6,
  });
  const [extractionStep, setExtractionStep] = useState(0);
  const [searchResultsPage, setSearchResultsPage] = useState(1);
  const [crmPage, setCrmPage] = useState(1);
  const [portfolioPage, setPortfolioPage] = useState(1);
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
    // Scroll to top on tab change
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo(0, 0);
    }
  }, [activeTab]);

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
      setPortfolio([]);
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

    // Portfolio Subscription
    const portfolioPath = 'portfolio_vault';
    const qPortfolio = query(collection(db, portfolioPath), orderBy('createdAt', 'desc'));
    const unsubscribePortfolio = onSnapshot(qPortfolio, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PortfolioClient));
      setPortfolio(data);
    });

    return () => {
      unsubscribeListings();
      unsubscribeScans();
      unsubscribePortfolio();
    };
  }, [user]);

  const promoteLeadToClient = async () => {
    if (!selectedLeadForOutreach || !user) return;
    
    try {
      const now = new Date();
      
      const expiryDate = new Date(now);
      expiryDate.setMonth(expiryDate.getMonth() + promotionDetails.expiryMonths);
      
      const nextServiceDate = new Date(now);
      nextServiceDate.setMonth(nextServiceDate.getMonth() + promotionDetails.nextServiceMonths);

      const clientData = {
        uid: auth.currentUser?.uid || 'akash-prospect-admin',
        businessId: selectedLeadForOutreach.id,
        name: selectedLeadForOutreach.name,
        websiteUrl: selectedLeadForOutreach.website || '',
        workDone: promotionDetails.workDone,
        detailedDescription: promotionDetails.detailedDescription,
        expiryDate: expiryDate.toISOString(),
        nextServiceDate: nextServiceDate.toISOString(),
        status: 'active',
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'portfolio_vault'), clientData);
      await updateDoc(doc(db, 'business_listings', selectedLeadForOutreach.id), { status: 'closed' });
      
      setIsPromotionDialogOpen(false);
      setPromotionDetails({ workDone: '', detailedDescription: '', expiryMonths: 12, nextServiceMonths: 6 });
      toast.success(`${selectedLeadForOutreach.name} promoted to Portfolio Vault!`);
      closeLeadDetail();
    } catch (err) {
      console.error(err);
      toast.error("Failed to promote lead.");
    }
  };

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

  const isServiceNear = (date: any) => {
    if (!date) return false;
    const d = new Date(date);
    const diff = d.getTime() - new Date().getTime();
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
  };

  const handleLogout = () => {
    setUser(null);
    setProfile(null);
    localStorage.removeItem('prospect_user');
    toast.success("Logged out successfully.");
  };

  const handleRandomSearch = () => {
    const randomNiche = SUGGESTED_NICHES[Math.floor(Math.random() * SUGGESTED_NICHES.length)];
    const cities = ["Austin, TX", "Denver, CO", "Phoenix, AZ", "Miami, FL", "Seattle, WA", "Nashville, TN", "Las Vegas, NV"];
    const randomCity = cities[Math.floor(Math.random() * cities.length)];
    setSearchKeyword(randomNiche);
    setSearchLocation(randomCity);
    toast.info(`Targeting ${randomNiche} in ${randomCity}...`);
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

        // Log to scan history with ALL results and enhanced metadata
        await FirebaseService.addScanHistory({
          location: searchLocation,
          keyword: searchKeyword,
          count: results.length,
          uid: auth.currentUser?.uid || 'akash-prospect-admin',
          results: results,
          radius: searchRadius,
          city: searchLocation.split(',')[0].trim(),
          timestamp: serverTimestamp()
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

  const saveListing = async (biz: BusinessResult, silent: boolean = false) => {
    if (!user) {
      if (!silent) toast.error("Authentication required for persistence.");
      return;
    }
    try {
      await FirebaseService.saveListing(biz);
      if (!silent) toast.success(`${biz.name} secured.`);
    } catch (err) {
      if (!silent) toast.error(`Failed to save ${biz.name}`);
    }
  };

  const syncAllToCRM = async (results: BusinessResult[]) => {
    if (!user) return toast.error("Authenticate to sync data.");
    setIsSyncing(true);
    try {
      const unsaved = results.filter(r => !listings.some(l => l.name === r.name && l.address === r.address));
      if (unsaved.length === 0) {
        toast.info("All leads are already in your database.");
        return;
      }
      
      // Sequential saving to CRM to avoid potential concurrency issues with the same UI state
      let successCount = 0;
      for (const res of unsaved) {
        try {
          await FirebaseService.saveListing(res);
          successCount++;
        } catch (e) {
          console.error(`Failed to save ${res.name}`, e);
        }
      }
      
      if (successCount > 0) {
        toast.success(`${successCount} lead${successCount > 1 ? 's' : ''} synchronized with CRM.`);
      } else {
        toast.error("Failed to synchronize lead data.");
      }
    } catch (err) {
      toast.error("Partial synchronization failure.");
    } finally {
      setIsSyncing(false);
    }
  };

  const addManualLead = async () => {
    if (!manualLead.name) return toast.error("Business name is required");
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
      connectionDone: false
    };
    await FirebaseService.saveListing(bizData);
    setIsManualAddOpen(false);
    setManualLead({ name: '', address: '', category: '', website: '', phone: '', email: '' });
    toast.success("Manual lead added!");
  };

  const updateStatus = async (id: string, status: BusinessListing['status']) => {
    await FirebaseService.updateStatus(id, status);
    toast.success(`Status updated to ${status}`);
  };

  const deleteListing = async (id: string) => {
    await FirebaseService.deleteListing(id);
    toast.success("Lead removed.");
  };

  const updateLeadStatus = async (id: string, updates: Partial<BusinessListing>) => {
    await FirebaseService.updateLead(id, updates);
    toast.success("Lead updated successfully.");
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

  const filteredCrmList = listings.filter(l => {
    const matchesCrmSearch = l.name.toLowerCase().includes(crmSearch.toLowerCase()) || 
                           l.category.toLowerCase().includes(crmSearch.toLowerCase()) ||
                           l.address.toLowerCase().includes(crmSearch.toLowerCase());
    const matchesStatus = crmStatusTab === 'all' ? true : l.connectionDone;
    const matchesCategory = crmCategoryFilter ? l.category === crmCategoryFilter : true;
    return matchesCrmSearch && matchesStatus && matchesCategory;
  });

  const paginatedCrmList = filteredCrmList.slice((crmPage - 1) * itemsPerPage, crmPage * itemsPerPage);
  const paginatedPortfolioList = portfolio.slice((portfolioPage - 1) * itemsPerPage, portfolioPage * itemsPerPage);
  const paginatedSearchResults = searchResults.slice((searchResultsPage - 1) * itemsPerPage, searchResultsPage * itemsPerPage);

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

  if (isClientView) {
    if (!sharedLead && listings.length === 0) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="space-y-4 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Synchronizing Shared Audit...</p>
          </div>
        </div>
      );
    }

    if (!sharedLead) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <Card className="max-w-md w-full border-border bg-card">
            <CardHeader className="text-center">
              <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <CardTitle className="text-xl font-bold uppercase">Audit Not Found</CardTitle>
              <CardDescription>The shared link may have expired or is invalid.</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button className="w-full" onClick={() => window.location.href = '/'}>Return Home</Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
        <Toaster position="top-right" expand={true} richColors theme={theme} />
        <div className="max-w-5xl mx-auto p-4 sm:p-8 lg:p-12 space-y-12 pb-32">
          <header className="flex flex-col sm:flex-row items-center justify-between gap-6 border-b border-border pb-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-foreground text-background flex items-center justify-center text-2xl font-black rounded">
                {sharedLead.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tighter uppercase">{sharedLead.name}</h1>
                <p className="text-muted-foreground font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" /> {sharedLead.address}
                </p>
              </div>
            </div>
            <div className="text-center sm:text-right">
              <div className="text-5xl font-black text-primary tracking-tighter">{sharedLead.leadScore}</div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Optimization Deficit</p>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section className="space-y-6">
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Critical Vulnerabilities</h3>
              <div className="space-y-4">
                <div className="p-6 bg-secondary/20 rounded border border-border">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2">SEO Status</p>
                  <div className="flex items-center justify-between font-black text-2xl">
                    <span>{sharedLead.technicalAudit.seoScore}/10</span>
                    <Badge variant={sharedLead.technicalAudit.seoScore > 7 ? "secondary" : "destructive"} className="uppercase font-bold text-[9px]">
                      {sharedLead.technicalAudit.seoScore > 7 ? "Healthy" : "Critical"}
                    </Badge>
                  </div>
                </div>
                <div className="p-6 bg-secondary/20 rounded border border-border">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2">Mobile Performance</p>
                  <div className="flex items-center justify-between font-black text-2xl uppercase">
                    <span>{sharedLead.technicalAudit.loadSpeed}</span>
                    <Badge variant="outline" className="border-primary/20 text-primary uppercase font-bold text-[9px]">Latency Audit</Badge>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Digital Infrastructure</h3>
              <div className="p-8 bg-foreground text-background rounded shadow-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-lime-400" />
                  <h4 className="font-bold text-lg">System Assessment</h4>
                </div>
                <p className="text-sm font-medium leading-relaxed italic opacity-80">
                  "{sharedLead.auditComment}"
                </p>
              </div>
            </section>
          </div>

          <section className="space-y-8">
             <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Strategic Opportunity</h3>
             <div className="p-10 border-2 border-dashed border-border rounded-lg text-center space-y-6">
                <div className="max-w-2xl mx-auto space-y-4">
                   <h4 className="text-2xl font-black tracking-tight uppercase">Implementation Required</h4>
                   <p className="text-muted-foreground font-medium">To resolve these technical gaps and secure your local rankings, a strategic infrastructure upgrade is recommended.</p>
                </div>
             </div>
          </section>

          <footer className="fixed bottom-0 left-0 w-full p-6 bg-card border-t border-border backdrop-blur-md z-50 flex items-center justify-center">
             <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] flex items-center gap-4">
               Audit Powered by PROSPECT.IO <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Precision Acquisition Engine
             </p>
          </footer>
        </div>
      </div>
    );
  }

  if (loading) {
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

  if (!user) {
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

  return (
    <div className="h-screen bg-background text-foreground flex overflow-hidden selection:bg-primary selection:text-primary-foreground">
      <Toaster position="top-right" expand={true} richColors theme={theme} />
      
      {/* SIDEBAR - Hidden on mobile */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        theme={theme} 
        setTheme={setTheme} 
        profile={profile} 
        onLogout={handleLogout} 
      />

      {/* BOTTOM NAV - Mobile only */}
      <BottomNav 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        theme={theme} 
        setTheme={setTheme} 
      />

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
            <div className="space-y-12">
            <motion.div 
                key="dashboard"
                initial={{ opacity: 0, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.99 }}
                className="space-y-6 sm:space-y-10 focus:outline-none"
              >
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-6 border-b border-border/60">
                  <div className="flex-1 min-w-0">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tighter text-foreground mb-1 mr-4 lg:mb-2 text-left uppercase">Neural Dashboard</h1>
                    <p className="text-muted-foreground font-medium text-[11px] sm:text-sm lg:text-base text-left flex flex-wrap items-center gap-x-2">
                      Target Acquisition Mode: <span className="text-primary font-bold">{listings.filter(l => l.status === 'new').length} New Prospects</span>
                    </p>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="outline" onClick={exportToCSV} className="flex-1 sm:flex-none rounded-md border-border font-bold text-[9px] uppercase tracking-widest h-10 px-4 bg-card shadow-sm hover:bg-secondary transition-all">
                      Export Dataset
                    </Button>
                    <Button onClick={() => setActiveTab('search')} className="flex-1 sm:flex-none border-none bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 font-bold text-[9px] uppercase tracking-widest px-4 sm:px-6 h-10 rounded-md gap-2 transition-all active:scale-95">
                      <Plus className="w-3.5 h-3.5" /> Acquire
                    </Button>
                  </div>
                </header>

                <StatsGrid 
                  listingCount={listings.length}
                  conversionCount={listings.filter(l => l.status === 'qualified' || l.status === 'closed').length}
                  scanCount={scans.length}
                  portfolioCount={portfolio.length}
                />

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
                         <p className="text-muted-foreground font-black uppercase tracking-widest text-[10px]">No active data streams</p>
                      </div>
                    ) : (
                      filteredListings.slice(0, 5).map((l) => (
                        <LeadCard 
                          key={l.id} 
                          listing={l} 
                          onClick={() => openLeadDetail(l)} 
                        />
                      ))
                    )}
                  </div>
                ) : (
                  <DragDropContext onDragEnd={onDragEnd}>
                    <div className="overflow-x-auto no-scrollbar -mx-6 px-6 lg:mx-0 lg:px-0 scroll-smooth">
                      <div className="flex gap-4 min-w-[1000px] lg:min-w-0 lg:grid lg:grid-cols-4 lg:gap-6 pb-10 min-h-[600px]">
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
                                    <Draggable draggableId={biz.id} index={index} key={biz.id}>
                                      {(provided, snapshot) => (
                                        <LeadCard 
                                          listing={biz} 
                                          onClick={() => openLeadDetail(biz)}
                                          draggableProps={provided.draggableProps}
                                          dragHandleProps={provided.dragHandleProps}
                                          innerRef={provided.innerRef}
                                          isDragging={snapshot.isDragging}
                                          isKanban={true}
                                        />
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
                    </div>
                   </DragDropContext>
                )}
            </motion.div>

            {/* Operational Intelligence Protocol - Only on Dashboard */}
            <section className="mt-12 border-t border-border pt-12 pb-12 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
               <div className="max-w-4xl">
                  <div className="flex items-center gap-3 mb-8">
                     <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                     </div>
                     <h2 className="text-sm font-bold text-foreground uppercase tracking-[0.3em]">Operational Intelligence Protocol</h2>
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
               </div>
            </section>
            </div>
          )}


              {activeTab === 'search' && (
            <motion.div 
              key="search"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 lg:left-64 flex flex-col h-screen overflow-hidden z-[40]"
            >

              {/* Overlay Search Box (Floating) */}
              <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 flex flex-col sm:flex-row gap-2 w-full max-w-[90%] sm:max-w-4xl pointer-events-none">
                 <div className="flex-1 bg-card/80 backdrop-blur-xl border border-border/50 shadow-2xl rounded-lg p-4 pointer-events-auto flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                       <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                       <Input 
                         placeholder="Location..." 
                         value={searchLocation}
                         onChange={(e) => setSearchLocation(e.target.value)}
                         className="pl-9 h-10 border-none bg-secondary/50 font-bold focus-visible:ring-0"
                       />
                    </div>
                    <div className="flex-1 relative">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                       <Input 
                         placeholder="Niche (e.g. Roofers)..." 
                         value={searchKeyword}
                         onChange={(e) => setSearchKeyword(e.target.value)}
                         className="pl-9 h-10 border-none bg-secondary/50 font-bold focus-visible:ring-0"
                       />
                    </div>
                    <div className="w-24 relative">
                       <Activity className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                       <Input 
                         type="number"
                         placeholder="KM" 
                         value={searchRadius}
                         onChange={(e) => setSearchRadius(Number(e.target.value))}
                         className="pl-9 h-10 border-none bg-secondary/50 font-bold focus-visible:ring-0"
                       />
                    </div>
                    <div className="w-24 relative">
                       <ListFilter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                       <Input 
                         type="number"
                         placeholder="Qty" 
                         value={searchMaxResults}
                         onChange={(e) => setSearchMaxResults(Number(e.target.value))}
                         className="pl-9 h-10 border-none bg-secondary/50 font-bold focus-visible:ring-0"
                       />
                    </div>
                    <div className="flex gap-2">
                       <Button 
                         variant="secondary" 
                         onClick={handleRandomSearch}
                         className="h-10 px-3 bg-secondary/50 hover:bg-secondary border-none"
                         title="Random Discovery"
                       >
                         <Zap className="w-4 h-4" />
                       </Button>
                       <Button 
                         onClick={handleSearch} 
                         disabled={searching}
                         className="h-10 px-6 font-black text-[10px] uppercase tracking-widest shadow-lg"
                       >
                         {searching ? "..." : "Launch"}
                       </Button>
                    </div>
                 </div>
              </div>

              {/* Suggestions Overlay */}
              <div className="absolute top-32 left-1/2 -translate-x-1/2 z-30 flex flex-wrap gap-1.5 w-full max-w-4xl justify-center pointer-events-none">
                {SUGGESTED_NICHES.slice(0, 5).map(niche => (
                  <button 
                    key={niche}
                    onClick={() => setSearchKeyword(niche)}
                    className={`pointer-events-auto text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border transition-all ${
                      searchKeyword === niche 
                        ? 'bg-primary text-primary-foreground border-primary' 
                        : 'bg-card/50 backdrop-blur-md text-foreground border-border/50'
                    }`}
                  >
                    {niche}
                  </button>
                ))}
              </div>

              {/* Full Screen Map */}
              <div className="flex-1 w-full h-full">
                <BusinessSelectorMap 
                  lat={selectedLat} 
                  lng={selectedLng} 
                  radius={searchRadius}
                  opportunities={[
                    ...searchResults.map(r => ({
                      id: `search-${r.name}-${r.lat}`,
                      name: r.name,
                      lat: r.lat,
                      lng: r.lng,
                      leadScore: r.leadScore,
                      seoScore: r.technicalAudit.seoScore,
                      isCrm: false
                    })),
                    ...listings.filter(l => l.lat && l.lng).map(l => ({
                      id: `crm-${l.id}`,
                      name: l.name,
                      lat: l.lat,
                      lng: l.lng,
                      leadScore: l.leadScore,
                      seoScore: l.technicalAudit.seoScore,
                      isCrm: true
                    }))
                  ]}
                  onSelect={(lat, lng) => {
                    setSelectedLat(lat);
                    setSelectedLng(lng);
                    if(!searchLocation) setSearchLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                  }} 
                />
              </div>

              {/* Sticky Analysis Widget (Bottom Right) */}
              <AnimatePresence>
                {searchResults.length > 0 && (
                  <motion.div 
                    initial={{ x: 300, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 300, opacity: 0 }}
                    className="absolute bottom-10 right-10 z-40 w-80 max-w-full"
                  >
                    <Card className="bg-card/90 backdrop-blur-xl border-border shadow-2xl overflow-hidden rounded-md">
                       <CardHeader className="bg-primary/5 p-4 border-b border-border">
                          <div className="flex items-center justify-between">
                             <CardTitle className="text-xs font-black uppercase tracking-widest">Extraction Snapshot</CardTitle>
                             <Badge className="bg-primary hover:bg-primary text-[8px] font-black px-1.5 py-0">{searchResults.length}</Badge>
                          </div>
                       </CardHeader>
                       <CardContent className="p-4 space-y-4">
                          <div className="space-y-3 max-h-60 overflow-y-auto no-scrollbar">
                             {searchResults.slice(0, 4).map((res, i) => (
                               <div key={i} className="flex items-center justify-between group cursor-pointer" onClick={() => openLeadDetail(res)}>
                                  <div className="flex-1 min-w-0">
                                     <p className="text-[10px] font-bold text-foreground truncate group-hover:text-primary transition-colors">{res.name}</p>
                                     <p className="text-[8px] text-muted-foreground uppercase font-medium">{res.category}</p>
                                  </div>
                                  <div className={`text-[10px] font-black ${res.leadScore > 70 ? 'text-primary' : 'text-muted-foreground'}`}>
                                     {res.leadScore}%
                                  </div>
                                </div>
                             ))}
                          </div>
                          <Button 
                            className="w-full h-10 font-black text-[9px] uppercase tracking-[0.2em] shadow-lg shadow-primary/20"
                            onClick={() => setActiveTab('search-results')}
                          >
                            Full Report <ArrowUpRight className="ml-2 w-3.5 h-3.5" />
                          </Button>
                       </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
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
                    disabled={isSyncing || searchResults.length === 0 || searchResults.every(r => listings.some(l => l.name === r.name && l.address === r.address))}
                    className="flex-1 sm:flex-none font-bold text-[8px] sm:text-[9px] uppercase tracking-wider h-8 sm:h-10 px-4 sm:px-6 shadow-md active:scale-95 transition-all w-full sm:w-auto mt-2 sm:mt-0"
                    onClick={() => syncAllToCRM(searchResults)}
                  >
                    {isSyncing ? "Syncing..." : (searchResults.every(r => listings.some(l => l.name === r.name && l.address === r.address)) ? "Already In CRM" : "Save to CRM")}
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
                    {paginatedSearchResults.map((biz, idx) => {
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
                                     {alreadySaved && <Badge className="bg-primary hover:bg-primary shadow-lg shadow-primary/20 text-[7px] h-3.5 px-1 font-black uppercase tracking-widest whitespace-nowrap">In CRM</Badge>}
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
                      Showing Page {searchResultsPage} of {Math.ceil(searchResults.length / itemsPerPage)}
                   </p>
                   <div className="flex gap-1.5">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={searchResultsPage === 1}
                        onClick={() => setSearchResultsPage(prev => Math.max(1, prev - 1))}
                        className="h-9 px-4 rounded-md font-bold border-border text-muted-foreground hover:bg-secondary transition-all"
                      >
                        Prev
                      </Button>
                      <div className="flex gap-1 items-center px-1">
                         {Array.from({ length: Math.ceil(searchResults.length / itemsPerPage) }).map((_, i) => (
                           <button
                             key={i}
                             onClick={() => setSearchResultsPage(i + 1)}
                             className={`w-9 h-9 rounded-md font-bold text-xs transition-all ${
                               searchResultsPage === i + 1 
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
                        disabled={searchResultsPage === Math.ceil(searchResults.length / itemsPerPage)}
                        onClick={() => setSearchResultsPage(prev => Math.min(Math.ceil(searchResults.length / itemsPerPage), prev + 1))}
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
                        <TableHead className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-4 sm:px-8 h-12 sm:h-14">Target Intel</TableHead>
                        <TableHead className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-4 sm:px-8 h-12 sm:h-14">Extraction Date</TableHead>
                        <TableHead className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-4 sm:px-8 h-12 sm:h-14">Engagement Status</TableHead>
                        <TableHead className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-4 sm:px-8 h-12 sm:h-14">Efficiency</TableHead>
                        <TableHead className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-4 sm:px-8 h-12 sm:h-14 text-right pr-4 sm:pr-8">Strategic Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedCrmList.length === 0 ? (
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
                        paginatedCrmList.map((lead) => (
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

              {/* CRM Pagination Controls */}
              {filteredCrmList.length > itemsPerPage && (
                <div className="flex items-center justify-between pt-8 border-t border-border mt-10">
                   <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Node {crmPage} / {Math.ceil(filteredCrmList.length / itemsPerPage)}
                   </p>
                   <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={crmPage === 1}
                        onClick={() => setCrmPage(prev => Math.max(1, prev - 1))}
                        className="h-10 px-6 rounded-md font-bold border-border bg-card text-muted-foreground hover:bg-secondary transition-all"
                      >
                        Previous
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={crmPage === Math.ceil(filteredCrmList.length / itemsPerPage)}
                        onClick={() => setCrmPage(prev => Math.min(Math.ceil(filteredCrmList.length / itemsPerPage), prev + 1))}
                        className="h-10 px-6 rounded-md font-bold border-border bg-card text-muted-foreground hover:bg-secondary transition-all"
                      >
                        Next Sequence
                      </Button>
                   </div>
                </div>
              )}
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
                  <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-6 border-b border-border">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] mb-1 sm:mb-2 leading-none">Audit Trails</p>
                      <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tighter text-foreground uppercase truncate">Discovery Vault</h1>
                      <p className="text-muted-foreground font-medium text-[11px] sm:text-xs mt-1 truncate">Archived sequence logs of historical business scans.</p>
                    </div>
                  </header>

                  <Card className="bg-card rounded-md border border-border shadow-sm overflow-x-auto">
                    <Table className="min-w-[700px] lg:min-w-full">
                      <TableHeader>
                        <TableRow className="bg-secondary/30 hover:bg-secondary/30 border-b border-border">
                          <TableHead className="text-muted-foreground font-bold text-[9px] uppercase tracking-widest pl-6 h-11">Temporal Marker</TableHead>
                          <TableHead className="text-muted-foreground font-bold text-[9px] uppercase tracking-widest h-11">Target Vector</TableHead>
                          <TableHead className="text-muted-foreground font-bold text-[9px] uppercase tracking-widest h-11">City</TableHead>
                          <TableHead className="text-muted-foreground font-bold text-[9px] uppercase tracking-widest h-11 text-center">Dataset Density</TableHead>
                          <TableHead className="text-muted-foreground font-bold text-[9px] uppercase tracking-widest h-11 text-center">Radius (KM)</TableHead>
                          <TableHead className="text-muted-foreground font-bold text-[9px] uppercase tracking-widest text-right pr-6 h-11">Resolution</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scans.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="h-64 text-center">
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
                                     {scan.timestamp ? new Date(scan.timestamp.seconds * 1000).toLocaleDateString() : 'Pending'}
                                   </span>
                                   <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-tighter">
                                     {scan.timestamp ? new Date(scan.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                   </span>
                                </div>
                              </TableCell>
                              <TableCell className="py-4">
                                <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 rounded bg-foreground flex items-center justify-center text-[10px] font-black text-background uppercase">
                                     {scan.keyword?.charAt(0) || 'S'}
                                   </div>
                                   <div>
                                      <p className="text-[13px] font-bold text-foreground leading-tight uppercase tracking-tight">{scan.keyword || 'Unknown'}</p>
                                      <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                                        <MapPin className="w-3 h-3 opacity-50" /> {scan.location}
                                      </p>
                                   </div>
                                </div>
                              </TableCell>
                              <TableCell className="py-4">
                                 <span className="text-[10px] font-bold text-foreground uppercase tracking-tight">{scan.city || scan.location?.split(',')[0]}</span>
                              </TableCell>
                              <TableCell className="text-center py-4">
                                 <Badge variant="secondary" className="border-none font-bold text-[9px] rounded px-2 py-0.5">
                                   {scan.count} Objects
                                 </Badge>
                              </TableCell>
                              <TableCell className="text-center py-4">
                                 <span className="text-[10px] font-bold text-muted-foreground">{scan.radius || 5} KM</span>
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
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-8 px-4 font-bold text-[9px] uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary"
                                  onClick={async () => {
                                    const scan = scans.find(s => s.id === selectedScanId);
                                    if (scan && scan.results) {
                                      await syncAllToCRM(scan.results);
                                    }
                                  }}
                                >
                                  Sync All 
                                </Button>

                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-8 px-4 font-bold text-[9px] uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary"
                                  onClick={() => {
                                    const scan = scans.find(s => s.id === selectedScanId);
                                    if (scan && scan.results) downloadCSV(scan.results, `scan_history_${scan.id}`);
                                  }}
                                >
                                  Download
                                </Button>
                              </div>
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

          {activeTab === 'portfolio' && (
            <motion.div 
              key="portfolio"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-10 lg:space-y-16"
            >
              <header className="pb-8 border-b border-border space-y-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
                      <div>
                        <p className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] mb-2 leading-none">Portfolio Intelligence</p>
                        <h1 className="text-3xl lg:text-4xl font-black tracking-tighter text-foreground uppercase">Portfolio Vault</h1>
                        <p className="text-muted-foreground font-medium text-sm mt-1">Lifecycle management for active client engagements</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="font-bold text-[9px] uppercase tracking-widest border-border"
                          onClick={() => {
                            const biz = listings.find(l => l.id === selectedLeadForOutreach?.id);
                            if (biz) {
                              const url = new URL(window.location.origin);
                              url.searchParams.set('share', biz.id);
                              navigator.clipboard.writeText(url.toString());
                              toast.success("Shared dashboard link copied!");
                            } else {
                              toast.error("Go to detailed lead view first or select a lead.");
                            }
                          }}
                        >
                          <Globe className="w-3.5 h-3.5 mr-2" /> Share View
                        </Button>
                      </div>
                      <div className="flex gap-4 w-full sm:w-auto">
                    <div className="flex-1 sm:flex-initial px-6 py-3 bg-secondary/30 border border-dashed border-border rounded-md flex flex-col items-center">
                       <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1.5 flex items-center gap-1.5"><Activity className="w-2.5 h-2.5" /> Stability</span>
                       <span className="text-xl font-black text-foreground">{(portfolio.length > 0 ? (portfolio.filter(c => !isServiceNear(c.nextServiceDate)).length / portfolio.length * 100).toFixed(0) : 100)}%</span>
                    </div>
                    <div className="flex-1 sm:flex-initial px-6 py-3 bg-primary/5 border border-primary/20 rounded-md flex flex-col items-center">
                       <span className="text-[9px] font-black text-primary uppercase tracking-widest leading-none mb-1.5 flex items-center gap-1.5"><Zap className="w-2.5 h-2.5" /> Retention</span>
                       <span className="text-xl font-black text-primary">{portfolio.length}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                   <div className="p-4 bg-card border border-border rounded flex flex-col gap-2 group hover:shadow-lg transition-all">
                      <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">Active Pipeline Health</span>
                      <div className="flex items-center gap-4">
                         <div className="text-2xl font-black text-foreground">Optimal</div>
                         <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                            <motion.div 
                               initial={{ width: 0 }}
                               animate={{ width: "92%" }}
                               className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                            />
                         </div>
                      </div>
                   </div>
                   <div className="p-4 bg-card border border-border rounded flex flex-col gap-2">
                      <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">Mean Engagement Variance</span>
                      <div className="flex items-center gap-3">
                         <div className="text-2xl font-black text-foreground">Low Risk</div>
                         <Badge className="bg-emerald-500/10 text-emerald-500 border-none font-bold text-[9px] uppercase tracking-tighter">Verified</Badge>
                      </div>
                   </div>
                   <div className="p-4 bg-primary/5 border border-primary/10 rounded flex flex-col gap-2 relative overflow-hidden group">
                      <Star className="absolute -right-4 -bottom-4 w-16 h-16 text-primary/5 rotate-12 transition-transform group-hover:scale-125" />
                      <span className="text-[9px] font-black text-primary uppercase tracking-widest leading-none">Estimated Portfolio Yield</span>
                      <div className="text-2xl font-black text-primary">
                        {(portfolio.length * 1450).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                      </div>
                   </div>
                </div>
              </header>

              <div className="grid grid-cols-1 gap-6 pb-20">
                {portfolio.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg bg-secondary/20 p-12 text-center space-y-4">
                    <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center">
                       <Briefcase className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-bold text-lg text-foreground">Vault is Empty</h3>
                      <p className="text-sm text-muted-foreground max-w-xs mx-auto">Convert verified leads to start tracking project delivery and service cycles.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-6">
                      {paginatedPortfolioList.map((client) => (
                        <Card key={client.id} className={`border-border shadow-sm overflow-hidden bg-card rounded-md ${isServiceNear(client.nextServiceDate) ? 'ring-2 ring-orange-500/50' : ''}`}>
                      <div className="grid grid-cols-1 lg:grid-cols-4">
                        <div className="lg:col-span-1 p-6 border-b lg:border-b-0 lg:border-r border-border flex flex-col justify-between space-y-6">
                           <div className="space-y-3">
                              <div className="w-12 h-12 bg-foreground text-background rounded flex items-center justify-center text-xl font-black shadow-lg">
                                 {client.name.charAt(0)}
                              </div>
                              <div>
                                 <h3 className="font-black text-xl tracking-tight text-foreground">{client.name}</h3>
                                 <p className="text-[10px] font-bold text-primary uppercase tracking-widest mt-1 flex items-center gap-1.5">
                                    <Badge variant="outline" className="px-1.5 border-primary/30 text-primary text-[8px] bg-primary/5 h-4 uppercase">{client.status}</Badge>
                                    Active Account
                                 </p>
                              </div>
                           </div>
                           {client.websiteUrl && (
                             <a href={client.websiteUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-primary transition-colors">
                               <Globe className="w-3.5 h-3.5" /> Site Live
                             </a>
                           )}
                        </div>
                        
                        <div className="lg:col-span-2 p-8 space-y-6">
                           <div className="space-y-4">
                              <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                                 <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Delivery Summary
                              </h4>
                              <p className="text-sm font-bold text-foreground leading-relaxed">{client.workDone}</p>
                              <p className="text-xs text-muted-foreground italic leading-relaxed">{client.detailedDescription}</p>
                           </div>
                           
                           <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
                              <div className="space-y-1.5">
                                 <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Acquired Date</p>
                                 <p className="text-xs font-bold text-foreground">{new Date(client.createdAt?.seconds * 1000 || client.createdAt).toLocaleDateString()}</p>
                              </div>
                              <div className="space-y-1.5">
                                 <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Project ID</p>
                                 <p className="text-xs font-mono font-bold text-muted-foreground/60">{client.id.slice(0, 8)}</p>
                              </div>
                           </div>
                        </div>

                        <div className="lg:col-span-1 p-6 bg-secondary/10 flex flex-col justify-between gap-6 border-t lg:border-t-0 border-border">
                           <div className="space-y-4">
                              <div className="p-3 bg-card border border-border rounded space-y-1 hover:shadow-sm transition-all cursor-default">
                                 <div className="flex items-center justify-between">
                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Service Expiry</p>
                                    <Clock className="w-3 h-3 text-muted-foreground/50" />
                                 </div>
                                 <p className="text-xs font-black text-foreground">{new Date(client.expiryDate).toLocaleDateString()}</p>
                              </div>
                              
                              <div className={`p-4 border rounded-sm space-y-2 relative overflow-hidden ${isServiceNear(client.nextServiceDate) ? 'bg-orange-500/10 border-orange-500/20' : 'bg-primary/5 border-primary/20'}`}>
                                 {isServiceNear(client.nextServiceDate) && (
                                   <div className="absolute top-0 right-0 p-1">
                                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-ping" />
                                   </div>
                                 )}
                                 <div className="flex items-center justify-between">
                                    <p className={`text-[9px] font-black uppercase tracking-widest ${isServiceNear(client.nextServiceDate) ? 'text-orange-500' : 'text-emerald-500'}`}>
                                       {isServiceNear(client.nextServiceDate) ? 'Urgent Cycle' : 'Healthy Cycle'}
                                    </p>
                                    <Wrench className={`w-3 h-3 ${isServiceNear(client.nextServiceDate) ? 'text-orange-500' : 'text-emerald-500/50'}`} />
                                 </div>
                                 <p className={`text-sm font-black ${isServiceNear(client.nextServiceDate) ? 'text-orange-600 dark:text-orange-400' : 'text-foreground'}`}>
                                    {new Date(client.nextServiceDate).toLocaleDateString()}
                                 </p>
                                 <div className="mt-1 flex items-center gap-1.5 opacity-50 uppercase tracking-tighter text-[9px] font-bold">
                                    <div className={`w-1 h-1 rounded-full ${isServiceNear(client.nextServiceDate) ? 'bg-orange-500' : 'bg-emerald-500'}`} />
                                    {isServiceNear(client.nextServiceDate) ? 'Critical Maintenance Required' : 'Optimized Operational Window'}
                                 </div>
                              </div>
                           </div>
                           
                           <div className="flex flex-col gap-2">
                              <Button variant="outline" size="sm" className="w-full h-9 rounded border-border bg-card font-black text-[9px] uppercase tracking-widest hover:bg-secondary">
                                 Manage Assets
                              </Button>
                              <Button size="sm" className="w-full h-9 rounded bg-primary text-primary-foreground font-black text-[9px] uppercase tracking-widest shadow-md">
                                 Renewal Draft
                              </Button>
                           </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                    {/* Portfolio Pagination Controls */}
                    {portfolio.length > itemsPerPage && (
                      <div className="flex items-center justify-between pt-8 border-t border-border mt-10">
                         <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            Vault Sector {portfolioPage} / {Math.ceil(portfolio.length / itemsPerPage)}
                         </p>
                         <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              disabled={portfolioPage === 1}
                              onClick={() => setPortfolioPage(prev => Math.max(1, prev - 1))}
                              className="h-10 px-6 rounded-md font-bold border-border bg-card text-muted-foreground hover:bg-secondary transition-all"
                            >
                              Previous Sector
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              disabled={portfolioPage === Math.ceil(portfolio.length / itemsPerPage)}
                              onClick={() => setPortfolioPage(prev => Math.min(Math.ceil(portfolio.length / itemsPerPage), prev + 1))}
                              className="h-10 px-6 rounded-md font-bold border-border bg-card text-muted-foreground hover:bg-secondary transition-all"
                            >
                              Next Sector
                            </Button>
                         </div>
                      </div>
                    )}
                  </>
                )}
              </div>
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
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex flex-col bg-background min-h-screen font-sans"
            >
              <div className="flex flex-col">
                {/* Header */}
                <div className="relative h-64 lg:h-72 bg-secondary/10 border-b border-border/50 p-8 lg:p-12 flex items-end">
                  <div className="absolute top-6 left-6 z-30">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={closeLeadDetail}
                      className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                    >
                      <ChevronRight className="w-4 h-4 rotate-180" /> Back to Dashboard
                    </Button>
                  </div>

                   {/* Header Section */}
                   <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6 w-full">
                      <div className="w-16 h-16 bg-primary/10 text-primary rounded-lg flex items-center justify-center text-2xl font-semibold border border-primary/20 shrink-0">
                        {selectedLeadForOutreach.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                           <h2 className="text-2xl font-semibold text-gray-900">{selectedLeadForOutreach.name}</h2>
                           <Badge className="bg-primary/10 text-primary border-primary/20 text-xs capitalize">{selectedLeadForOutreach.status}</Badge>
                        </div>
                        <p className="text-gray-600 text-sm flex items-center gap-2">
                           <MapPin className="w-4 h-4 text-gray-400" /> {selectedLeadForOutreach.address}
                        </p>
                      </div>
                      <div className="text-right">
                         <div className="text-4xl font-semibold text-primary">{selectedLeadForOutreach.leadScore}%</div>
                         <div className="text-xs text-gray-500 mt-1">Lead Score</div>
                      </div>
                   </div>
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto px-6 py-8">
                   {/* Left Column - Main Info */}
                   <div className="lg:col-span-2 space-y-6">
                      
                      {/* Technical Analysis */}
                      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                        <h3 className="text-base font-semibold text-gray-900 mb-4">Technical Analysis</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm text-gray-500 mb-1">SEO Score</div>
                            <div className="text-2xl font-semibold text-gray-900">{selectedLeadForOutreach.technicalAudit.seoScore}/10</div>
                            <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${selectedLeadForOutreach.technicalAudit.seoScore * 10}%` }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-500 mb-1">Load Speed</div>
                            <div className="text-2xl font-semibold text-gray-900 capitalize">{selectedLeadForOutreach.technicalAudit.loadSpeed}</div>
                            <div className="mt-2 flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${selectedLeadForOutreach.technicalAudit.loadSpeed === 'fast' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                              <span className="text-xs text-gray-500">
                                {selectedLeadForOutreach.technicalAudit.loadSpeed === 'fast' ? 'Good performance' : 'Needs optimization'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Analysis Comment */}
                      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                        <h3 className="text-base font-semibold text-gray-900 mb-3">Analysis</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">{selectedLeadForOutreach.auditComment}</p>
                      </div>

                      {/* Outreach Strategy */}
                      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                        <h3 className="text-base font-semibold text-gray-900 mb-3">Outreach Strategy</h3>
                        <p className="text-sm text-gray-600 leading-relaxed italic">"{selectedLeadForOutreach.outreachStrategy}"</p>
                      </div>

                      {/* Competitors */}
                      {selectedLeadForOutreach.competitorBenchmarks && selectedLeadForOutreach.competitorBenchmarks.length > 0 && (
                        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                          <h3 className="text-base font-semibold text-gray-900 mb-4">Competitors</h3>
                          <div className="space-y-3">
                            {selectedLeadForOutreach.competitorBenchmarks.map((comp, idx) => (
                              <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="flex justify-between items-start mb-2">
                                  <h4 className="text-sm font-medium text-gray-900">{comp.name}</h4>
                                  <Badge variant="outline" className="text-xs">SEO: {comp.seoScore}/10</Badge>
                                </div>
                                <p className="text-xs text-gray-600 italic">"{comp.advantage}"</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Benchmarking */}
                      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                        <h3 className="text-base font-semibold text-gray-900 mb-4">Benchmarking</h3>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Category Average</div>
                            <div className="text-xl font-semibold text-gray-900">
                              {(listings.filter(l => l.category === selectedLeadForOutreach.category).reduce((acc, curr) => acc + curr.leadScore, 0) / (listings.filter(l => l.category === selectedLeadForOutreach.category).length || 1)).toFixed(1)}%
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-1">This Lead</div>
                            <div className="text-xl font-semibold text-primary">{selectedLeadForOutreach.leadScore}%</div>
                          </div>
                        </div>
                        <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {selectedLeadForOutreach.leadScore > (listings.filter(l => l.category === selectedLeadForOutreach.category).reduce((acc, curr) => acc + curr.leadScore, 0) / (listings.filter(l => l.category === selectedLeadForOutreach.category).length || 1)) 
                              ? "This lead shows significant opportunity compared to category average. Recommended for outreach."
                              : "This lead performs at or below category average. Standard approach recommended."}
                          </p>
                        </div>
                      </div>

                      {/* Site Preview */}
                      {selectedLeadForOutreach.website && (
                        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-semibold text-gray-900">Website Preview</h3>
                            <a 
                              href={selectedLeadForOutreach.website} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-sm text-primary hover:underline flex items-center gap-1"
                            >
                              Visit Site <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          <div className="relative rounded-lg border border-gray-200 h-64 bg-gray-50 overflow-hidden">
                            <img 
                              src={`https://s0.wp.com/mshots/v1/${encodeURIComponent(selectedLeadForOutreach.website)}?w=800&h=600`} 
                              alt="Site Preview" 
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover object-top"
                            />
                          </div>
                        </div>
                      )}

                      {/* AI Outreach Generation */}
                      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-base font-semibold text-gray-900">AI Outreach</h3>
                          <Button 
                            size="sm"
                            onClick={() => generateOutreach(selectedLeadForOutreach)}
                            disabled={generatingOutreach}
                            className="text-sm"
                          >
                            {generatingOutreach ? (
                              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating...</>
                            ) : (
                              <><Zap className="w-4 h-4 mr-2" /> Generate Drafts</>
                            )}
                          </Button>
                        </div>

                        {selectedLeadForOutreach.outreachDrafts ? (
                          <div className="space-y-4">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-700">Email Draft</span>
                                <button 
                                  className="text-xs text-primary hover:underline flex items-center gap-1"
                                  onClick={() => {
                                    navigator.clipboard.writeText(selectedLeadForOutreach.outreachDrafts?.email || '');
                                    toast.success("Copied to clipboard");
                                  }}
                                >
                                  <Copy className="w-3 h-3" /> Copy
                                </button>
                              </div>
                              <div className="p-4 bg-gray-50 rounded border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap max-h-60 overflow-y-auto">
                                {selectedLeadForOutreach.outreachDrafts.email}
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-700">LinkedIn Draft</span>
                                <button 
                                  className="text-xs text-primary hover:underline flex items-center gap-1"
                                  onClick={() => {
                                    navigator.clipboard.writeText(selectedLeadForOutreach.outreachDrafts?.linkedin || '');
                                    toast.success("Copied to clipboard");
                                  }}
                                >
                                  <Copy className="w-3 h-3" /> Copy
                                </button>
                              </div>
                              <div className="p-4 bg-gray-50 rounded border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap max-h-60 overflow-y-auto">
                                {selectedLeadForOutreach.outreachDrafts.linkedin}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-400">
                            <Cpu className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">Click "Generate Drafts" to create personalized outreach messages</p>
                          </div>
                        )}
                      </div>
                   </div>

                   {/* Right Column - Metadata */}
                   <div className="space-y-6">
                      {/* Contact Info */}
                      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                        <h3 className="text-base font-semibold text-gray-900 mb-4">Contact Information</h3>
                        <div className="space-y-3">
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Category</div>
                            <div className="text-sm text-gray-900">{selectedLeadForOutreach.category}</div>
                          </div>
                          {selectedLeadForOutreach.phone && (
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Phone</div>
                              <div className="text-sm text-gray-900">{selectedLeadForOutreach.phone}</div>
                            </div>
                          )}
                          {selectedLeadForOutreach.email && (
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Email</div>
                              <div className="text-sm text-gray-900">{selectedLeadForOutreach.email}</div>
                            </div>
                          )}
                          {selectedLeadForOutreach.website && (
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Website</div>
                              <a 
                                href={selectedLeadForOutreach.website} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-sm text-primary hover:underline break-all"
                              >
                                {selectedLeadForOutreach.website}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Social Links */}
                      {selectedLeadForOutreach.socialLinks && selectedLeadForOutreach.socialLinks.length > 0 && (
                        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                          <h3 className="text-base font-semibold text-gray-900 mb-4">Social Media</h3>
                          <div className="flex flex-wrap gap-2">
                            {selectedLeadForOutreach.socialLinks.map((link, i) => (
                              <a 
                                key={i} 
                                href={link} 
                                target="_blank" 
                                rel="noreferrer"
                                className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center hover:bg-primary hover:text-white hover:border-primary transition-all"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                        <h3 className="text-base font-semibold text-gray-900 mb-4">Actions</h3>
                        <div className="space-y-3">
                          <Button 
                            className="w-full"
                            disabled={selectedLeadForOutreach.status === 'closed'}
                            onClick={() => setIsPromotionDialogOpen(true)}
                          >
                            {selectedLeadForOutreach.status === 'closed' ? 'Already a Client' : 'Promote to Client'}
                          </Button>
                          <Button 
                            variant="destructive"
                            className="w-full"
                            onClick={() => {
                              deleteListing(selectedLeadForOutreach.id);
                              closeLeadDetail();
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete Lead
                          </Button>
                        </div>
                      </div>
                   </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Dialog open={isPromotionDialogOpen} onOpenChange={setIsPromotionDialogOpen}>
          <DialogContent className="sm:max-w-md bg-white border-gray-200 shadow-lg p-0 overflow-hidden rounded-lg">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20">
                   <Briefcase className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Promote to Client</h2>
                  <p className="text-sm text-gray-500">{selectedLeadForOutreach?.name}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Delivered Services</label>
                  <Input 
                    placeholder="e.g. Website Redesign, SEO Audit, GMB Cleanup" 
                    value={promotionDetails.workDone}
                    onChange={(e) => setPromotionDetails(prev => ({ ...prev, workDone: e.target.value }))}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Project Narrative</label>
                  <textarea 
                    placeholder="Detailed audit findings and implemented solutions..." 
                    value={promotionDetails.detailedDescription}
                    onChange={(e) => setPromotionDetails(prev => ({ ...prev, detailedDescription: e.target.value }))}
                    className="w-full h-24 p-3 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Duration (Months)</label>
                    <Input 
                      type="number" 
                      value={promotionDetails.expiryMonths}
                      onChange={(e) => setPromotionDetails(prev => ({ ...prev, expiryMonths: parseInt(e.target.value) }))}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Next Service (Months)</label>
                    <Input 
                      type="number" 
                      value={promotionDetails.nextServiceMonths}
                      onChange={(e) => setPromotionDetails(prev => ({ ...prev, nextServiceMonths: parseInt(e.target.value) }))}
                      className="h-10"
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="bg-gray-50 px-6 py-4 flex flex-row gap-3">
              <Button 
                variant="outline" 
                onClick={() => setIsPromotionDialogOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={promoteLeadToClient}
                className="flex-1"
              >
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
