import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ref, onValue, off, update } from 'firebase/database';
import { realtimeDb } from '../service/firebase';
import { useTheme } from '../service/themeContext';
import locationTrackingService from '../service/locationTrackingService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const DriverRouteScreen = () => {
  const { isDarkMode } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { origin, destination, realtimeId } = route.params;

  const [rideStatus, setRideStatus] = useState('active');
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [rideData, setRideData] = useState<any>(null);
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    if (!realtimeId) return;

    // Real-time listener for ride updates
    const rideRef = ref(realtimeDb, `rideRequests/${realtimeId}`);
    
    const unsubscribe = onValue(rideRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setRideData(data);
        setRideStatus(data.status);
        
        if (data.driverLocation) {
          setCurrentLocation(data.driverLocation);
        }
      }
    });

    return () => {
      off(rideRef);
      unsubscribe();
    };
  }, [realtimeId]);

  // Start location tracking when component mounts
  useEffect(() => {
    const startTracking = async () => {
      try {
        const uid = await AsyncStorage.getItem('uid');
        if (uid && realtimeId) {
          await locationTrackingService.startDriverTracking(realtimeId, uid);
          setIsTracking(true);
          console.log('🚗 Location tracking started in DriverRouteScreen');
        }
      } catch (error) {
        console.error('Error starting location tracking:', error);
      }
    };

    startTracking();

    // Cleanup tracking when component unmounts
    return () => {
      if (isTracking) {
        locationTrackingService.stopTracking();
        setIsTracking(false);
      }
    };
  }, [realtimeId]);

  const handleStartRide = async () => {
    try {
      const rideRef = ref(realtimeDb, `rideRequests/${realtimeId}`);
      await update(rideRef, {
        status: 'in_progress',
        rideStartedAt: new Date().toISOString(),
        rideStarted: true,
      });

      setRideStatus('in_progress');
      Alert.alert('Ride Started', 'You have started the ride. Safe driving!');
    } catch (error) {
      Alert.alert('Error', 'Failed to start ride. Please try again.');
    }
  };

  const handleCompleteRide = async () => {
    try {
      const rideRef = ref(realtimeDb, `rideRequests/${realtimeId}`);
      await update(rideRef, {
        status: 'completed',
        rideCompletedAt: new Date().toISOString(),
        rideCompleted: true,
      });

      // ✅ Also update the Firestore history collection
      try {
        const { collection, query, where, getDocs, updateDoc } = await import('firebase/firestore');
        const { db } = await import('../service/firebase');
        
        const historyQuery = query(
          collection(db, 'history'),
          where('rideID', '==', realtimeId)
        );
        
        const historySnapshot = await getDocs(historyQuery);
        if (!historySnapshot.empty) {
          const historyDoc = historySnapshot.docs[0];
          await updateDoc(historyDoc.ref, {
            status: 'completed',
            rideCompleted: true,
            rideCompletedAt: new Date(),
          });
          console.log('✅ Updated Firestore history with ride completion');
        }
      } catch (historyError) {
        console.log('Could not update Firestore history:', historyError);
      }

      // Stop location tracking
      locationTrackingService.stopTracking();
      setIsTracking(false);

      setRideStatus('completed');
      Alert.alert(
        'Ride Completed', 
        'Ride has been completed successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('DriverDashboard' as never)
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to complete ride. Please try again.');
    }
  };

  const handleCancelRide = async () => {
    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this ride?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            try {
              const rideRef = ref(realtimeDb, `rideRequests/${realtimeId}`);
              await update(rideRef, {
                status: 'cancelled',
                rideCancelledAt: new Date().toISOString(),
                rideCancelled: true,
              });

              // Stop location tracking
              locationTrackingService.stopTracking();
              setIsTracking(false);

              setRideStatus('cancelled');
              Alert.alert('Ride Cancelled', 'Ride has been cancelled.');
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel ride. Please try again.');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = () => {
    switch (rideStatus) {
      case 'active':
        return '#10b981';
      case 'in_progress':
        return '#3b82f6';
      case 'completed':
        return '#8b5cf6';
      case 'cancelled':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getStatusMessage = () => {
    switch (rideStatus) {
      case 'active':
        return 'Heading to pickup location';
      case 'in_progress':
        return 'Ride in progress';
      case 'completed':
        return 'Ride completed';
      case 'cancelled':
        return 'Ride cancelled';
      default:
        return 'Processing ride';
    }
  };

  return (
    <View style={[styles.container, isDarkMode && styles.darkContainer]}>
      <View style={styles.header}>
        <Text style={[styles.title, isDarkMode && styles.darkText]}>
          Driver Route
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusText}>{getStatusMessage()}</Text>
        </View>
      </View>

      <View style={[styles.infoCard, isDarkMode && styles.darkCard]}>
        <Text style={[styles.cardTitle, isDarkMode && styles.darkText]}>
          Route Information
        </Text>
        
        <View style={styles.routeInfo}>
          <Text style={[styles.routeLabel, isDarkMode && styles.darkText]}>
            🚀 Pickup Location:
          </Text>
          <Text style={[styles.routeValue, isDarkMode && styles.darkText]}>
            {origin.latitude.toFixed(6)}, {origin.longitude.toFixed(6)}
          </Text>
        </View>

        <View style={styles.routeInfo}>
          <Text style={[styles.routeLabel, isDarkMode && styles.darkText]}>
            🎯 Destination:
          </Text>
          <Text style={[styles.routeValue, isDarkMode && styles.darkText]}>
            {destination.latitude.toFixed(6)}, {destination.longitude.toFixed(6)}
          </Text>
        </View>

        {currentLocation && (
          <View style={styles.routeInfo}>
            <Text style={[styles.routeLabel, isDarkMode && styles.darkText]}>
              📍 Your Current Location:
            </Text>
            <Text style={[styles.routeValue, isDarkMode && styles.darkText]}>
              {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
            </Text>
            <Text style={[styles.timestamp, isDarkMode && styles.darkText]}>
              Last updated: {new Date(currentLocation.timestamp).toLocaleTimeString()}
            </Text>
          </View>
        )}

        {rideData && (
          <View style={styles.rideInfo}>
            <Text style={[styles.rideLabel, isDarkMode && styles.darkText]}>
              Passenger: {rideData.userName || 'Anonymous'}
            </Text>
            <Text style={[styles.rideLabel, isDarkMode && styles.darkText]}>
              Estimated Fare: ₹{rideData.amount || 'N/A'}
            </Text>
            <Text style={[styles.rideLabel, isDarkMode && styles.darkText]}>
              Distance: {rideData.distance || 'N/A'} km
            </Text>
          </View>
        )}
      </View>

      <View style={styles.actionButtons}>
        {rideStatus === 'active' && (
          <TouchableOpacity style={styles.startButton} onPress={handleStartRide}>
            <Text style={styles.buttonText}>Start Ride</Text>
          </TouchableOpacity>
        )}

        {rideStatus === 'in_progress' && (
          <TouchableOpacity style={styles.completeButton} onPress={handleCompleteRide}>
            <Text style={styles.buttonText}>Complete Ride</Text>
          </TouchableOpacity>
        )}

        {(rideStatus === 'active' || rideStatus === 'in_progress') && (
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancelRide}>
            <Text style={styles.cancelButtonText}>Cancel Ride</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.trackingStatus, isDarkMode && styles.darkCard]}>
        <Text style={[styles.trackingText, isDarkMode && styles.darkText]}>
          {isTracking ? '🟢 Location tracking active' : '🔴 Location tracking inactive'}
        </Text>
        <Text style={[styles.trackingSubtext, isDarkMode && styles.darkText]}>
          Your location is being shared with the passenger
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    padding: 20,
  },
  darkContainer: {
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  darkText: {
    color: '#f3f4f6',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  darkCard: {
    backgroundColor: '#1f1f1f',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 15,
  },
  routeInfo: {
    marginBottom: 15,
  },
  routeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 5,
  },
  routeValue: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'monospace',
  },
  timestamp: {
    fontSize: 10,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginTop: 5,
  },
  rideInfo: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 15,
    marginTop: 15,
  },
  rideLabel: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 5,
  },
  actionButtons: {
    marginBottom: 20,
  },
  startButton: {
    backgroundColor: '#10b981',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  completeButton: {
    backgroundColor: '#8b5cf6',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  cancelButton: {
    backgroundColor: '#ef4444',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  trackingStatus: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  trackingText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 5,
  },
  trackingSubtext: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
});

export default DriverRouteScreen;
