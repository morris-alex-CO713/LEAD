import { FieldValue } from 'firebase/firestore';

export interface BusinessListing {
  id: string;
  uid: string;
  name: string;
  address: string;
  category: string;
  lat: number;
  lng: number;
  website?: string;
  phone?: string;
  email?: string;
  socialLinks: string[];
  rating?: number | null;
  reviewsCount?: number;
  hasWebsite: boolean;
  isWebsiteGood: boolean;
  auditComment: string;
  technicalAudit: {
    seoScore: number;
    mobileFriendly: boolean;
    loadSpeed: string;
  };
  leadScore: number;
  outreachStrategy: string;
  status: 'new' | 'contacted' | 'qualified' | 'rejected' | 'closed';
  createdAt: any;
  connectionDone?: boolean;
  reachedMode?: 'Email' | 'LinkedIn' | 'Phone' | 'Other';
  outreachDrafts?: {
    email?: string;
    linkedin?: string;
    lastGenerated?: number;
  };
  outreachApprovalStatus?: 'pending_review' | 'approved' | 'sent' | 'rejected';
  outreachSubject?: string;
  outreachEmail?: string;
}

export interface UserProfile {
  email: string;
  role: 'admin' | 'client';
  displayName: string;
}

export interface PortfolioClient {
  id: string;
  uid: string;
  businessId: string;
  name: string;
  websiteUrl: string;
  workDone: string;
  detailedDescription: string;
  expiryDate: string;
  nextServiceDate: string;
  status: 'active' | 'maintenance' | 'expired';
  createdAt: any;
}

export interface ScanHistory {
  id: string;
  uid: string;
  location: string;
  keyword: string;
  resultsCount: number;
  timestamp: any;
}

export interface ApiUsageLog {
  id: string;
  type: 'search' | 'outreach' | 'renewal';
  model: string;
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  success: boolean;
  error?: string;
  timestamp: any;
}
