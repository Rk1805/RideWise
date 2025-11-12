import { realtimeDb } from './firebase';
import { ref, set, get, onValue, off, update, push } from 'firebase/database';
import { auth } from './firebase';
import { expoNotificationService } from './fcmService';

export interface RideShareLink {
  shareId: string;
  rideId: string;
  driverId: string;
  passengerId: string;
  driverName: string;
  driverPhone: string;
  cabNumber: string;
  from: string;
  to: string;
  status: 'accepted' | 'started' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: number;
  expiresAt: number;
  shareCode: string;
  shareUrl: string;
  currentLocation?: {
    latitude: number;
    longitude: number;
    timestamp: number;
  };
  estimatedArrival?: number;
  distanceRemaining?: number;
  timeRemaining?: number;
}

export interface RideShareViewer {
  viewerId: string;
  viewerName: string;
  viewerPhone?: string;
  relationship: string; // 'family', 'friend', 'colleague', 'other'
  accessGranted: number;
  lastViewed: number;
  notificationsEnabled: boolean;
}

export interface RideShareUpdate {
  type: 'status_change' | 'location_update' | 'eta_update' | 'completion';
  timestamp: number;
  data: any;
}

class RideSharingService {
  private activeShares: Map<string, RideShareLink> = new Map();
  private shareListeners: Map<string, () => void> = new Map();

  constructor() {
    this.initializeService();
  }

  // Initialize the service
  private async initializeService() {
    if (auth.currentUser) {
      await this.loadActiveShares();
    }
  }

  // Load active ride shares
  private async loadActiveShares() {
    if (!auth.currentUser) return;

    try {
      const sharesRef = ref(realtimeDb, `rideShares/${auth.currentUser.uid}`);
      const snapshot = await get(sharesRef);
      
      if (snapshot.exists()) {
        this.activeShares.clear();
        snapshot.forEach((childSnapshot) => {
          const shareData = childSnapshot.val();
          if (shareData.expiresAt > Date.now()) {
            this.activeShares.set(childSnapshot.key!, shareData);
          }
        });
      }
    } catch (error) {
      console.error('Error loading active shares:', error);
    }
  }

  // Generate unique share code
  private generateShareCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Create ride share when driver accepts ride
  async createRideShare(
    rideId: string,
    rideData: {
      driverId: string;
      passengerId: string;
      driverName: string;
      driverPhone: string;
      cabNumber: string;
      from: string;
      to: string;
    }
  ): Promise<RideShareLink> {
    if (!auth.currentUser) throw new Error('User not authenticated');

    try {
      const shareId = `${rideId}_${Date.now()}`;
      const shareCode = this.generateShareCode();
      const shareUrl = `ridewise://share/${shareCode}`;
      
      // Set expiration to 48 hours from now
      const expiresAt = Date.now() + (48 * 60 * 60 * 1000);

      const shareData: RideShareLink = {
        shareId,
        rideId,
        driverId: rideData.driverId,
        passengerId: rideData.passengerId,
        driverName: rideData.driverName,
        driverPhone: rideData.driverPhone,
        cabNumber: rideData.cabNumber,
        from: rideData.from,
        to: rideData.to,
        status: 'accepted',
        createdAt: Date.now(),
        expiresAt,
        shareCode,
        shareUrl,
      };

      // Save to real-time database
      const shareRef = ref(realtimeDb, `rideShares/${rideData.driverId}/${shareId}`);
      await set(shareRef, shareData);

      // Also save to passenger's received shares
      const passengerShareRef = ref(realtimeDb, `receivedRideShares/${rideData.passengerId}/${shareId}`);
      await set(passengerShareRef, shareData);

      // Create public share link accessible by code
      const publicShareRef = ref(realtimeDb, `publicRideShares/${shareCode}`);
      await set(publicShareRef, {
        ...shareData,
        isPublic: true,
        accessCount: 0,
      });

      // Add to local cache
      this.activeShares.set(shareId, shareData);

      // Subscribe to ride updates
      this.subscribeToRideUpdates(rideId, shareId);

      console.log('🚗 Ride share created:', shareId, 'Code:', shareCode);
      return shareData;
    } catch (error) {
      console.error('Error creating ride share:', error);
      throw error;
    }
  }

  // Subscribe to ride updates for real-time sharing
  private subscribeToRideUpdates(rideId: string, shareId: string) {
    const rideRef = ref(realtimeDb, `rideRequests/${rideId}`);
    
    const unsubscribe = onValue(rideRef, (snapshot) => {
      if (snapshot.exists()) {
        const rideData = snapshot.val();
        this.handleRideUpdate(shareId, rideData);
      }
    });

    this.shareListeners.set(shareId, unsubscribe);
  }

  // Handle ride updates and update share data
  private async handleRideUpdate(shareId: string, rideData: any) {
    try {
      const share = this.activeShares.get(shareId);
      if (!share) return;

      const updates: Partial<RideShareLink> = {
        status: rideData.status,
      };

      // Update location if available
      if (rideData.driverLocation) {
        updates.currentLocation = rideData.driverLocation;
      }

      // Update ETA if available
      if (rideData.estimatedArrival) {
        updates.estimatedArrival = rideData.estimatedArrival;
      }

      // Update distance remaining if available
      if (rideData.distanceRemaining) {
        updates.distanceRemaining = rideData.distanceRemaining;
      }

      // Update time remaining if available
      if (rideData.timeRemaining) {
        updates.timeRemaining = rideData.timeRemaining;
      }

      // Update share data
      await this.updateRideShare(shareId, updates);

      // Send notifications to viewers if status changed
      if (updates.status && updates.status !== share.status) {
        await this.notifyRideShareViewers(shareId, updates.status);
      }

      console.log(`Ride share updated: ${shareId}, Status: ${updates.status}`);
    } catch (error) {
      console.error('Error handling ride update:', error);
    }
  }

  // Update ride share data
  private async updateRideShare(shareId: string, updates: Partial<RideShareLink>): Promise<void> {
    try {
      const share = this.activeShares.get(shareId);
      if (!share) return;

      // Update local cache
      const updatedShare = { ...share, ...updates };
      this.activeShares.set(shareId, updatedShare);

      // Update in database
      const shareRef = ref(realtimeDb, `rideShares/${share.driverId}/${shareId}`);
      await update(shareRef, updates);

      // Update public share
      const publicShareRef = ref(realtimeDb, `publicRideShares/${share.shareCode}`);
      await update(publicShareRef, updates);

      // Update passenger's received share
      const passengerShareRef = ref(realtimeDb, `receivedRideShares/${share.passengerId}/${shareId}`);
      await update(passengerShareRef, updates);
    } catch (error) {
      console.error('Error updating ride share:', error);
    }
  }

  // Get ride share by code (for public access)
  async getRideShareByCode(shareCode: string): Promise<RideShareLink | null> {
    try {
      const publicShareRef = ref(realtimeDb, `publicRideShares/${shareCode}`);
      const snapshot = await get(publicShareRef);
      
      if (snapshot.exists()) {
        const shareData = snapshot.val();
        
        // Check if share is still valid
        if (shareData.expiresAt > Date.now()) {
          // Increment access count
          await update(publicShareRef, {
            accessCount: (shareData.accessCount || 0) + 1,
            lastAccessed: Date.now(),
          });
          
          return shareData;
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting ride share by code:', error);
      return null;
    }
  }

  // Add viewer to ride share
  async addRideShareViewer(
    shareCode: string,
    viewerData: {
      viewerName: string;
      viewerPhone?: string;
      relationship: string;
    }
  ): Promise<boolean> {
    try {
      const share = await this.getRideShareByCode(shareCode);
      if (!share) return false;

      const viewerId = `viewer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const viewer: RideShareViewer = {
        viewerId,
        viewerName: viewerData.viewerName,
        viewerPhone: viewerData.viewerPhone,
        relationship: viewerData.relationship,
        accessGranted: Date.now(),
        lastViewed: Date.now(),
        notificationsEnabled: true,
      };

      // Add viewer to share
      const viewerRef = ref(realtimeDb, `rideShares/${share.driverId}/${share.shareId}/viewers/${viewerId}`);
      await set(viewerRef, viewer);

      // Also add to public share viewers
      const publicViewerRef = ref(realtimeDb, `publicRideShares/${shareCode}/viewers/${viewerId}`);
      await set(publicViewerRef, viewer);

      console.log('Viewer added to ride share:', viewerId);
      return true;
    } catch (error) {
      console.error('Error adding viewer:', error);
      return false;
    }
  }

  // Notify ride share viewers
  private async notifyRideShareViewers(shareId: string, status: string): Promise<void> {
    try {
      const share = this.activeShares.get(shareId);
      if (!share) return;

      const viewersRef = ref(realtimeDb, `rideShares/${share.driverId}/${shareId}/viewers`);
      const snapshot = await get(viewersRef);
      
      if (snapshot.exists()) {
        const viewers = snapshot.val();
        
        Object.values(viewers).forEach(async (viewer: any) => {
          if (viewer.notificationsEnabled) {
            // Send notification to viewer (if they have the app)
            // For now, we'll just log it
            console.log(`Notification sent to viewer: ${viewer.viewerName} - Ride ${status}`);
          }
        });
      }
    } catch (error) {
      console.error('Error notifying viewers:', error);
    }
  }

  // Get active ride shares for a user
  getActiveRideShares(): RideShareLink[] {
    const now = Date.now();
    return Array.from(this.activeShares.values()).filter(share => share.expiresAt > now);
  }

  // Get ride sharing history
  async getRideSharingHistory(limit: number = 50): Promise<RideShareLink[]> {
    if (!auth.currentUser) return [];

    try {
      const sharesRef = ref(realtimeDb, `rideShares/${auth.currentUser.uid}`);
      const snapshot = await get(sharesRef);
      
      if (snapshot.exists()) {
        const shares: RideShareLink[] = [];
        snapshot.forEach((childSnapshot) => {
          shares.push(childSnapshot.val());
        });

        // Sort by creation time (newest first) and limit results
        return shares
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, limit);
      }
    } catch (error) {
      console.error('Error getting ride sharing history:', error);
    }

    return [];
  }

  // Expire a ride share
  async expireRideShare(shareId: string): Promise<void> {
    if (!auth.currentUser) return;

    try {
      const share = this.activeShares.get(shareId);
      if (!share) return;

      // Update expiration time to now
      const shareRef = ref(realtimeDb, `rideShares/${auth.currentUser.uid}/${shareId}`);
      await update(shareRef, { expiresAt: Date.now() });

      // Remove from local cache
      this.activeShares.delete(shareId);

      console.log('Ride share expired:', shareId);
    } catch (error) {
      console.error('Error expiring ride share:', error);
    }
  }

  // Cleanup method
  cleanup() {
    // Unsubscribe from all listeners
    this.shareListeners.forEach(unsubscribe => unsubscribe());
    this.shareListeners.clear();
    this.activeShares.clear();
  }
}

// Export singleton instance
export const rideSharingService = new RideSharingService();
export default rideSharingService;
