import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { BusinessListing } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export const FirebaseService = {
  /**
   * Saves a business lead to the CRM.
   */
  async saveListing(biz: any) {
    try {
      return await addDoc(collection(db, 'business_listings'), {
        ...biz,
        uid: auth.currentUser?.uid || 'akash-prospect-admin',
        status: 'new',
        createdAt: serverTimestamp(),
        connectionDone: false
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'business_listings');
    }
  },

  /**
   * Updates a lead's status (e.g. Qualified, Contacted).
   */
  async updateStatus(id: string, status: BusinessListing['status']) {
    try {
      await updateDoc(doc(db, 'business_listings', id), { status });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'business_listings');
    }
  },

  /**
   * Updates partial fields for a lead.
   */
  async updateLead(id: string, updates: Partial<BusinessListing>) {
    try {
      await updateDoc(doc(db, 'business_listings', id), updates);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'business_listings');
    }
  },

  /**
   * Deletes a lead listing.
   */
  async deleteListing(id: string) {
    try {
      await deleteDoc(doc(db, 'business_listings', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'business_listings');
    }
  },

  /**
   * Promotes a Lead to a Client in the Portfolio Vault.
   */
  async promoteToClient(clientData: any, leadId: string) {
    try {
      await addDoc(collection(db, 'portfolio_vault'), {
        ...clientData,
        uid: auth.currentUser?.uid || 'akash-prospect-admin',
        createdAt: serverTimestamp(),
        status: 'active'
      });
      await updateDoc(doc(db, 'business_listings', leadId), { status: 'closed' });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'portfolio_vault');
    }
  },

  /**
   * Adds a record to search history.
   */
  async addScanHistory(scan: any) {
    try {
      await addDoc(collection(db, 'scans'), {
        ...scan,
        uid: auth.currentUser?.uid || 'akash-prospect-admin',
        timestamp: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'scans');
    }
  }
};
