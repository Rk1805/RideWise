import { realtimeDb } from './firebase';
import { ref, set, get, onValue, off, update, push, remove } from 'firebase/database';
import { expoNotificationService } from './fcmService';
import { auth } from './firebase';

export interface CompanionRideTracking {
  id: string;
  companionId: string;
  travelerId: string;
  rideId: string;
  status: 'tracking' | 'in_progress' | 'completed' | 'cancelled';
  startTime: number;
  endTime?: number;
  startLocation?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  currentLocation?: {
    latitude: number;
    longitude: number;
    timestamp: number;
    accuracy?: number;
  };
  destination: {
    latitude: number;
    longitude: number;
    address: string;
  };
  estimatedArrival?: number;
  lastUpdate: number;
  notifications: {
    rideStarted: boolean;
    rideInProgress: boolean;
    rideCompleted: boolean;
    rideCancelled: boolean;
  };
}

export interface RideStatusUpdate {
  rideId: string;
  status: 'requested' | 'accepted' | 'started' | 'in_progress' | 'completed' | 'cancelled';
  driverId?: string;
  driverLocation?: {
    latitude: number;
    longitude: number;
    timestamp: number;
  };
  estimatedArrival?: number;
  timestamp: number;
}

class CompanionTrackingService {
  private activeTracking: Map<string, CompanionRideTracking> = new Map();
  private statusListeners: Map<string, () => void> = new Map();
  private trackingListeners: Map<string, () => void> = new Map();

  constructor() {
    this.initializeService();
  }

  // Initialize the service
  private async initializeService() {
    if (auth.currentUser) {
      console.log(`🔍 Initializing companion tracking service for user: ${auth.currentUser.uid}`);
      await this.loadActiveTracking();
      console.log('✅ Companion tracking service initialized');
    } else {
      console.log('⚠️ No authenticated user found for companion tracking service');
    }
  }

  // Public method to initialize service when user is authenticated
  async initializeForUser() {
    if (auth.currentUser) {
      await this.loadActiveTracking();
    }
  }

  // Load active tracking sessions
  private async loadActiveTracking() {
    if (!auth.currentUser) return;

    try {
      const trackingRef = ref(realtimeDb, `companionRideTracking/${auth.currentUser.uid}`);
      const snapshot = await get(trackingRef);
      
      if (snapshot.exists()) {
        this.activeTracking.clear();
        snapshot.forEach((childSnapshot) => {
          const trackingData = childSnapshot.val();
          if (trackingData.status === 'tracking' || trackingData.status === 'in_progress') {
            this.activeTracking.set(childSnapshot.key!, trackingData);
          }
        });
      }
    } catch (error) {
      console.error('Error loading active tracking:', error);
    }
  }

  // Start tracking a traveler's ride
  async startTrackingTraveler(
    travelerId: string, 
    rideId: string, 
    destination: { latitude: number; longitude: number; address: string }
  ): Promise<string> {
    if (!auth.currentUser) throw new Error('User not authenticated');

    try {
      const trackingId = `${rideId}_${Date.now()}`;
      const trackingData: CompanionRideTracking = {
        id: trackingId,
        companionId: auth.currentUser.uid,
        travelerId,
        rideId,
        status: 'tracking',
        startTime: Date.now(),
        destination,
        lastUpdate: Date.now(),
        notifications: {
          rideStarted: false,
          rideInProgress: false,
          rideCompleted: false,
          rideCancelled: false,
        },
      };

      // Save to real-time database
      const trackingRef = ref(realtimeDb, `companionRideTracking/${auth.currentUser.uid}/${rideId}`);
      await set(trackingRef, trackingData);

      // Add to local cache
      this.activeTracking.set(rideId, trackingData);

      // Subscribe to ride status updates
      this.subscribeToRideStatus(rideId, travelerId);

      console.log('Started tracking traveler:', trackingId);
      return trackingId;
    } catch (error) {
      console.error('Error starting tracking:', error);
      throw error;
    }
  }

  // Subscribe to ride status updates
  private subscribeToRideStatus(rideId: string, travelerId: string) {
    const rideRef = ref(realtimeDb, `rideRequests/${rideId}`);
    
    const unsubscribe = onValue(rideRef, (snapshot) => {
      if (snapshot.exists()) {
        const rideData = snapshot.val();
        this.handleRideStatusUpdate(rideId, rideData);
      }
    });

    this.statusListeners.set(rideId, unsubscribe);
  }

  // Handle ride status updates
  private async handleRideStatusUpdate(rideId: string, rideData: any) {
    try {
      const tracking = this.activeTracking.get(rideId);
      if (!tracking) return;

      const status = rideData.status;
      const driverLocation = rideData.driverLocation;
      const estimatedArrival = rideData.estimatedArrival;

      // Update tracking status
      let newStatus = tracking.status;
      let shouldNotify = false;

      if ((status === 'accepted' || status === 'active') && tracking.status === 'tracking') {
        newStatus = 'tracking';
        if (!tracking.notifications.rideStarted) {
          shouldNotify = true;
          tracking.notifications.rideStarted = true;
        }
      } else if (status === 'started' && tracking.status === 'tracking') {
        newStatus = 'in_progress';
        if (!tracking.notifications.rideInProgress) {
          shouldNotify = true;
          tracking.notifications.rideInProgress = true;
        }
      } else if (status === 'completed' && tracking.status !== 'completed') {
        newStatus = 'completed';
        if (!tracking.notifications.rideCompleted) {
          shouldNotify = true;
          tracking.notifications.rideCompleted = true;
        }
      } else if (status === 'cancelled' && tracking.status !== 'cancelled') {
        newStatus = 'cancelled';
        if (!tracking.notifications.rideCancelled) {
          shouldNotify = true;
          tracking.notifications.rideCancelled = true;
        }
      }

      // Update tracking data
      const updatedTracking: Partial<CompanionRideTracking> = {
        status: newStatus,
        lastUpdate: Date.now(),
        notifications: tracking.notifications,
      };

      if (driverLocation) {
        updatedTracking.currentLocation = {
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
          timestamp: Date.now(),
          accuracy: driverLocation.accuracy,
        };
      }

      if (estimatedArrival) {
        updatedTracking.estimatedArrival = estimatedArrival;
      }

      if (newStatus === 'completed' || newStatus === 'cancelled') {
        updatedTracking.endTime = Date.now();
      }

      // Update database
      const trackingRef = ref(realtimeDb, `companionRideTracking/${auth.currentUser!.uid}/${rideId}`);
      await update(trackingRef, updatedTracking);

      // Update local cache
      Object.assign(tracking, updatedTracking);

      // Send notification if needed
      if (shouldNotify) {
        await this.sendStatusNotification(rideId, newStatus, rideData);
      }

    } catch (error) {
      console.error('Error handling ride status update:', error);
    }
  }

  // Send status notification to companion
  private async sendStatusNotification(rideId: string, status: string, rideData: any) {
    if (!auth.currentUser) return;

    try {
      const tracking = this.activeTracking.get(rideId);
      if (!tracking) return;

      let title = '';
      let body = '';

      switch (status) {
        case 'tracking':
          title = '🚗 Driver Found!';
          body = 'A driver has accepted your companion\'s ride request.';
          break;
        case 'in_progress':
          title = '🚀 Ride Started!';
          body = 'Your companion\'s ride has begun.';
          break;
        case 'completed':
          title = '✅ Ride Completed!';
          body = 'Your companion has reached their destination safely.';
          break;
        case 'cancelled':
          title = '❌ Ride Cancelled';
          body = 'Your companion\'s ride has been cancelled.';
          break;
      }

      // Send via Expo notification service
      await expoNotificationService.sendCompanionNotification(auth.currentUser.uid, {
        type: status === 'tracking' ? 'ride_started' : 
              status === 'in_progress' ? 'ride_in_progress' :
              status === 'completed' ? 'ride_completed' : 'ride_cancelled',
        rideId,
        companionId: auth.currentUser.uid,
        travelerId: tracking.travelerId,
        title,
        body,
        data: {
          rideId,
          status,
          destination: tracking.destination,
        },
      });

    } catch (error) {
      console.error('Error sending status notification:', error);
    }
  }

  // Subscribe to tracking updates for a specific ride
  subscribeToTrackingUpdates(rideId: string, callback: (trackingData: CompanionRideTracking | null) => void) {
    if (!auth.currentUser) return null;

    console.log(`🔍 Subscribing to real-time updates for ride: ${rideId}`);
    
    // Listen to both companion tracking data AND ride requests for real-time updates
    const trackingRef = ref(realtimeDb, `companionRideTracking/${auth.currentUser.uid}/${rideId}`);
    const rideRequestRef = ref(realtimeDb, `rideRequests/${rideId}`);
    
    // Subscribe to companion tracking updates
    const trackingUnsubscribe = onValue(trackingRef, (snapshot) => {
      if (snapshot.exists()) {
        const trackingData = snapshot.val();
        console.log(`📡 Companion tracking update received for ride ${rideId}:`, trackingData);
        callback(trackingData);
      } else {
        console.log(`📡 No companion tracking data found for ride ${rideId}`);
        callback(null);
      }
    });

    // Subscribe to ride request updates (for driver location, status changes)
    const rideUnsubscribe = onValue(rideRequestRef, (snapshot) => {
      if (snapshot.exists()) {
        const rideData = snapshot.val();
        console.log(`🚗 Ride request update received for ride ${rideId}:`, rideData);
        
        // Update companion tracking with new ride data
        this.updateCompanionTrackingFromRideUpdate(rideId, rideData);
        
        // Also call the callback with updated data
        const currentTracking = this.activeTracking.get(rideId);
        if (currentTracking) {
          callback(currentTracking);
        }
      }
    });

    // Store both unsubscribe functions
    this.trackingListeners.set(rideId, () => {
      console.log(`🔌 Unsubscribing from tracking updates for ride: ${rideId}`);
      trackingUnsubscribe();
      rideUnsubscribe();
    });

    return () => {
      console.log(`🔌 Manual unsubscribe called for ride: ${rideId}`);
      trackingUnsubscribe();
      rideUnsubscribe();
      this.trackingListeners.delete(rideId);
    };
  }

  // Update companion tracking when ride data changes
  private async updateCompanionTrackingFromRideUpdate(rideId: string, rideData: any) {
    if (!auth.currentUser) return;

    try {
      const tracking = this.activeTracking.get(rideId);
      if (!tracking) return;

      console.log(`🔄 Updating companion tracking from ride update for ride ${rideId}`);

      // Update tracking with new ride data
      const updates: Partial<CompanionRideTracking> = {
        lastUpdate: Date.now(),
      };

      // Update driver location if available
      if (rideData.driverLocation) {
        updates.currentLocation = {
          latitude: rideData.driverLocation.latitude,
          longitude: rideData.driverLocation.longitude,
          timestamp: Date.now(),
          accuracy: rideData.driverLocation.accuracy,
        };
        console.log(`📍 Driver location updated for ride ${rideId}:`, rideData.driverLocation);
      }

      // Update estimated arrival if available
      if (rideData.estimatedArrival) {
        updates.estimatedArrival = rideData.estimatedArrival;
        console.log(`⏰ ETA updated for ride ${rideId}:`, rideData.estimatedArrival);
      }

      // Update status if it changed
      if (rideData.status && rideData.status !== tracking.status) {
        updates.status = this.mapRideStatusToTrackingStatus(rideData.status);
        console.log(`🔄 Status updated for ride ${rideId}: ${tracking.status} → ${updates.status}`);
      }

      // Update local cache
      Object.assign(tracking, updates);

      // Update real-time database
      const trackingRef = ref(realtimeDb, `companionRideTracking/${auth.currentUser.uid}/${rideId}`);
      await update(trackingRef, updates);

      console.log(`✅ Companion tracking updated for ride ${rideId}`);
    } catch (error) {
      console.error(`❌ Error updating companion tracking for ride ${rideId}:`, error);
    }
  }

  // Map ride status to tracking status
  private mapRideStatusToTrackingStatus(rideStatus: string): 'tracking' | 'in_progress' | 'completed' | 'cancelled' {
    switch (rideStatus) {
      case 'requested':
      case 'accepted':
      case 'active':
        return 'tracking';
      case 'started':
      case 'in_progress':
        return 'in_progress';
      case 'completed':
        return 'completed';
      case 'cancelled':
        return 'cancelled';
      default:
        return 'tracking';
    }
  }

  // Get current tracking data for a ride
  async getTrackingData(rideId: string): Promise<CompanionRideTracking | null> {
    // First check local cache
    let trackingData = this.activeTracking.get(rideId);
    
    if (!trackingData && auth.currentUser) {
      // If not in local cache, try to load from Realtime Database
      try {
        console.log(`🔍 Loading tracking data from Realtime Database for ride ${rideId}`);
        const trackingRef = ref(realtimeDb, `companionRideTracking/${auth.currentUser.uid}/${rideId}`);
        const snapshot = await get(trackingRef);
        
        if (snapshot.exists()) {
          trackingData = snapshot.val() as CompanionRideTracking;
          // Add to local cache
          this.activeTracking.set(rideId, trackingData);
          console.log(`✅ Loaded tracking data from Realtime Database for ride ${rideId}`);
        } else {
          console.log(`❌ No tracking data found in Realtime Database for ride ${rideId}`);
          
          // Try to sync from companion service as a fallback
          await this.syncTrackingDataFromCompanionService();
          trackingData = this.activeTracking.get(rideId);
        }
      } catch (error) {
        console.error(`❌ Error loading tracking data from Realtime Database for ride ${rideId}:`, error);
      }
    }
    
    return trackingData || null;
  }

  // Sync tracking data from companion service
  async syncTrackingDataFromCompanionService(): Promise<void> {
    if (!auth.currentUser) return;

    try {
      console.log('🔄 Syncing tracking data from companion service...');
      const { companionService } = require('./companionService'); // Dynamic import
      const companionTrackingData = companionService.getActiveTracking(); // Get from companionService's cache
      
      for (const trackingData of companionTrackingData) {
        const existingData = this.activeTracking.get(trackingData.rideId);
        if (!existingData) {
          const convertedData: CompanionRideTracking = {
            id: trackingData.id,
            companionId: trackingData.companionId,
            travelerId: trackingData.travelerId,
            rideId: trackingData.rideId,
            status: trackingData.status === 'tracking' ? 'tracking' : 'in_progress',
            startTime: trackingData.startTime.getTime(),
            destination: trackingData.destination,
            lastUpdate: trackingData.lastUpdate.getTime(),
            notifications: {
              rideStarted: false,
              rideInProgress: false,
              rideCompleted: false,
              rideCancelled: false,
            },
          };

          this.activeTracking.set(trackingData.rideId, convertedData);
          const trackingRef = ref(realtimeDb, `companionRideTracking/${auth.currentUser.uid}/${trackingData.rideId}`);
          await set(trackingRef, convertedData);
          console.log(`✅ Synced tracking data for ride ${trackingData.rideId}`);
        }
      }
      console.log('✅ Tracking data sync completed');
    } catch (error) {
      console.error('❌ Error syncing tracking data from companion service:', error);
    }
  }

  // Add tracking data to cache (public method)
  async addTrackingDataToCache(rideId: string, trackingData: CompanionRideTracking) {
    if (!auth.currentUser) return;

    try {
      // Check if data already exists
      const existingData = this.activeTracking.get(rideId);
      if (existingData) {
        console.log(`Data for ride ${rideId} already exists in cache. Skipping add.`);
        return;
      }

      // Add to local cache
      this.activeTracking.set(rideId, trackingData);

      // Store in Realtime Database
      const trackingRef = ref(realtimeDb, `companionRideTracking/${auth.currentUser.uid}/${rideId}`);
      await set(trackingRef, trackingData);

      console.log(`✅ Added tracking data for ride ${rideId} to cache.`);
    } catch (error) {
      console.error(`❌ Error adding tracking data for ride ${rideId} to cache:`, error);
    }
  }

  // Get all active tracking sessions
  getActiveTracking(): CompanionRideTracking[] {
    if (!auth.currentUser) {
      console.warn('User not authenticated, returning empty tracking array');
      return [];
    }
    return Array.from(this.activeTracking.values()).filter(
      t => t.status === 'tracking' || t.status === 'in_progress'
    );
  }

  // Stop tracking a ride
  async stopTracking(rideId: string, reason: 'completed' | 'cancelled'): Promise<void> {
    if (!auth.currentUser) return;

    try {
      const tracking = this.activeTracking.get(rideId);
      if (!tracking) return;

      // Update status
      const updatedTracking: Partial<CompanionRideTracking> = {
        status: reason,
        endTime: Date.now(),
        lastUpdate: Date.now(),
      };

      // Update database
      const trackingRef = ref(realtimeDb, `companionRideTracking/${auth.currentUser.uid}/${rideId}`);
      await update(trackingRef, updatedTracking);

      // Update local cache
      Object.assign(tracking, updatedTracking);

      // Remove from active tracking if completed or cancelled
      if (reason === 'completed' || reason === 'cancelled') {
        this.activeTracking.delete(rideId);
      }

      // Unsubscribe from status updates
      const statusUnsubscribe = this.statusListeners.get(rideId);
      if (statusUnsubscribe) {
        statusUnsubscribe();
        this.statusListeners.delete(rideId);
      }

      console.log('Stopped tracking ride:', rideId, reason);
    } catch (error) {
      console.error('Error stopping tracking:', error);
      throw error;
    }
  }

  // Update tracking location manually (for testing or manual updates)
  async updateTrackingLocation(rideId: string, location: { latitude: number; longitude: number; accuracy?: number }): Promise<void> {
    if (!auth.currentUser) return;

    try {
      const trackingRef = ref(realtimeDb, `companionRideTracking/${auth.currentUser.uid}/${rideId}/currentLocation`);
      await set(trackingRef, {
        ...location,
        timestamp: Date.now(),
      });

      // Update local cache
      const tracking = this.activeTracking.get(rideId);
      if (tracking) {
        tracking.currentLocation = {
          ...location,
          timestamp: Date.now(),
        };
        tracking.lastUpdate = Date.now();
      }

      console.log('Updated tracking location for ride:', rideId);
    } catch (error) {
      console.error('Error updating tracking location:', error);
      throw error;
    }
  }

  // Get tracking history
  async getTrackingHistory(limit: number = 50): Promise<CompanionRideTracking[]> {
    if (!auth.currentUser) return [];

    try {
      const historyRef = ref(realtimeDb, `companionRideTracking/${auth.currentUser.uid}`);
      const snapshot = await get(historyRef);
      
      if (snapshot.exists()) {
        const history: CompanionRideTracking[] = [];
        snapshot.forEach((childSnapshot) => {
          const trackingData = childSnapshot.val();
          if (trackingData.status === 'completed' || trackingData.status === 'cancelled') {
            history.push(trackingData);
          }
        });

        // Sort by end time (newest first) and limit results
        return history
          .sort((a, b) => (b.endTime || 0) - (a.endTime || 0))
          .slice(0, limit);
      }
    } catch (error) {
      console.error('Error getting tracking history:', error);
    }

    return [];
  }

  // Cleanup method
  cleanup() {
    // Unsubscribe from all listeners
    this.statusListeners.forEach(unsubscribe => unsubscribe());
    this.statusListeners.clear();

    this.trackingListeners.forEach(unsubscribe => unsubscribe());
    this.trackingListeners.clear();

    this.activeTracking.clear();
  }
}

// Export singleton instance
export const companionTrackingService = new CompanionTrackingService();
export default companionTrackingService;
