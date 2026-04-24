import { useState, useEffect, useRef } from 'react';
import { auth, db } from './firebase';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { testFirestoreConnection } from './lib/firestore-errors';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { GoogleGenAI, Type } from "@google/genai";
import { DropResult } from '@hello-pangea/dnd';
import { AnimatePresence } from 'motion/react';

// Hooks
import { useTheme } from './hooks/useTheme';
import { useAuth } from './hooks/useAuth';
import { useFirestoreData } from './hooks/useFirestoreData';

// Views
import { LoginView } from './views/LoginView';
import { LoadingView } from './views/LoadingView';

// Components
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import { ExtractionModal } from './components/ExtractionModal';
import { PromotionDialog, PromotionDetails } from './components/PromotionDialog';

// Services & Utils
import { FirebaseService } from './services/firebaseService';
import { BusinessResult, searchAndAuditBusinesses } from './lib/gemini';
import { downloadCSV, exportListingsToCSV } from './utils/csvExport';
import { isServiceNear } from './utils/dateHelpers';

// Types
import { BusinessListing } from './types';

// TODO: Import view components when created
// import { DashboardView } from './views/DashboardView';
// import { SearchView } from './views/SearchView';
// import { LeadsView } from './views/LeadsView';
// etc...

export default function App() {
  const { theme, setTheme } = useTheme();
  const { user, profile, loading, handleLogin, handleLogout } = useAuth();
  const { listings, setListings, scans, portfolio } = useFirestoreData(user);

  const [searching, setSearching] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchLocation, setSearchLocation] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchRadius, setSearchRadius] = useState(5);
  const [searchMaxResults, setSearchMaxResults] = useState(10);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [previousTab, setPreviousTab] = useState('dashboard');
  const [searchFilter, setSearchFilter] = useState('');
  const [isClientView, setIsClientView] = useState(false);
  const [sharedLead, setSharedLead] = useState<BusinessListing | null>(null);
  const [dashboardFilter, setDashboardFilter] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<BusinessResult[]>([]);
  
  // CRM States
  const [crmSearch, setCrmSearch] = useState('');
  const [crmCategoryFilter, setCrmCategoryFilter] = useState<string | null>(null);
  const [crmStatusTab, setCrmStatusTab] = useState<'all' | 'reached'>('all');

  // Map state
  const [selectedLat, setSelectedLat] = useState(0);
  const [selectedLng, setSelectedLng] = useState(0);

  // Outreach & Kanban States
  const [selectedLeadForOutreach, setSelectedLeadForOutreach] = useState<BusinessListing | null>(null);
  const [generatingOutreach, setGeneratingOutreach] = useState(false);
  const [outreachTone, setOutreachTone] = useState<'professional' | 'aggressive' | 'helpful' | 'curious'>('professional');
  const [activeBoardView, setActiveBoardView] = useState<'list' | 'kanban'>('list');
  const mainContentRef = useRef<HTMLElement>(null);

  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  const [isPromotionDialogOpen, setIsPromotionDialogOpen] = useState(false);
  
  const [searchResultsPage, setSearchResultsPage] = useState(1);
  const [crmPage, setCrmPage] = useState(1);
  const [portfolioPage, setPortfolioPage] = useState(1);
  const itemsPerPage = 10;

  const [manualLead, setManualLead] = useState({
    name: '',
    address: '',
    category: '',
    website: '',
    phone: '',
    email: '',
  });

  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  useEffect(() => {
    testFirestoreConnection();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get('share') || params.get('client');
    if (sharedId) {
      setIsClientView(true);
    }
  }, []);

  useEffect(() => {
    if (isClientView) {
      const params = new URLSearchParams(window.location.search);
      const sharedId = params.get('share') || params.get('client');
      if (sharedId) {
        const found = listings.find(l => l.id === sharedId);
        if (found) {
          setSharedLead(found);
        }
      }
    }
  }, [isClientView, listings]);

  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo(0, 0);
    }
  }, [activeTab, selectedLeadForOutreach]);

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

  const promoteLeadToClient = async (details: PromotionDetails) => {
    if (!selectedLeadForOutreach || !user) return;
    
    try {
      const now = new Date();
      
      const expiryDate = new Date(now);
      expiryDate.setMonth(expiryDate.getMonth() + details.expiryMonths);
      
      const nextServiceDate = new Date(now);
      nextServiceDate.setMonth(nextServiceDate.getMonth() + details.nextServiceMonths);

      const clientData = {
        uid: auth.currentUser?.uid || 'akash-prospect-admin',
        businessId: selectedLeadForOutreach.id,
        name: selectedLeadForOutreach.name,
        websiteUrl: selectedLeadForOutreach.website || '',
        workDone: details.workDone,
        detailedDescription: details.detailedDescription,
        expiryDate: expiryDate.toISOString(),
        nextServiceDate: nextServiceDate.toISOString(),
        status: 'active',
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'portfolio_vault'), clientData);
      await updateDoc(doc(db, 'business_listings', selectedLeadForOutreach.id), { status: 'closed' });
      
      setIsPromotionDialogOpen(false);
      toast.success(`${selectedLeadForOutreach.name} promoted to Portfolio Vault!`);
      closeLeadDetail();
    } catch (err) {
      console.error(err);
      toast.error("Failed to promote lead.");
    }
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

  // Client view rendering
  if (isClientView) {
    // TODO: Extract to ClientView component
    return <div>Client View - To be extracted</div>;
  }

  if (loading) {
    return <LoadingView />;
  }

  if (!user) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <div className="h-screen bg-background text-foreground flex overflow-hidden selection:bg-primary selection:text-primary-foreground">
      <Toaster position="top-right" expand={true} richColors theme={theme} />
      
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        theme={theme} 
        setTheme={setTheme} 
        profile={profile} 
        onLogout={handleLogout} 
      />

      <BottomNav 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        theme={theme} 
        setTheme={setTheme} 
      />

      <ExtractionModal open={searching} onOpenChange={setSearching} />

      <main ref={mainContentRef} className={`flex-1 overflow-y-auto mb-16 lg:mb-0 ${activeTab === 'lead-detail' ? 'p-0' : 'p-4 sm:p-6 lg:p-12'}`}>
        <AnimatePresence mode="wait">
          {/* TODO: Replace with actual view components */}
          <div>
            <h1>Active Tab: {activeTab}</h1>
            <p>Views to be extracted into separate components</p>
          </div>
        </AnimatePresence>
      </main>

      <PromotionDialog 
        open={isPromotionDialogOpen}
        onOpenChange={setIsPromotionDialogOpen}
        selectedLead={selectedLeadForOutreach}
        onPromote={promoteLeadToClient}
      />
    </div>
  );
}
