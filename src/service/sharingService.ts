import { auth, db } from './firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  onSnapshot,
  getDocs,
  orderBy,
  limit,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { notificationService } from './notificationService';

export interface RideShareData {
  id: string;
  rideId: string;
  userId: string;
  userName: string;
  shareType: 'whatsapp' | 'sms' | 'link' | 'email';
  shareContent: {
    title: string;
    message: string;
    link?: string;
    expiresAt: Date;
  };
  recipients: string[]; // phone numbers or email addresses
  status: 'active' | 'expired' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  analytics: {
    views: number;
    clicks: number;
    shares: number;
    lastViewed?: Date;
  };
  metadata: {
    from: string;
    to: string;
    driverName?: string;
    driverPhone?: string;
    cabNumber?: string;
    estimatedArrival?: Date;
    rideStatus: 'requested' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  };
}

export interface ShareableRideInfo {
  rideId: string;
  from: string;
  to: string;
  driverName?: string;
  driverPhone?: string;
  cabNumber?: string;
  estimatedArrival?: Date;
  rideStatus: string;
  shareMessage: string;
  shareLink: string;
}

export interface SharingAnalytics {
  totalShares: number;
  activeShares: number;
  totalViews: number;
  totalClicks: number;
  popularDestinations: Array<{ location: string; count: number }>;
  shareTypeBreakdown: Array<{ type: string; count: number }>;
}

class SharingService {
  private activeShares: Map<string, RideShareData> = new Map();
  private shareListener: (() => void) | null = null;

  constructor() {
    this.initializeService();
  }

  // Initialize the service
  private async initializeService() {
    if (auth.currentUser) {
      await this.loadActiveShares();
    }
  }

  // Load active shares for current user
  private async loadActiveShares() {
    if (!auth.currentUser) return;

    try {
      const sharesQuery = query(
        collection(db, 'rideShares'),
        where('userId', '==', auth.currentUser.uid),
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(sharesQuery);
      this.activeShares.clear();

      snapshot.forEach((doc) => {
        const share = { id: doc.id, ...doc.data() } as RideShareData;
        this.activeShares.set(doc.id, share);
      });

      console.log(`Loaded ${this.activeShares.size} active shares`);
    } catch (error) {
      console.error('Error loading active shares:', error);
    }
  }

  // Create a new ride share
  async createRideShare(shareData: Omit<RideShareData, 'id' | 'createdAt' | 'updatedAt' | 'analytics'>): Promise<string> {
    try {
      const shareDoc: Omit<RideShareData, 'id'> = {
        ...shareData,
        createdAt: new Date(),
        updatedAt: new Date(),
        analytics: {
          views: 0,
          clicks: 0,
          shares: 0,
        },
      };

      const docRef = await addDoc(collection(db, 'rideShares'), shareDoc);
      
      // Add to local cache
      this.activeShares.set(docRef.id, { id: docRef.id, ...shareDoc });

      console.log('Ride share created:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error creating ride share:', error);
      throw error;
    }
  }

  // Share ride via WhatsApp
  async shareRideViaWhatsApp(rideInfo: ShareableRideInfo, recipients: string[]): Promise<string> {
    const shareContent = this.generateShareContent(rideInfo, 'whatsapp');
    
    const shareData: Omit<RideShareData, 'id' | 'createdAt' | 'updatedAt' | 'analytics'> = {
      rideId: rideInfo.rideId,
      userId: auth.currentUser?.uid || '',
      userName: auth.currentUser?.displayName || 'User',
      shareType: 'whatsapp',
      shareContent,
      recipients,
      status: 'active',
      metadata: {
        from: rideInfo.from,
        to: rideInfo.to,
        driverName: rideInfo.driverName,
        driverPhone: rideInfo.driverPhone,
        cabNumber: rideInfo.cabNumber,
        estimatedArrival: rideInfo.estimatedArrival,
        rideStatus: rideInfo.rideStatus as any,
      },
    };

    return await this.createRideShare(shareData);
  }

  // Share ride via SMS
  async shareRideViaSMS(rideInfo: ShareableRideInfo, recipients: string[]): Promise<string> {
    const shareContent = this.generateShareContent(rideInfo, 'sms');
    
    const shareData: Omit<RideShareData, 'id' | 'createdAt' | 'updatedAt' | 'analytics'> = {
      rideId: rideInfo.rideId,
      userId: auth.currentUser?.uid || '',
      userName: auth.currentUser?.displayName || 'User',
      shareType: 'sms',
      shareContent,
      recipients,
      status: 'active',
      metadata: {
        from: rideInfo.from,
        to: rideInfo.to,
        driverName: rideInfo.driverName,
        driverPhone: rideInfo.driverPhone,
        cabNumber: rideInfo.cabNumber,
        estimatedArrival: rideInfo.estimatedArrival,
        rideStatus: rideInfo.rideStatus as any,
      },
    };

    return await this.createRideShare(shareData);
  }

  // Share ride via link
  async shareRideViaLink(rideInfo: ShareableRideInfo): Promise<string> {
    const shareContent = this.generateShareContent(rideInfo, 'link');
    
    const shareData: Omit<RideShareData, 'id' | 'createdAt' | 'updatedAt' | 'analytics'> = {
      rideId: rideInfo.rideId,
      userId: auth.currentUser?.uid || '',
      userName: auth.currentUser?.displayName || 'User',
      shareType: 'link',
      shareContent,
      recipients: [],
      status: 'active',
      metadata: {
        from: rideInfo.from,
        to: rideInfo.to,
        driverName: rideInfo.driverName,
        driverPhone: rideInfo.driverPhone,
        cabNumber: rideInfo.cabNumber,
        estimatedArrival: rideInfo.estimatedArrival,
        rideStatus: rideInfo.rideStatus as any,
      },
    };

    return await this.createRideShare(shareData);
  }

  // Generate share content based on type
  private generateShareContent(rideInfo: ShareableRideInfo, type: 'whatsapp' | 'sms' | 'link' | 'email'): RideShareData['shareContent'] {
    const baseMessage = `🚗 RideWise Trip Update\n\n` +
      `📍 From: ${rideInfo.from}\n` +
      `🎯 To: ${rideInfo.to}\n` +
      `👤 Driver: ${rideInfo.driverName || 'Assigned'}\n` +
      `📱 Driver Phone: ${rideInfo.driverPhone || 'N/A'}\n` +
      `🚙 Cab Number: ${rideInfo.cabNumber || 'N/A'}\n` +
      `⏰ ETA: ${rideInfo.estimatedArrival ? new Date(rideInfo.estimatedArrival).toLocaleTimeString() : 'Calculating...'}\n` +
      `📊 Status: ${rideInfo.rideStatus}\n\n` +
      `🔗 Track your ride: ${rideInfo.shareLink}\n\n` +
      `⚠️ This link expires when the trip is completed.`;

    const title = `RideWise Trip: ${rideInfo.from} → ${rideInfo.to}`;
    
    // Set expiration to 4 hours from now (typical ride duration)
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);

    return {
      title,
      message: baseMessage,
      link: rideInfo.shareLink,
      expiresAt,
    };
  }

  // Update ride share
  async updateRideShare(shareId: string, updates: Partial<RideShareData>): Promise<void> {
    try {
      const shareRef = doc(db, 'rideShares', shareId);
      await updateDoc(shareRef, {
        ...updates,
        updatedAt: new Date(),
      });

      // Update local cache
      const share = this.activeShares.get(shareId);
      if (share) {
        Object.assign(share, updates, { updatedAt: new Date() });
      }

      console.log('Ride share updated:', shareId);
    } catch (error) {
      console.error('Error updating ride share:', error);
      throw error;
    }
  }

  // Cancel ride share
  async cancelRideShare(shareId: string): Promise<void> {
    try {
      await this.updateRideShare(shareId, { status: 'cancelled' });
      
      // Remove from active shares
      this.activeShares.delete(shareId);
      
      console.log('Ride share cancelled:', shareId);
    } catch (error) {
      console.error('Error cancelling ride share:', error);
      throw error;
    }
  }

  // Expire ride share
  async expireRideShare(shareId: string): Promise<void> {
    try {
      await this.updateRideShare(shareId, { status: 'expired' });
      
      // Remove from active shares
      this.activeShares.delete(shareId);
      
      console.log('Ride share expired:', shareId);
    } catch (error) {
      console.error('Error expiring ride share:', error);
      throw error;
    }
  }

  // Track share view
  async trackShareView(shareId: string): Promise<void> {
    try {
      const shareRef = doc(db, 'rideShares', shareId);
      await updateDoc(shareRef, {
        'analytics.views': increment(1),
        'analytics.lastViewed': new Date(),
        updatedAt: new Date(),
      });

      // Update local cache
      const share = this.activeShares.get(shareId);
      if (share) {
        share.analytics.views += 1;
        share.analytics.lastViewed = new Date();
        share.updatedAt = new Date();
      }

      console.log('Share view tracked:', shareId);
    } catch (error) {
      console.error('Error tracking share view:', error);
    }
  }

  // Track share click
  async trackShareClick(shareId: string): Promise<void> {
    try {
      const shareRef = doc(db, 'rideShares', shareId);
      await updateDoc(shareRef, {
        'analytics.clicks': increment(1),
        updatedAt: new Date(),
      });

      // Update local cache
      const share = this.activeShares.get(shareId);
      if (share) {
        share.analytics.clicks += 1;
        share.updatedAt = new Date();
      }

      console.log('Share click tracked:', shareId);
    } catch (error) {
      console.error('Error tracking share click:', error);
    }
  }

  // Track share reshare
  async trackShareReshare(shareId: string): Promise<void> {
    try {
      const shareRef = doc(db, 'rideShares', shareId);
      await updateDoc(shareRef, {
        'analytics.shares': increment(1),
        updatedAt: new Date(),
      });

      // Update local cache
      const share = this.activeShares.get(shareId);
      if (share) {
        share.analytics.shares += 1;
        share.updatedAt = new Date();
      }

      console.log('Share reshare tracked:', shareId);
    } catch (error) {
      console.error('Error tracking share reshare:', error);
    }
  }

  // Get user's ride shares
  async getUserRideShares(userId: string, callback: (shares: RideShareData[]) => void) {
    const q = query(
      collection(db, 'rideShares'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const shares: RideShareData[] = [];
      snapshot.forEach((doc) => {
        shares.push({
          id: doc.id,
          ...doc.data()
        } as RideShareData);
      });
      
      callback(shares);
    });
  }

  // Get ride shares for a specific ride
  async getRideSharesForRide(rideId: string): Promise<RideShareData[]> {
    try {
      const q = query(
        collection(db, 'rideShares'),
        where('rideId', '==', rideId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const shares: RideShareData[] = [];

      snapshot.forEach((doc) => {
        shares.push({
          id: doc.id,
          ...doc.data()
        } as RideShareData);
      });

      return shares;
    } catch (error) {
      console.error('Error getting ride shares for ride:', error);
      return [];
    }
  }

  // Get sharing analytics for user
  async getUserSharingAnalytics(userId: string): Promise<SharingAnalytics> {
    try {
      const q = query(
        collection(db, 'rideShares'),
        where('userId', '==', userId)
      );

      const snapshot = await getDocs(q);
      const analytics: SharingAnalytics = {
        totalShares: 0,
        activeShares: 0,
        totalViews: 0,
        totalClicks: 0,
        popularDestinations: [],
        shareTypeBreakdown: [],
      };

      const destinations: Map<string, number> = new Map();
      const shareTypes: Map<string, number> = new Map();

      snapshot.forEach((doc) => {
        const share = doc.data() as RideShareData;
        
        analytics.totalShares++;
        if (share.status === 'active') analytics.activeShares++;
        analytics.totalViews += share.analytics.views;
        analytics.totalClicks += share.analytics.clicks;

        // Count destinations
        const dest = share.metadata.to;
        destinations.set(dest, (destinations.get(dest) || 0) + 1);

        // Count share types
        const type = share.shareType;
        shareTypes.set(type, (shareTypes.get(type) || 0) + 1);
      });

      // Convert to arrays and sort
      analytics.popularDestinations = Array.from(destinations.entries())
        .map(([location, count]) => ({ location, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      analytics.shareTypeBreakdown = Array.from(shareTypes.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);

      return analytics;
    } catch (error) {
      console.error('Error getting user sharing analytics:', error);
      throw error;
    }
  }

  // Get all ride shares (for admin)
  async getAllRideShares(callback: (shares: RideShareData[]) => void) {
    const q = query(
      collection(db, 'rideShares'),
      orderBy('createdAt', 'desc'),
      limit(100) // Limit to last 100 shares
    );

    return onSnapshot(q, (snapshot) => {
      const shares: RideShareData[] = [];
      snapshot.forEach((doc) => {
        shares.push({
          id: doc.id,
          ...doc.data()
        } as RideShareData);
      });
      
      callback(shares);
    });
  }

  // Cleanup expired shares
  async cleanupExpiredShares(): Promise<void> {
    try {
      const now = new Date();
      const q = query(
        collection(db, 'rideShares'),
        where('shareContent.expiresAt', '<', now),
        where('status', '==', 'active')
      );

      const snapshot = await getDocs(q);
      const batch = writeBatch(db);

      snapshot.forEach((doc) => {
        batch.update(doc.ref, { 
          status: 'expired',
          updatedAt: now,
        });
        
        // Remove from active shares
        this.activeShares.delete(doc.id);
      });

      await batch.commit();
      console.log(`Cleaned up ${snapshot.size} expired shares`);
    } catch (error) {
      console.error('Error cleaning up expired shares:', error);
    }
  }

  // Get active shares
  getActiveShares(): RideShareData[] {
    return Array.from(this.activeShares.values());
  }

  // Check if share exists for ride
  hasActiveShareForRide(rideId: string): boolean {
    return Array.from(this.activeShares.values()).some(
      share => share.rideId === rideId && share.status === 'active'
    );
  }

  // Cleanup method
  cleanup() {
    if (this.shareListener) {
      this.shareListener();
    }
    this.activeShares.clear();
  }
}

// Helper function for Firestore increment
function increment(value: number) {
  return value;
}

// Export singleton instance
export const sharingService = new SharingService();
export default sharingService;
