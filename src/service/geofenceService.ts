import * as Location from 'expo-location';
import { notificationService } from './notificationService';
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
  Timestamp,
  writeBatch
} from 'firebase/firestore';

export interface GeofenceData {
  id: string;
  userId: string;
  rideId: string;
  center: {
    latitude: number;
    longitude: number;
  };
  radius: number; // in meters
  location: string; // human readable location name
  type: 'pickup' | 'dropoff' | 'custom';
  active: boolean;
  createdAt: Date;
  triggeredAt?: Date;
  expiresAt?: Date;
}

export interface LocationUpdate {
  latitude: number;
  longitude: number;
  timestamp: Date;
  accuracy?: number;
}

class GeofenceService {
  private locationSubscription: Location.LocationSubscription | null = null;
  private activeGeofences: Map<string, GeofenceData> = new Map();
  private isMonitoring: boolean = false;
  private currentLocation: LocationUpdate | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.setupLocationTracking();
  }

  // Setup location tracking
  private async setupLocationTracking() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied for geofencing');
        return;
      }

      // Start location updates
      this.startLocationUpdates();
    } catch (error) {
      console.error('Error setting up location tracking:', error);
    }
  }

  // Start location updates
  private async startLocationUpdates() {
    if (this.isMonitoring) return;

    try {
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000, // Update every 10 seconds
          distanceInterval: 50, // Update every 50 meters
        },
        (location) => {
          this.currentLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: new Date(),
            accuracy: location.coords.accuracy,
          };

          this.checkGeofences();
        }
      );
    } catch (error) {
      console.error('Error starting location updates:', error);
    }

    this.isMonitoring = true;
    console.log('Location tracking started for geofencing');
  }

  // Stop location updates
  private stopLocationUpdates() {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.isMonitoring = false;
    console.log('Location tracking stopped for geofencing');
  }

  // Check all active geofences
  private async checkGeofences() {
    if (!this.currentLocation) return;

    for (const [geofenceId, geofence] of this.activeGeofences) {
      if (!geofence.active) continue;

      const distance = this.calculateDistance(
        this.currentLocation.latitude,
        this.currentLocation.longitude,
        geofence.center.latitude,
        geofence.center.longitude
      );

      // Check if user is within geofence radius
      if (distance <= geofence.radius) {
        await this.triggerGeofence(geofence);
      }
    }
  }

  // Calculate distance between two points using Haversine formula
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Trigger geofence notification
  private async triggerGeofence(geofence: GeofenceData) {
    try {
      // Mark geofence as triggered
      await updateDoc(doc(db, 'geofences', geofence.id), {
        triggeredAt: new Date(),
        active: false,
      });

      // Remove from active geofences
      this.activeGeofences.delete(geofence.id);

      // Send notification
      await notificationService.sendGeofenceAlertNotification(
        geofence.userId,
        geofence.location
      );

      console.log(`Geofence triggered: ${geofence.location}`);

      // Log geofence event
      await this.logGeofenceEvent(geofence, 'triggered');
    } catch (error) {
      console.error('Error triggering geofence:', error);
    }
  }

  // Log geofence event
  private async logGeofenceEvent(geofence: GeofenceData, event: string) {
    try {
      await addDoc(collection(db, 'geofenceEvents'), {
        geofenceId: geofence.id,
        userId: geofence.userId,
        rideId: geofence.rideId,
        event,
        location: geofence.location,
        coordinates: geofence.center,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error logging geofence event:', error);
    }
  }

  // Create a new geofence
  async createGeofence(geofenceData: Omit<GeofenceData, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'geofences'), {
        ...geofenceData,
        createdAt: new Date(),
      });

      // Add to active geofences if active
      if (geofenceData.active) {
        this.activeGeofences.set(docRef.id, {
          id: docRef.id,
          ...geofenceData,
          createdAt: new Date(),
        });
      }

      console.log('Geofence created:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error creating geofence:', error);
      throw error;
    }
  }

  // Create pickup geofence for a ride
  async createPickupGeofence(rideId: string, userId: string, location: string, coordinates: { latitude: number; longitude: number }) {
    const geofenceData: Omit<GeofenceData, 'id' | 'createdAt'> = {
      userId,
      rideId,
      center: coordinates,
      radius: 100, // 100 meters radius for pickup
      location,
      type: 'pickup',
      active: true,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // Expire in 2 hours
    };

    return await this.createGeofence(geofenceData);
  }

  // Create dropoff geofence for a ride
  async createDropoffGeofence(rideId: string, userId: string, location: string, coordinates: { latitude: number; longitude: number }) {
    const geofenceData: Omit<GeofenceData, 'id' | 'createdAt'> = {
      userId,
      rideId,
      center: coordinates,
      radius: 200, // 200 meters radius for dropoff
      location,
      type: 'dropoff',
      active: true,
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // Expire in 4 hours
    };

    return await this.createGeofence(geofenceData);
  }

  // Load user's active geofences
  async loadUserGeofences(userId: string) {
    try {
      const q = query(
        collection(db, 'geofences'),
        where('userId', '==', userId),
        where('active', '==', true)
      );

      const snapshot = await getDocs(q);
      this.activeGeofences.clear();

      snapshot.forEach((doc) => {
        const geofence = { id: doc.id, ...doc.data() } as GeofenceData;
        this.activeGeofences.set(doc.id, geofence);
      });

      console.log(`Loaded ${this.activeGeofences.size} active geofences for user ${userId}`);
    } catch (error) {
      console.error('Error loading user geofences:', error);
    }
  }

  // Update geofence
  async updateGeofence(geofenceId: string, updates: Partial<GeofenceData>) {
    try {
      const geofenceRef = doc(db, 'geofences', geofenceId);
      await updateDoc(geofenceRef, updates);

      // Update local cache
      const geofence = this.activeGeofences.get(geofenceId);
      if (geofence) {
        Object.assign(geofence, updates);
        
        // Remove if no longer active
        if (updates.active === false) {
          this.activeGeofences.delete(geofenceId);
        }
      }

      console.log('Geofence updated:', geofenceId);
    } catch (error) {
      console.error('Error updating geofence:', error);
      throw error;
    }
  }

  // Delete geofence
  async deleteGeofence(geofenceId: string) {
    try {
      // Remove from active geofences
      this.activeGeofences.delete(geofenceId);

      // Mark as inactive in database
      await updateDoc(doc(db, 'geofences', geofenceId), {
        active: false,
        deletedAt: new Date(),
      });

      console.log('Geofence deleted:', geofenceId);
    } catch (error) {
      console.error('Error deleting geofence:', error);
      throw error;
    }
  }

  // Get current location
  getCurrentLocation(): LocationUpdate | null {
    return this.currentLocation;
  }

  // Check if user is within a specific area
  isWithinArea(latitude: number, longitude: number, radius: number): boolean {
    if (!this.currentLocation) return false;

    const distance = this.calculateDistance(
      this.currentLocation.latitude,
      this.currentLocation.longitude,
      latitude,
      longitude
    );

    return distance <= radius;
  }

  // Cleanup expired geofences
  async cleanupExpiredGeofences() {
    try {
      const now = new Date();
      const q = query(
        collection(db, 'geofences'),
        where('expiresAt', '<', now),
        where('active', '==', true)
      );

      const snapshot = await getDocs(q);
      const batch = writeBatch(db);

      snapshot.forEach((doc) => {
        batch.update(doc.ref, { active: false, expiredAt: now });
        this.activeGeofences.delete(doc.id);
      });

      await batch.commit();
      console.log(`Cleaned up ${snapshot.size} expired geofences`);
    } catch (error) {
      console.error('Error cleaning up expired geofences:', error);
    }
  }

  // Start monitoring for a specific user
  async startMonitoring(userId: string) {
    await this.loadUserGeofences(userId);
    
    if (!this.isMonitoring) {
      this.startLocationUpdates();
    }
  }

  // Stop monitoring
  stopMonitoring() {
    this.stopLocationUpdates();
    this.activeGeofences.clear();
  }

  // Cleanup method
  cleanup() {
    this.stopMonitoring();
  }
}

// Export singleton instance
export const geofenceService = new GeofenceService();
export default geofenceService;
