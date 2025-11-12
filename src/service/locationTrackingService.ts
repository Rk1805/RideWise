import { ref, onValue, off, update, set, get } from 'firebase/database';
import { realtimeDb } from './firebase';
import * as Location from 'expo-location';

export interface LocationUpdate {
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  speed?: number;
  heading?: number;
}

export interface RideTrackingData {
  rideId: string;
  driverId: string;
  driverLocation: LocationUpdate;
  userLocation?: LocationUpdate;
  status: 'active' | 'completed' | 'cancelled';
  startTime: string;
  estimatedArrival?: string;
  actualArrival?: string;
}

class LocationTrackingService {
  private locationSubscription: Location.LocationSubscription | null = null;
  private activeRideId: string | null = null;
  private isTracking = false;

  // Start tracking driver location for an active ride
  async startDriverTracking(rideId: string, driverId: string) {
    if (this.isTracking) {
      console.log('Already tracking location');
      return;
    }

    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission denied');
      }

      // Enable high accuracy location updates
      await Location.enableNetworkProviderAsync();
      
      this.activeRideId = rideId;
      this.isTracking = true;

      // Start location updates
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000, // Update every 10 seconds
          distanceInterval: 10, // Update every 10 meters
        },
        (location) => {
          this.updateDriverLocation(rideId, driverId, location);
        }
      );

      console.log('🚗 Started driver location tracking for ride:', rideId);
    } catch (error) {
      console.error('Error starting location tracking:', error);
      throw error;
    }
  }

  // Update driver location in real-time database
  private async updateDriverLocation(rideId: string, driverId: string, location: Location.LocationObject) {
    try {
      // Create location update object with proper validation
      const locationUpdate: LocationUpdate = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: new Date().toISOString(),
      };

      // Only add optional properties if they exist and are valid
      if (location.coords.accuracy && location.coords.accuracy > 0) {
        locationUpdate.accuracy = location.coords.accuracy;
      }

      if (location.coords.speed !== null && location.coords.speed !== undefined && location.coords.speed >= 0) {
        locationUpdate.speed = location.coords.speed;
      }

      if (location.coords.heading !== null && location.coords.heading !== undefined && location.coords.heading >= 0) {
        locationUpdate.heading = location.coords.heading;
      }

      // Update ride tracking in real-time database
      const trackingRef = ref(realtimeDb, `rideTracking/${rideId}`);
      await update(trackingRef, {
        driverLocation: locationUpdate,
        lastUpdated: new Date().toISOString(),
      });

      // Also update the ride request with current driver location
      const rideRef = ref(realtimeDb, `rideRequests/${rideId}`);
      await update(rideRef, {
        driverLocation: locationUpdate,
        lastLocationUpdate: new Date().toISOString(),
      });

      console.log('📍 Driver location updated:', locationUpdate);
    } catch (error) {
      console.error('Error updating driver location:', error);
    }
  }

  // Stop location tracking
  stopTracking() {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }
    
    this.isTracking = false;
    this.activeRideId = null;
    console.log('🛑 Stopped location tracking');
  }

  // Get current location once
  async getCurrentLocation(): Promise<LocationUpdate | null> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission denied');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Create location update object with proper validation
      const locationUpdate: LocationUpdate = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: new Date().toISOString(),
      };

      // Only add optional properties if they exist and are valid
      if (location.coords.accuracy && location.coords.accuracy > 0) {
        locationUpdate.accuracy = location.coords.accuracy;
      }

      if (location.coords.speed !== null && location.coords.speed !== undefined && location.coords.speed >= 0) {
        locationUpdate.speed = location.coords.speed;
      }

      if (location.coords.heading !== null && location.coords.heading !== undefined && location.coords.heading >= 0) {
        locationUpdate.heading = location.coords.heading;
      }

      return locationUpdate;
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  // Calculate distance between two points
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (val: number) => (val * Math.PI) / 180;
    const R = 6371; // Earth radius in km

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Estimate arrival time based on current location and destination
  estimateArrivalTime(
    currentLat: number,
    currentLon: number,
    destLat: number,
    destLon: number,
    averageSpeed: number = 30 // km/h
  ): number {
    const distance = this.calculateDistance(currentLat, currentLon, destLat, destLon);
    return (distance / averageSpeed) * 60; // Return minutes
  }

  // Check if driver is near pickup/dropoff location
  isNearLocation(
    driverLat: number,
    driverLon: number,
    targetLat: number,
    targetLon: number,
    threshold: number = 0.1 // 100 meters
  ): boolean {
    const distance = this.calculateDistance(driverLat, driverLon, targetLat, targetLon);
    return distance <= threshold;
  }

  // Get active ride tracking data
  async getActiveRideTracking(rideId: string): Promise<RideTrackingData | null> {
    try {
      const snapshot = await get(ref(realtimeDb, `rideTracking/${rideId}`));
      if (snapshot.exists()) {
        return snapshot.val() as RideTrackingData;
      }
      return null;
    } catch (error) {
      console.error('Error getting ride tracking data:', error);
      return null;
    }
  }

  // Update ride status
  async updateRideStatus(rideId: string, status: 'active' | 'completed' | 'cancelled') {
    try {
      const trackingRef = ref(realtimeDb, `rideTracking/${rideId}`);
      await update(trackingRef, {
        status,
        statusUpdatedAt: new Date().toISOString(),
      });

      if (status === 'completed' || status === 'cancelled') {
        this.stopTracking();
      }

      console.log(`🔄 Ride status updated to: ${status}`);
    } catch (error) {
      console.error('Error updating ride status:', error);
    }
  }
}

export const locationTrackingService = new LocationTrackingService();
export default locationTrackingService;
