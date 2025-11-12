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
  deleteDoc,
  orderBy,
  limit 
} from 'firebase/firestore';
import { notificationService } from './notificationService';
import { ref, get } from 'firebase/database'; // Added for Realtime Database
import { realtimeDb } from './firebase'; // Added for Realtime Database

export interface CompanionUser {
  id: string;
  uid: string;
  username: string;
  email: string;
  phone?: string | null;
  profileImage?: string;
  createdAt: Date;
  isActive: boolean;
  lastActive: Date;
  preferences: {
    notifications: boolean;
    trackingDistance: number; // in meters
    autoTracking: boolean;
  };
}

export interface TravelerCompanionLink {
  id: string;
  companionId: string;
  travelerId: string;
  travelerName: string;
  companionName: string;
  status: 'pending' | 'active' | 'paused' | 'removed';
  createdAt: Date;
  updatedAt: Date;
  permissions: {
    canTrack: boolean;
    canGetNotifications: boolean;
    canViewHistory: boolean;
  };
  settings: {
    trackingEnabled: boolean;
    notificationDistance: number; // in meters
    autoTracking: boolean;
  };
}

export interface CompanionTrackingData {
  id: string;
  linkId: string;
  companionId: string;
  travelerId: string;
  rideId: string;
  status: 'tracking' | 'completed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  currentLocation?: {
    latitude: number;
    longitude: number;
    timestamp: Date;
    accuracy?: number;
  };
  destination: {
    latitude: number;
    longitude: number;
    address: string;
  };
  estimatedArrival?: Date;
  lastUpdate: Date;
}

class CompanionService {
  private currentCompanion: CompanionUser | null = null;
  private activeLinks: Map<string, TravelerCompanionLink> = new Map();
  private trackingData: Map<string, CompanionTrackingData> = new Map();
  private rideSubscriptions: Map<string, { ride: () => void; location: () => void }> | null = null;

  constructor() {
    // Don't call async function in constructor
    // Service will be initialized when needed
  }

  // Initialize the service
  private async initializeService() {
    if (auth.currentUser) {
      await this.loadCompanionProfile();
      await this.loadActiveLinks();
    }
  }

  // Public method to initialize service when user is authenticated
  async initializeForUser() {
    if (auth.currentUser) {
      await this.loadCompanionProfile();
      await this.loadActiveLinks();
    }
  }

  // Load companion profile
  private async loadCompanionProfile() {
    if (!auth.currentUser) {
      console.log('❌ No authenticated user found');
      return;
    }

    try {
      console.log(`🔍 Loading companion profile for user: ${auth.currentUser.uid}`);
      
      const companionDoc = await getDocs(
        query(collection(db, 'companions'), where('uid', '==', auth.currentUser.uid))
      );

      if (!companionDoc.empty) {
        this.currentCompanion = {
          id: companionDoc.docs[0].id,
          ...companionDoc.docs[0].data()
        } as CompanionUser;
        console.log(`✅ Companion profile loaded: ${this.currentCompanion.username}`);
      } else {
        console.log('⚠️ No companion profile found for user. User may need to create a companion profile.');
      }
    } catch (error) {
      console.error('❌ Error loading companion profile:', error);
    }
  }

  // Load active links
  private async loadActiveLinks() {
    if (!this.currentCompanion) return;

    try {
      const linksQuery = query(
        collection(db, 'travelerCompanionLinks'),
        where('companionId', '==', this.currentCompanion.id),
        where('status', 'in', ['active', 'pending'])
      );

      const snapshot = await getDocs(linksQuery);
      this.activeLinks.clear();

      // Process each link and automatically accept pending ones
      for (const doc of snapshot.docs) {
        const link = { id: doc.id, ...doc.data() } as TravelerCompanionLink;
        
        // If link is pending, automatically accept it
        if (link.status === 'pending') {
          console.log(`Auto-accepting pending link: ${link.id} for traveler: ${link.travelerName}`);
          try {
            await this.acceptTravelerLink(link.id);
            link.status = 'active';
            link.updatedAt = new Date();
          } catch (error) {
            console.error(`Failed to auto-accept link ${link.id}:`, error);
          }
        }
        
        this.activeLinks.set(doc.id, link);
      }

      console.log(`Loaded ${this.activeLinks.size} active links`);
    } catch (error) {
      console.error('Error loading active links:', error);
    }
  }

  // Accept all pending links
  async acceptAllPendingLinks(): Promise<void> {
    if (!this.currentCompanion) {
      console.warn('Companion profile not loaded, cannot accept pending links');
      return;
    }

    try {
      const pendingLinksQuery = query(
        collection(db, 'travelerCompanionLinks'),
        where('companionId', '==', this.currentCompanion.id),
        where('status', '==', 'pending')
      );

      const snapshot = await getDocs(pendingLinksQuery);
      console.log(`Found ${snapshot.size} pending links to accept`);

      for (const doc of snapshot.docs) {
        try {
          await this.acceptTravelerLink(doc.id);
          console.log(`Accepted pending link: ${doc.id}`);
        } catch (error) {
          console.error(`Failed to accept link ${doc.id}:`, error);
        }
      }

      // Reload active links after accepting
      await this.loadActiveLinks();
    } catch (error) {
      console.error('Error accepting all pending links:', error);
      throw error;
    }
  }

  // Create companion user
  async createCompanionUser(companionData: Omit<CompanionUser, 'id' | 'createdAt' | 'lastActive'>): Promise<string> {
    try {
      // Filter out undefined values to prevent Firebase errors
      const cleanData = Object.fromEntries(
        Object.entries(companionData).filter(([_, value]) => value !== undefined)
      );

      const docRef = await addDoc(collection(db, 'companions'), {
        ...cleanData,
        createdAt: new Date(),
        lastActive: new Date(),
        isActive: true,
        preferences: {
          notifications: true,
          trackingDistance: 500, // 500 meters default
          autoTracking: true,
        },
      });

      console.log('Companion user created:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error creating companion user:', error);
      throw error;
    }
  }

  // Update companion profile
  async updateCompanionProfile(updates: Partial<CompanionUser>): Promise<void> {
    if (!this.currentCompanion) throw new Error('No companion profile loaded');

    try {
      const companionRef = doc(db, 'companions', this.currentCompanion.id);
      await updateDoc(companionRef, {
        ...updates,
        updatedAt: new Date(),
      });

      // Update local cache
      Object.assign(this.currentCompanion, updates);
      console.log('Companion profile updated');
    } catch (error) {
      console.error('Error updating companion profile:', error);
      throw error;
    }
  }

  // Link companion to traveler
  async linkToTraveler(travelerId: string, travelerName: string): Promise<string> {
    if (!this.currentCompanion) throw new Error('No companion profile loaded');

    try {
      // Check if link already exists
      const existingLink = await getDocs(
        query(
          collection(db, 'travelerCompanionLinks'),
          where('companionId', '==', this.currentCompanion.id),
          where('travelerId', '==', travelerId),
          where('status', 'in', ['active', 'pending'])
        )
      );

      if (!existingLink.empty) {
        throw new Error('Already linked to this traveler');
      }

      // Create new link
      const linkData: Omit<TravelerCompanionLink, 'id'> = {
        companionId: this.currentCompanion.id,
        travelerId,
        travelerName,
        companionName: this.currentCompanion.username,
        status: 'active', // Changed from 'pending' to 'active' for immediate tracking
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: {
          canTrack: true,
          canGetNotifications: true,
          canViewHistory: true,
        },
        settings: {
          trackingEnabled: true,
          notificationDistance: 200, // 200 meters default
          autoTracking: true,
        },
      };

      const docRef = await addDoc(collection(db, 'travelerCompanionLinks'), linkData);
      
      // Add to local cache
      this.activeLinks.set(docRef.id, { id: docRef.id, ...linkData });

      // Send notification to traveler
      await notificationService.sendCompanionLinkedNotification(
        travelerId,
        this.currentCompanion.username
      );

      console.log('Linked to traveler:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error linking to traveler:', error);
      throw error;
    }
  }

  // Accept traveler link request
  async acceptTravelerLink(linkId: string): Promise<void> {
    if (!this.currentCompanion) {
      console.warn('Companion profile not loaded, cannot accept traveler link');
      return;
    }

    try {
      const linkRef = doc(db, 'travelerCompanionLinks', linkId);
      await updateDoc(linkRef, {
        status: 'active',
        updatedAt: new Date(),
      });

      // Update local cache
      const link = this.activeLinks.get(linkId);
      if (link) {
        link.status = 'active';
        link.updatedAt = new Date();
      }

      console.log('Traveler link accepted:', linkId);
    } catch (error) {
      console.error('Error accepting traveler link:', error);
      throw error;
    }
  }

  // Remove traveler link
  async removeTravelerLink(linkId: string): Promise<void> {
    if (!this.currentCompanion) {
      console.warn('Companion profile not loaded, cannot remove traveler link');
      return;
    }

    try {
      const linkRef = doc(db, 'travelerCompanionLinks', linkId);
      await updateDoc(linkRef, {
        status: 'removed',
        updatedAt: new Date(),
      });

      // Remove from local cache
      this.activeLinks.delete(linkId);

      console.log('Traveler link removed:', linkId);
    } catch (error) {
      console.error('Error removing traveler link:', error);
      throw error;
    }
  }

  // Start tracking a traveler
  async startTrackingTraveler(linkId: string, rideId: string, destination: { latitude: number; longitude: number; address: string }): Promise<string> {
    if (!this.currentCompanion) throw new Error('No companion profile loaded');

    try {
      const link = this.activeLinks.get(linkId);
      if (!link) throw new Error('Link not found');

      const trackingData: Omit<CompanionTrackingData, 'id'> = {
        linkId,
        companionId: this.currentCompanion.id,
        travelerId: link.travelerId,
        rideId,
        status: 'tracking',
        startTime: new Date(),
        destination,
        lastUpdate: new Date(),
      };

      const docRef = await addDoc(collection(db, 'companionTracking'), trackingData);
      
      // Add to local cache
      this.trackingData.set(docRef.id, { id: docRef.id, ...trackingData });

      // Also store in Realtime Database for companion tracking service
      try {
        const { ref, set } = require('firebase/database');
        const { realtimeDb } = require('./firebase');
        
        const realtimeTrackingRef = ref(realtimeDb, `companionRideTracking/${this.currentCompanion.id}/${rideId}`);
        const realtimeTrackingData = {
          id: docRef.id,
          companionId: this.currentCompanion.id,
          travelerId: link.travelerId,
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
        
        await set(realtimeTrackingRef, realtimeTrackingData);
        console.log(`✅ Stored tracking data in Realtime Database for ride ${rideId}`);
      } catch (realtimeError) {
        console.error('❌ Error storing tracking data in Realtime Database:', realtimeError);
      }

      console.log('Started tracking traveler:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error starting tracking:', error);
      throw error;
    }
  }

  // Update tracking location
  async updateTrackingLocation(trackingId: string, location: { latitude: number; longitude: number; accuracy?: number }): Promise<void> {
    if (!this.currentCompanion) {
      console.warn('Companion profile not loaded, cannot update tracking location');
      return;
    }

    try {
      const trackingRef = doc(db, 'companionTracking', trackingId);
      await updateDoc(trackingRef, {
        currentLocation: {
          ...location,
          timestamp: new Date(),
        },
        lastUpdate: new Date(),
      });

      // Update local cache
      const tracking = this.trackingData.get(trackingId);
      if (tracking) {
        tracking.currentLocation = {
          ...location,
          timestamp: new Date(),
        };
        tracking.lastUpdate = new Date();
      }

      console.log('Tracking location updated:', trackingId);
    } catch (error) {
      console.error('Error updating tracking location:', error);
      throw error;
    }
  }

  // Stop tracking
  async stopTracking(trackingId: string, reason: 'completed' | 'cancelled'): Promise<void> {
    if (!this.currentCompanion) {
      console.warn('Companion profile not loaded, cannot stop tracking');
      return;
    }

    try {
      const trackingRef = doc(db, 'companionTracking', trackingId);
      await updateDoc(trackingRef, {
        status: reason,
        endTime: new Date(),
        lastUpdate: new Date(),
      });

      // Update local cache
      const tracking = this.trackingData.get(trackingId);
      if (tracking) {
        tracking.status = reason;
        tracking.endTime = new Date();
        tracking.lastUpdate = new Date();
      }

      console.log('Tracking stopped:', trackingId, reason);
    } catch (error) {
      console.error('Error stopping tracking:', error);
      throw error;
    }
  }

  // Get active tracking data
  getActiveTracking(): CompanionTrackingData[] {
    if (!this.currentCompanion) {
      console.warn('Companion profile not loaded, cannot get active tracking');
      return [];
    }
    return Array.from(this.trackingData.values()).filter(t => t.status === 'tracking');
  }

  // Get companion profile
  getCompanionProfile(): CompanionUser | null {
    if (!this.currentCompanion) {
      console.warn('⚠️ Companion profile not loaded');
    }
    return this.currentCompanion;
  }

  // Check if companion profile exists
  hasCompanionProfile(): boolean {
    return this.currentCompanion !== null;
  }

  // Get companion profile ID
  getCompanionId(): string | null {
    return this.currentCompanion?.id || null;
  }

  // Get active links
  getActiveLinks(): TravelerCompanionLink[] {
    if (!this.currentCompanion) {
      console.warn('Companion profile not loaded, returning empty links array');
      return [];
    }
    return Array.from(this.activeLinks.values());
  }

  // Check if linked to traveler
  isLinkedToTraveler(travelerId: string): boolean {
    if (!this.currentCompanion) {
      console.warn('Companion profile not loaded, cannot check traveler link');
      return false;
    }
    return Array.from(this.activeLinks.values()).some(
      link => link.travelerId === travelerId && link.status === 'active'
    );
  }

  // Get tracking data for a specific ride
  getTrackingDataForRide(rideId: string): CompanionTrackingData | null {
    if (!this.currentCompanion) {
      console.warn('Companion profile not loaded, cannot get tracking data');
      return null;
    }
    return Array.from(this.trackingData.values()).find(t => t.rideId === rideId) || null;
  }

  // Update link settings
  async updateLinkSettings(linkId: string, settings: Partial<TravelerCompanionLink['settings']>): Promise<void> {
    if (!this.currentCompanion) {
      console.warn('Companion profile not loaded, cannot update link settings');
      return;
    }

    try {
      const linkRef = doc(db, 'travelerCompanionLinks', linkId);
      await updateDoc(linkRef, {
        'settings': settings,
        updatedAt: new Date(),
      });

      // Update local cache
      const link = this.activeLinks.get(linkId);
      if (link) {
        Object.assign(link.settings, settings);
        link.updatedAt = new Date();
      }

      console.log('Link settings updated:', linkId);
    } catch (error) {
      console.error('Error updating link settings:', error);
      throw error;
    }
  }

  // Get companion statistics
  async getCompanionStats(): Promise<{
    totalLinks: number;
    activeLinks: number;
    totalTrackingSessions: number;
    completedTrackingSessions: number;
  }> {
    if (!this.currentCompanion) {
      console.warn('Companion profile not loaded, returning default stats');
      return {
        totalLinks: 0,
        activeLinks: 0,
        totalTrackingSessions: 0,
        completedTrackingSessions: 0,
      };
    }

    try {
      const linksQuery = query(
        collection(db, 'travelerCompanionLinks'),
        where('companionId', '==', this.currentCompanion.id)
      );
      const linksSnapshot = await getDocs(linksQuery);

      const trackingQuery = query(
        collection(db, 'companionTracking'),
        where('companionId', '==', this.currentCompanion.id)
      );
      const trackingSnapshot = await getDocs(trackingQuery);

      const totalLinks = linksSnapshot.size;
      const activeLinks = linksSnapshot.docs.filter(doc => doc.data().status === 'active').length;
      const totalTrackingSessions = trackingSnapshot.size;
      const completedTrackingSessions = trackingSnapshot.docs.filter(doc => doc.data().status === 'completed').length;

      return {
        totalLinks,
        activeLinks,
        totalTrackingSessions,
        completedTrackingSessions,
      };
    } catch (error) {
      console.error('Error getting companion stats:', error);
      throw error;
    }
  }

  // Get ride history for companion
  async getRideHistory(): Promise<any[]> {
    if (!this.currentCompanion) {
      console.warn('Companion profile not loaded, returning empty history');
      return [];
    }

    try {
      // Simplified query without orderBy to avoid index requirement
      const trackingQuery = query(
        collection(db, 'companionTracking'),
        where('companionId', '==', this.currentCompanion.id)
      );
      const trackingSnapshot = await getDocs(trackingQuery);

      // Sort in memory instead of using orderBy
      const results = trackingSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startTime: doc.data().startTime?.toDate(),
        endTime: doc.data().endTime?.toDate(),
      }));

      // Sort by startTime descending
      return results.sort((a, b) => {
        const aTime = a.startTime?.getTime() || 0;
        const bTime = b.startTime?.getTime() || 0;
        return bTime - aTime;
      });
    } catch (error) {
      console.error('Error getting ride history:', error);
      throw error;
    }
  }

  // Get companion preferences
  async getCompanionPreferences(): Promise<{
    notifications: boolean;
    trackingDistance: number;
    autoTracking: boolean;
  }> {
    if (!this.currentCompanion) {
      console.warn('Companion profile not loaded, returning default preferences');
      return {
        notifications: true,
        trackingDistance: 500,
        autoTracking: true,
      };
    }

    return this.currentCompanion.preferences;
  }

  // Update companion preferences
  async updateCompanionPreferences(preferences: {
    notifications: boolean;
    trackingDistance: number;
    autoTracking: boolean;
  }): Promise<void> {
    if (!this.currentCompanion) throw new Error('No companion profile loaded');

    try {
      const companionRef = doc(db, 'companions', this.currentCompanion.id);
      await updateDoc(companionRef, {
        preferences,
        lastActive: new Date(),
      });

      // Update local cache
      this.currentCompanion.preferences = preferences;
      this.currentCompanion.lastActive = new Date();

      console.log('Companion preferences updated');
    } catch (error) {
      console.error('Error updating companion preferences:', error);
      throw error;
    }
  }

  // Logout companion
  async logout(): Promise<void> {
    try {
      // Clear local data
      this.cleanup();
      
      // Sign out from Firebase Auth
      await auth.signOut();
      
      console.log('Companion logged out successfully');
    } catch (error) {
      console.error('Error during logout:', error);
      throw error;
    }
  }

  // Delete companion account
  async deleteCompanionAccount(): Promise<void> {
    if (!this.currentCompanion) throw new Error('No companion profile loaded');

    try {
      // Delete companion user document
      const companionRef = doc(db, 'companions', this.currentCompanion.id);
      await deleteDoc(companionRef);

      // Delete all associated links
      const linksQuery = query(
        collection(db, 'travelerCompanionLinks'),
        where('companionId', '==', this.currentCompanion.id)
      );
      const linksSnapshot = await getDocs(linksQuery);
      
      for (const linkDoc of linksSnapshot.docs) {
        await deleteDoc(linkDoc.ref);
      }

      // Delete all tracking data
      const trackingQuery = query(
        collection(db, 'companionTracking'),
        where('companionId', '==', this.currentCompanion.id)
      );
      const trackingSnapshot = await getDocs(trackingQuery);
      
      for (const trackingDoc of trackingSnapshot.docs) {
        await deleteDoc(trackingDoc.ref);
      }

      // Clear local data
      this.cleanup();
      
      // Delete Firebase Auth user
      if (auth.currentUser) {
        await auth.currentUser.delete();
      }

      console.log('Companion account deleted successfully');
    } catch (error) {
      console.error('Error deleting companion account:', error);
      throw error;
    }
  }

  // Cleanup method
  cleanup() {
    this.activeLinks.clear();
    this.trackingData.clear();
    this.currentCompanion = null;
  }

  // Start tracking a ride
  async startTrackingRide(rideId: string, travelerId: string, destination: string): Promise<string> {
    if (!this.currentCompanion) throw new Error('No companion profile loaded');

    try {
      // Check if companion is linked to this traveler
      const isLinked = this.isLinkedToTraveler(travelerId);
      if (!isLinked) {
        throw new Error('Not linked to this traveler');
      }

      // Create tracking session
      const trackingData: Omit<CompanionTrackingData, 'id'> = {
        linkId: '', // Will be set below
        companionId: this.currentCompanion.id,
        travelerId,
        rideId,
        status: 'tracking',
        startTime: new Date(),
        destination: {
          latitude: 0, // Will be updated with actual coordinates
          longitude: 0,
          address: destination,
        },
        lastUpdate: new Date(),
      };

      // Get the link ID
      const link = Array.from(this.activeLinks.values()).find(
        l => l.travelerId === travelerId && l.status === 'active'
      );
      if (link) {
        trackingData.linkId = link.id;
      }

      const docRef = await addDoc(collection(db, 'companionTracking'), trackingData);
      
      // Add to local cache
      this.trackingData.set(docRef.id, { id: docRef.id, ...trackingData });

      console.log('Started tracking ride:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error starting ride tracking:', error);
      throw error;
    }
  }

  // Update ride tracking status
  async updateRideTrackingStatus(trackingId: string, status: 'tracking' | 'completed' | 'cancelled'): Promise<void> {
    try {
      const trackingRef = doc(db, 'companionTracking', trackingId);
      await updateDoc(trackingRef, {
        status,
        lastUpdate: new Date(),
        ...(status === 'completed' && { endTime: new Date() }),
      });

      // Update local cache
      const tracking = this.trackingData.get(trackingId);
      if (tracking) {
        tracking.status = status;
        tracking.lastUpdate = new Date();
        if (status === 'completed') {
          tracking.endTime = new Date();
        }
      }

      console.log('Updated ride tracking status:', trackingId, status);
    } catch (error) {
      console.error('Error updating ride tracking status:', error);
      throw error;
    }
  }

  // Get active ride tracking
  getActiveRideTracking(): CompanionTrackingData[] {
    if (!this.currentCompanion) {
      console.warn('Companion profile not loaded, cannot get active tracking');
      return [];
    }
    return Array.from(this.trackingData.values()).filter(t => t.status === 'tracking');
  }

  // Get traveler name from traveler ID
  getTravelerNameFromId(travelerId: string): string {
    const link = Array.from(this.activeLinks.values()).find(l => l.travelerId === travelerId);
    return link ? link.travelerName : 'Unknown Traveler';
  }

  // Check for active rides from linked travelers
  async checkForActiveRidesFromLinkedTravelers(): Promise<CompanionTrackingData[]> {
    if (!this.currentCompanion) {
      console.warn('Companion profile not loaded, cannot check for active rides');
      return [];
    }

    try {
      const activeRides: CompanionTrackingData[] = [];
      const activeLinks = Array.from(this.activeLinks.values()).filter(l => l.status === 'active');
      
      console.log(`🔍 Checking for active rides from ${activeLinks.length} linked travelers`);
      
      for (const link of activeLinks) {
        console.log(`🔍 Checking rides for traveler: ${link.travelerName} (${link.travelerId})`);
        
        // Check Realtime Database for ride requests
        try {
          const rideRequestsRef = ref(realtimeDb, 'rideRequests');
          const snapshot = await get(rideRequestsRef);
          
          if (snapshot.exists()) {
            const rides = snapshot.val();
            console.log(`📊 Found ${Object.keys(rides).length} total rides in Realtime DB`);
            
            // Filter rides for this traveler with more inclusive status check
            const travelerRides = Object.entries(rides).filter(([rideId, rideData]: [string, any]) => {
              // Check multiple possible user ID fields
              const possibleUserIds = [
                rideData.userID,
                rideData.userId,
                rideData.user_id,
                rideData.passengerId,
                rideData.passenger_id,
                rideData.travelerId,
                rideData.traveler_id
              ].filter(id => id); // Remove undefined/null values
              
              const isTravelerRide = possibleUserIds.includes(link.travelerId);
              const isActiveStatus = ['requested', 'accepted', 'started', 'in_progress', 'active', 'tracking'].includes(rideData.status);
              
              console.log(`🔍 Ride ${rideId}: userIDs=${JSON.stringify(possibleUserIds)}, travelerId=${link.travelerId}, isTraveler=${isTravelerRide}, status=${rideData.status}, active=${isActiveStatus}`);
              
              return isTravelerRide && isActiveStatus;
            });
            
            console.log(`✅ Found ${travelerRides.length} active rides for traveler ${link.travelerId}`);
            
            // Use for...of loop instead of forEach to support async/await
            for (const [rideId, rideData] of travelerRides) {
              console.log(`🚗 Processing ride ${rideId}:`, rideData);

              // Check if we're already tracking this ride
              const existingTracking = Array.from(this.trackingData.values()).find(t => t.rideId === rideId);
              
              if (!existingTracking) {
                // Extract destination information
                let destination = {
                  latitude: 0,
                  longitude: 0,
                  address: 'Unknown destination'
                };

                if (rideData.endLat && rideData.endLong) {
                  destination = {
                    latitude: rideData.endLat,
                    longitude: rideData.endLong,
                    address: rideData.to || rideData.destination || 'Unknown destination'
                  };
                } else if (rideData.destination) {
                  destination = {
                    latitude: rideData.destination.latitude || 0,
                    longitude: rideData.destination.longitude || 0,
                    address: rideData.destination.address || rideData.destination.name || 'Unknown destination'
                  };
                }

                // Create tracking data for this ride
                const trackingData: CompanionTrackingData = {
                  id: `auto_${rideId}`,
                  linkId: link.id,
                  companionId: this.currentCompanion!.id,
                  travelerId: link.travelerId,
                  rideId,
                  status: rideData.status === 'accepted' || rideData.status === 'started' || rideData.status === 'in_progress' ? 'in_progress' : 'tracking',
                  startTime: new Date(rideData.requestedAt || rideData.time || rideData.createdAt || Date.now()),
                  destination,
                  lastUpdate: new Date(),
                };
                
                console.log(`📱 Created tracking data for ride ${rideId}:`, trackingData);
                
                // Add to local cache so it persists
                this.trackingData.set(trackingData.id, trackingData);
                
                // Automatically start tracking this ride
                try {
                  await this.startTrackingTraveler(link.id, rideId, destination);
                  console.log(`✅ Automatically started tracking ride ${rideId}`);
                } catch (trackingError) {
                  console.error(`❌ Failed to start tracking ride ${rideId}:`, trackingError);
                }
                
                activeRides.push(trackingData);
              } else {
                console.log(`🔄 Already tracking ride ${rideId}, updating status...`);
                
                // Update existing tracking data with latest status
                existingTracking.status = rideData.status === 'accepted' || rideData.status === 'started' || rideData.status === 'in_progress' ? 'in_progress' : 'tracking';
                existingTracking.lastUpdate = new Date();
                
                // Update destination if available
                if (rideData.endLat && rideData.endLong && !existingTracking.destination.address) {
                  existingTracking.destination = {
                    latitude: rideData.endLat,
                    longitude: rideData.endLong,
                    address: rideData.to || rideData.destination || 'Unknown destination'
                  };
                }
                
                activeRides.push(existingTracking);
              }
            }
          } else {
            console.log('📭 No rides found in Realtime Database');
          }
        } catch (dbError) {
          console.error('❌ Error checking Realtime Database:', dbError);
        }
      }

      console.log(`🎯 Total active rides found: ${activeRides.length}`);
      return activeRides;
    } catch (error) {
      console.error('❌ Error checking for active rides from linked travelers:', error);
      return [];
    }
  }

  // Debug method to check ride data structure and active links
  async debugRideDataStructure(): Promise<void> {
    if (!this.currentCompanion) {
      console.log('❌ No companion profile loaded');
      return;
    }

    try {
      console.log('🔍 === DEBUG: RIDE DATA STRUCTURE ===');
      
      // Check active links
      console.log(`📊 Active links count: ${this.activeLinks.size}`);
      this.activeLinks.forEach((link, id) => {
        console.log(`🔗 Link ${id}: ${link.travelerName} (${link.travelerId}) - Status: ${link.status}`);
      });

      // Check ride requests in Realtime Database
      const { ref, get } = require('firebase/database');
      const { realtimeDb } = require('./firebase');
      
      const rideRequestsRef = ref(realtimeDb, 'rideRequests');
      const snapshot = await get(rideRequestsRef);
      
      if (snapshot.exists()) {
        const rides = snapshot.val();
        console.log(`📊 Total rides in Realtime DB: ${Object.keys(rides).length}`);
        
        // Show first few rides with their structure
        const rideEntries = Object.entries(rides).slice(0, 5);
        rideEntries.forEach(([rideId, rideData]: [string, any]) => {
          console.log(`🚗 Ride ${rideId}:`, {
            userID: rideData.userID,
            userId: rideData.userId,
            user_id: rideData.user_id,
            passengerId: rideData.passengerId,
            passenger_id: rideData.passenger_id,
            travelerId: rideData.travelerId,
            traveler_id: rideData.traveler_id,
            status: rideData.status,
            to: rideData.to,
            from: rideData.from
          });
        });
      } else {
        console.log('❌ No rides found in Realtime Database');
      }
      
      console.log('🔍 === END DEBUG ===');
    } catch (error) {
      console.error('❌ Error in debug method:', error);
    }
  }

  // Manual refresh of tracking data
  async refreshTrackingData(): Promise<void> {
    if (!this.currentCompanion) {
      console.warn('Companion profile not loaded, cannot refresh tracking data');
      return;
    }

    try {
      console.log('Manually refreshing tracking data...');
      
      // Clear existing tracking data
      this.trackingData.clear();
      
      // Reload active links
      await this.loadActiveLinks();
      
      // Check for active rides
      await this.checkForActiveRidesFromLinkedTravelers();
      
      console.log('Tracking data refresh completed');
    } catch (error) {
      console.error('Error refreshing tracking data:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const companionService = new CompanionService();
export default companionService;
