import { realtimeDb } from './firebase';
import { ref, set, get, onValue, off } from 'firebase/database';
import { expoNotificationService } from './fcmService';
import { auth } from './firebase';

export interface RideNotificationData {
  rideId: string;
  travelerId: string;
  companionId: string;
  driverName: string;
  driverPhone: string;
  cabNumber: string;
  from: string;
  to: string;
  status: 'started' | 'in_progress' | 'completed' | 'cancelled';
  timestamp: number;
  estimatedArrival?: number;
  currentLocation?: {
    latitude: number;
    longitude: number;
    timestamp: number;
  };
}

export interface CompanionRideShare {
  rideId: string;
  travelerId: string;
  companionId: string;
  shareLink: string;
  expiresAt: number;
  rideDetails: RideNotificationData;
  createdAt: number;
}

class RideNotificationService {
  private activeShares: Map<string, CompanionRideShare> = new Map();
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

  // Share ride with companion
  async shareRideWithCompanion(
    rideId: string,
    companionId: string,
    rideDetails: Omit<RideNotificationData, 'rideId' | 'companionId' | 'timestamp'>
  ): Promise<string> {
    if (!auth.currentUser) throw new Error('User not authenticated');

    try {
      const shareId = `${rideId}_${Date.now()}`;
      const shareLink = `ridewise://track/${rideId}/${companionId}`;
      
      // Set expiration to 24 hours from now
      const expiresAt = Date.now() + (24 * 60 * 60 * 1000);

      const shareData: CompanionRideShare = {
        rideId,
        travelerId: auth.currentUser.uid,
        companionId,
        shareLink,
        expiresAt,
        rideDetails: {
          ...rideDetails,
          rideId,
          companionId,
          timestamp: Date.now(),
        },
        createdAt: Date.now(),
      };

      // Save to real-time database
      const shareRef = ref(realtimeDb, `rideShares/${auth.currentUser.uid}/${shareId}`);
      await set(shareRef, shareData);

      // Also save to companion's received shares
      const companionShareRef = ref(realtimeDb, `receivedRideShares/${companionId}/${shareId}`);
      await set(companionShareRef, shareData);

      // Add to local cache
      this.activeShares.set(shareId, shareData);

      // Subscribe to ride updates
      this.subscribeToRideUpdates(rideId, companionId);

      console.log('Ride shared with companion:', shareId);
      return shareId;
    } catch (error) {
      console.error('Error sharing ride:', error);
      throw error;
    }
  }

  // Subscribe to ride updates for notifications
  private subscribeToRideUpdates(rideId: string, companionId: string) {
    const rideRef = ref(realtimeDb, `rideRequests/${rideId}`);
    
    const unsubscribe = onValue(rideRef, (snapshot) => {
      if (snapshot.exists()) {
        const rideData = snapshot.val();
        this.handleRideStatusUpdate(rideId, companionId, rideData);
      }
    });

    this.shareListeners.set(rideId, unsubscribe);
  }

  // Handle ride status updates and send notifications
  private async handleRideStatusUpdate(rideId: string, companionId: string, rideData: any) {
    try {
      const status = rideData.status;
      const currentLocation = rideData.currentLocation;
      const estimatedArrival = rideData.estimatedArrival;

      let notificationTitle = '';
      let notificationBody = '';
      let notificationType: 'ride_started' | 'ride_in_progress' | 'ride_completed' | 'ride_cancelled';

      switch (status) {
        case 'started':
          notificationTitle = '🚗 Ride Started!';
          notificationBody = `Your companion's ride has begun. Driver: ${rideData.driverName}`;
          notificationType = 'ride_started';
          break;
        case 'in_progress':
          notificationTitle = '📍 Ride in Progress';
          notificationBody = `Your companion is on the way to destination.`;
          notificationType = 'ride_in_progress';
          break;
        case 'completed':
          notificationTitle = '✅ Ride Completed!';
          notificationBody = `Your companion has reached their destination safely.`;
          notificationType = 'ride_completed';
          break;
        case 'cancelled':
          notificationTitle = '❌ Ride Cancelled';
          notificationBody = `Your companion's ride has been cancelled.`;
          notificationType = 'ride_cancelled';
          break;
        default:
          return; // No notification for other statuses
      }

      // Send notification to companion
      await expoNotificationService.sendCompanionNotification(companionId, {
        type: notificationType,
        rideId,
        companionId,
        travelerId: auth.currentUser!.uid,
        title: notificationTitle,
        body: notificationBody,
        data: {
          rideId,
          status,
          driverName: rideData.driverName,
          driverPhone: rideData.driverPhone,
          cabNumber: rideData.cabNumber,
          from: rideData.from,
          to: rideData.to,
          currentLocation,
          estimatedArrival,
        },
      });

      // Update ride tracking data
      await this.updateRideTracking(rideId, companionId, {
        status,
        currentLocation,
        estimatedArrival,
        lastUpdate: Date.now(),
      });

      console.log(`Notification sent for ride ${rideId}: ${status}`);
    } catch (error) {
      console.error('Error handling ride status update:', error);
    }
  }

  // Update ride tracking data
  private async updateRideTracking(
    rideId: string, 
    companionId: string, 
    updateData: any
  ): Promise<void> {
    try {
      const trackingRef = ref(realtimeDb, `companionRideTracking/${companionId}/${rideId}`);
      await set(trackingRef, updateData);
    } catch (error) {
      console.error('Error updating ride tracking:', error);
    }
  }

  // Get active ride shares for a user
  getActiveRideShares(): CompanionRideShare[] {
    const now = Date.now();
    return Array.from(this.activeShares.values()).filter(share => share.expiresAt > now);
  }

  // Get received ride shares for a companion
  async getReceivedRideShares(companionId: string): Promise<CompanionRideShare[]> {
    try {
      const sharesRef = ref(realtimeDb, `receivedRideShares/${companionId}`);
      const snapshot = await get(sharesRef);
      
      if (snapshot.exists()) {
        const shares: CompanionRideShare[] = [];
        const now = Date.now();
        
        snapshot.forEach((childSnapshot) => {
          const shareData = childSnapshot.val();
          if (shareData.expiresAt > now) {
            shares.push(shareData);
          }
        });

        return shares.sort((a, b) => b.createdAt - a.createdAt);
      }
    } catch (error) {
      console.error('Error getting received ride shares:', error);
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
      await set(shareRef, { ...share, expiresAt: Date.now() });

      // Remove from local cache
      this.activeShares.delete(shareId);

      console.log('Ride share expired:', shareId);
    } catch (error) {
      console.error('Error expiring ride share:', error);
    }
  }

  // Clean up expired shares
  async cleanupExpiredShares(): Promise<void> {
    const now = Date.now();
    const expiredShares = Array.from(this.activeShares.entries())
      .filter(([_, share]) => share.expiresAt <= now);

    for (const [shareId, _] of expiredShares) {
      await this.expireRideShare(shareId);
    }
  }

  // Get ride sharing history
  async getRideSharingHistory(limit: number = 50): Promise<CompanionRideShare[]> {
    if (!auth.currentUser) return [];

    try {
      const sharesRef = ref(realtimeDb, `rideShares/${auth.currentUser.uid}`);
      const snapshot = await get(sharesRef);
      
      if (snapshot.exists()) {
        const shares: CompanionRideShare[] = [];
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

  // Cleanup method
  cleanup() {
    // Unsubscribe from all listeners
    this.shareListeners.forEach(unsubscribe => unsubscribe());
    this.shareListeners.clear();
    this.activeShares.clear();
  }
}

// Export singleton instance
export const rideNotificationService = new RideNotificationService();
export default rideNotificationService;
