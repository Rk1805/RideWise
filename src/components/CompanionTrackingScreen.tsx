import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  ColorValue,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../service/themeContext';
import { companionTrackingService, CompanionRideTracking } from '../service/companionTrackingService';
import { expoNotificationService } from '../service/fcmService';
import MapView, { Marker, Polyline } from 'react-native-maps';

const { width, height } = Dimensions.get('window');

const CompanionTrackingScreen = () => {
  const { isDarkMode } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { trackingId, rideId } = route.params;

  const [trackingData, setTrackingData] = useState<CompanionRideTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [region, setRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  useEffect(() => {
    const initializeTracking = async () => {
      if (rideId) {
        try {
          // Initialize tracking service for current user
          await companionTrackingService.initializeForUser();
          await loadTrackingData();
          const unsubscribe = subscribeToTracking();
          subscribeToNotifications();
          
          // Store unsubscribe function for cleanup
          return unsubscribe;
        } catch (error) {
          console.error('Error initializing tracking:', error);
        }
      }
    };

    let unsubscribeTracking: (() => void) | undefined;
    
    initializeTracking().then(unsub => {
      unsubscribeTracking = unsub;
    });

    return () => {
      // Cleanup subscriptions
      if (unsubscribeTracking) {
        console.log('🧹 Cleaning up tracking subscription for ride:', rideId);
        unsubscribeTracking();
      }
    };
  }, [rideId]);

  const loadTrackingData = async () => {
    try {
      setLoading(true);
      console.log(`🔍 Loading tracking data for rideId: ${rideId}`);
      
      // First try to get data from tracking service
      let data = await companionTrackingService.getTrackingData(rideId);
      
      if (!data) {
        console.log(`❌ No data found in tracking service, trying to sync from companion service...`);
        
        // Try to sync data from companion service
        await companionTrackingService.syncTrackingDataFromCompanionService();
        data = await companionTrackingService.getTrackingData(rideId);
      }
      
      if (!data) {
        console.log(`❌ Still no data found, checking companion service directly...`);
        
        // Try to get data directly from companion service
        const { companionService } = require('../service/companionService');
        const companionTrackingData = companionService.getActiveTracking();
        const companionData = companionTrackingData.find(t => t.rideId === rideId);
        
        if (companionData) {
          console.log(`✅ Found data in companion service, converting format...`);
          
          // Convert companion service data to tracking service format
          data = {
            id: companionData.id,
            companionId: companionData.companionId,
            travelerId: companionData.travelerId,
            rideId: companionData.rideId,
            status: companionData.status,
            startTime: companionData.startTime.getTime(),
            destination: companionData.destination,
            lastUpdate: companionData.lastUpdate.getTime(),
            notifications: {
              rideStarted: false,
              rideInProgress: false,
              rideCompleted: false,
              rideCancelled: false,
            },
          };
          
          // Store in tracking service for future use
          await companionTrackingService.addTrackingDataToCache(rideId, data);
        }
      }
      
      if (data) {
        console.log(`✅ Successfully loaded tracking data:`, data);
        setTrackingData(data);

        if (data.currentLocation) {
          updateMapRegion(data.currentLocation);
        }
      } else {
        console.log(`❌ No tracking data found for rideId: ${rideId}`);
        Alert.alert(
          'No Tracking Data Found',
          `Unable to find tracking data for ride ${rideId}. Please check if the ride is still active.`,
          [
            { text: 'OK', onPress: () => navigation.goBack() }
          ]
        );
      }
    } catch (error) {
      console.error('❌ Error loading tracking data:', error);
      Alert.alert(
        'Error Loading Data',
        'Failed to load tracking data. Please try again.',
        [
          { text: 'Retry', onPress: () => loadTrackingData() },
          { text: 'Go Back', onPress: () => navigation.goBack() }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const subscribeToTracking = () => {
    if (!rideId) return;

    console.log('🔍 Setting up tracking subscription for ride:', rideId);
    
    const unsubscribe = companionTrackingService.subscribeToTrackingUpdates(rideId, (data) => {
      console.log('📡 Tracking update received:', data);
      setTrackingData(data);
      
      if (data?.currentLocation) {
        updateMapRegion(data.currentLocation);
      }
    });

    return unsubscribe;
  };

  const subscribeToNotifications = () => {
    // Subscribe to companion notifications
    const unsubscribe = expoNotificationService.subscribeToCompanionNotifications(
      trackingData?.companionId || '',
      (notifs) => {
        setNotifications(notifs.filter(n => n.rideId === rideId));
      }
    );

    return unsubscribe;
  };

  const updateMapRegion = (location: { latitude: number; longitude: number }) => {
    setRegion({
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  };

  const getStatusColor = (): [ColorValue, ColorValue, ...ColorValue[]] => {
    if (!trackingData) return ['#6b7280', '#4b5563'];

    switch (trackingData.status) {
      case 'tracking':
        return ['#3b82f6', '#1d4ed8'];
      case 'in_progress':
        return ['#10b981', '#059669'];
      case 'completed':
        return ['#8b5cf6', '#7c3aed'];
      case 'cancelled':
        return ['#ef4444', '#dc2626'];
      default:
        return ['#6b7280', '#4b5563'];
    }
  };

  const getStatusMessage = () => {
    if (!trackingData) return 'Loading...';

    switch (trackingData.status) {
      case 'tracking':
        return '🚗 Driver Found - On the way!';
      case 'in_progress':
        return '🚀 Ride in Progress';
      case 'completed':
        return '✅ Ride Completed';
      case 'cancelled':
        return '❌ Ride Cancelled';
      default:
        return 'Processing...';
    }
  };

  const getProgressPercentage = () => {
    if (!trackingData) return 0;

    switch (trackingData.status) {
      case 'tracking':
        return 25;
      case 'in_progress':
        return 75;
      case 'completed':
        return 100;
      case 'cancelled':
        return 0;
      default:
        return 0;
    }
  };

  const handleStopTracking = () => {
    Alert.alert(
      'Stop Tracking',
      'Are you sure you want to stop tracking this ride?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop Tracking',
          style: 'destructive',
          onPress: async () => {
            try {
              await companionTrackingService.stopTracking(rideId, 'cancelled');
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to stop tracking');
            }
          },
        },
      ]
    );
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDuration = (startTime: number, endTime?: number) => {
    const duration = endTime ? endTime - startTime : Date.now() - startTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in kilometers
    return distance;
  };

  // Fallback progress calculation based on status
  const getStatusBasedProgress = () => {
    if (!trackingData) return 0;

    switch (trackingData.status) {
      case 'tracking':
        return 3; // Driver found, preparing to start (changed from 15 to 3)
      case 'in_progress':
        return 60; // Ride is actively in progress
      case 'completed':
        return 100;
      case 'cancelled':
        return 0;
      default:
        return 0;
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: isDarkMode ? '#121212' : '#f5f5f5' }]}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={[styles.loadingText, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
          Loading tracking data...
        </Text>
      </View>
    );
  }

  if (!trackingData) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: isDarkMode ? '#121212' : '#f5f5f5' }]}>
        <Text style={[styles.errorText, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
          No tracking data found for this ride.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadTrackingData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <LinearGradient colors={getStatusColor()} style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.statusTitle}>{getStatusMessage()}</Text>
          <Text style={styles.rideId}>Ride ID: {trackingData.rideId}</Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${getProgressPercentage()}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>{getProgressPercentage()}% Complete</Text>
        </View>

        {/* Map Section */}
        <View style={styles.mapContainer}>
          <Text style={styles.sectionTitle}>📍 Live Location</Text>
          <MapView
            style={styles.map}
            region={region}
            showsUserLocation={false}
            showsMyLocationButton={false}
          >
            {/* Driver Location Marker */}
            {trackingData.currentLocation && (
              <Marker
                coordinate={{
                  latitude: trackingData.currentLocation.latitude,
                  longitude: trackingData.currentLocation.longitude,
                }}
                title="Driver Location"
                description={`Last updated: ${formatTime(trackingData.currentLocation.timestamp)}`}
                pinColor="#3b82f6"
              />
            )}

            {/* Destination Marker */}
            <Marker
              coordinate={{
                latitude: trackingData.destination.latitude,
                longitude: trackingData.destination.longitude,
              }}
              title="Destination"
              description={trackingData.destination.address}
              pinColor="#ef4444"
            />

            {/* Route Line */}
            {trackingData.currentLocation && (
              <Polyline
                coordinates={[
                  {
                    latitude: trackingData.currentLocation.latitude,
                    longitude: trackingData.currentLocation.longitude,
                  },
                  {
                    latitude: trackingData.destination.latitude,
                    longitude: trackingData.destination.longitude,
                  },
                ]}
                strokeColor="#3b82f6"
                strokeWidth={3}
              />
            )}
          </MapView>
        </View>

        {/* Status Information */}
        <View style={styles.statusContainer}>
          <Text style={styles.sectionTitle}>📊 Ride Status</Text>
          
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status:</Text>
              <Text style={[styles.statusValue, { color: getStatusColor()[0] }]}>
                {trackingData.status.toUpperCase()}
              </Text>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Started:</Text>
              <Text style={styles.statusValue}>
                {formatTime(trackingData.startTime)}
              </Text>
            </View>
            
            {trackingData.endTime && (
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Ended:</Text>
                <Text style={styles.statusValue}>
                  {formatTime(trackingData.endTime)}
                </Text>
              </View>
            )}
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Duration:</Text>
              <Text style={styles.statusValue}>
                {formatDuration(trackingData.startTime, trackingData.endTime)}
              </Text>
            </View>
            
            {trackingData.estimatedArrival && (
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>ETA:</Text>
                <Text style={styles.statusValue}>
                  {new Date(trackingData.estimatedArrival).toLocaleTimeString()}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Location Information */}
        {trackingData.currentLocation && (
          <View style={styles.locationContainer}>
            <Text style={styles.sectionTitle}>📍 Current Location</Text>
            
            <View style={styles.locationCard}>
              <View style={styles.locationRow}>
                <Text style={styles.locationLabel}>Latitude:</Text>
                <Text style={styles.locationValue}>
                  {trackingData.currentLocation.latitude.toFixed(6)}
                </Text>
              </View>
              
              <View style={styles.locationRow}>
                <Text style={styles.locationLabel}>Longitude:</Text>
                <Text style={styles.locationValue}>
                  {trackingData.currentLocation.longitude.toFixed(6)}
                </Text>
              </View>
              
              <View style={styles.locationRow}>
                <Text style={styles.locationLabel}>Updated:</Text>
                <Text style={styles.locationValue}>
                  {formatTime(trackingData.currentLocation.timestamp)}
                </Text>
              </View>
              
              {trackingData.currentLocation.accuracy && (
                <View style={styles.locationRow}>
                  <Text style={styles.locationLabel}>Accuracy:</Text>
                  <Text style={styles.locationValue}>
                    ±{trackingData.currentLocation.accuracy.toFixed(1)}m
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Destination Information */}
        <View style={styles.destinationContainer}>
          <Text style={styles.sectionTitle}>🎯 Destination</Text>
          
          <View style={styles.destinationCard}>
            <Text style={styles.destinationAddress}>
              {trackingData.destination.address}
            </Text>
            
            <View style={styles.destinationCoords}>
              <Text style={styles.coordText}>
                Lat: {trackingData.destination.latitude.toFixed(6)}
              </Text>
              <Text style={styles.coordText}>
                Lng: {trackingData.destination.longitude.toFixed(6)}
              </Text>
            </View>
          </View>
        </View>

        {/* Notifications */}
        {notifications.length > 0 && (
          <View style={styles.notificationsContainer}>
            <Text style={styles.sectionTitle}>🔔 Recent Updates</Text>
            
            {notifications.slice(0, 3).map((notification, index) => (
              <View key={index} style={styles.notificationCard}>
                <Text style={styles.notificationTitle}>{notification.title}</Text>
                <Text style={styles.notificationBody}>{notification.body}</Text>
                <Text style={styles.notificationTime}>
                  {formatTime(notification.timestamp)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#ef4444' }]} 
            onPress={handleStopTracking}
          >
            <Text style={styles.actionButtonText}>🛑 Stop Tracking</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#3b82f6' }]} 
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.actionButtonText}>🔙 Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
  },
  rideId: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  progressContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 4,
  },
  progressText: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  mapContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 15,
  },
  map: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  statusContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statusCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 20,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  locationContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  locationCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 20,
  },
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  locationValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  destinationContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  destinationCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 20,
  },
  destinationAddress: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 15,
    textAlign: 'center',
  },
  destinationCoords: {
    alignItems: 'center',
  },
  coordText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  notificationsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  notificationCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 5,
  },
  notificationBody: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
  },
  actionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  actionButton: {
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CompanionTrackingScreen;
