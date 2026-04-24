import { useState, useEffect } from 'react';
import { db } from '@/firebase';
import { 
  onSnapshot,
  collection,
  query,
  orderBy,
} from 'firebase/firestore';
import { BusinessListing, PortfolioClient, ScanHistory } from '@/types';

export function useFirestoreData(user: { email: string } | null) {
  const [listings, setListings] = useState<BusinessListing[]>([]);
  const [scans, setScans] = useState<ScanHistory[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioClient[]>([]);

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

  return { listings, setListings, scans, portfolio };
}
