import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ColorValue } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ref, onValue, off, get, update } from 'firebase/database';
import { realtimeDb } from '../service/firebase';
import { useTheme } from '../service/themeContext';
import { LinearGradient } from 'expo-linear-gradient';
import RideRatingModal from './RideRatingModal';

const CarpoolWaiting = () => {
  const { isDarkMode } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { origin, destination, realtimeId } = route.params;

  const [rideStatus, setRideStatus] = useState('waiting');
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [estimatedArrival, setEstimatedArrival] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [rideData, setRideData] = useState<any>(null);

  useEffect(() => {
    if (!realtimeId) return;

    // Real-time listener for ride status and driver info
    const rideRef = ref(realtimeDb, `rideRequests/${realtimeId}`);
    
    const unsubscribe = onValue(rideRef, (snapshot) => {
      if (snapshot.exists()) {
        const rideData = snapshot.val();
        setRideStatus(rideData.status);
        
        if (rideData.driverAccepted && rideData.driverId) {
          setDriverInfo({
            name: rideData.driverName || 'Driver',
            phone: rideData.driverPhone || 'N/A',
            vehicle: rideData.vehicleInfo || {},
          });
          
          if (rideData.driverLocation) {
            setDriverLocation(rideData.driverLocation);
            calculateEstimatedArrival(rideData.driverLocation, destination);
          }
        }
        
        // Check if ride is completed and show rating modal
        if (rideData.status === 'completed' && !rideData.isRated) {
          setRideData(rideData);
          setRatingModalVisible(true);
        }
        
        setLoading(false);
      }
    });

    return () => {
      off(rideRef);
      unsubscribe();
    };
  }, [realtimeId, destination]);

  const calculateEstimatedArrival = (driverLoc: any, dest: any) => {
    if (!driverLoc || !dest) return;

    // Simple distance calculation (you can use a more sophisticated algorithm)
    const distance = Math.sqrt(
      Math.pow(driverLoc.latitude - dest.latitude, 2) +
      Math.pow(driverLoc.longitude - dest.longitude, 2)
    ) * 111; // Rough conversion to km

    const estimatedMinutes = Math.round(distance * 2); // Assuming 30 km/h average speed
    setEstimatedArrival(`${estimatedMinutes} minutes`);
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
                cancelledAt: new Date().toISOString(),
                cancelledBy: 'user',
              });
              
              Alert.alert('Ride Cancelled', 'Your ride has been cancelled successfully.');
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel ride. Please try again.');
            }
          },
        },
      ]
    );
  };

  const getStatusMessage = () => {
    switch (rideStatus) {
      case 'requested':
        return 'Looking for a driver...';
      case 'active':
        return 'Driver is on the way!';
      case 'completed':
        return 'Ride completed!';
      case 'cancelled':
        return 'Ride cancelled';
      default:
        return 'Processing your request...';
    }
  };

  const getStatusColor = (): [ColorValue, ColorValue, ...ColorValue[]] => {
    switch (rideStatus) {
      case 'requested':
        return ['#3b82f6', '#1d4ed8'];
      case 'active':
        return ['#10b981', '#059669'];
      case 'completed':
        return ['#8b5cf6', '#7c3aed'];
      case 'cancelled':
        return ['#ef4444', '#dc2626'];
      default:
        return ['#6b7280', '#4b5563'];
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, isDarkMode && styles.darkContainer]}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={[styles.loadingText, isDarkMode && styles.darkText]}>
          Finding your driver...
        </Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={getStatusColor()}
      style={[styles.container, isDarkMode && styles.darkContainer]}
    >
      <View style={styles.content}>
        <Text style={styles.statusTitle}>{getStatusMessage()}</Text>
        
        {driverInfo && (
          <View style={styles.driverCard}>
            <Text style={styles.driverTitle}>Your Driver</Text>
            <Text style={styles.driverName}>🚗 {driverInfo.name}</Text>
            <Text style={styles.driverPhone}>📞 {driverInfo.phone}</Text>
            
            {driverInfo.vehicle && Object.keys(driverInfo.vehicle).length > 0 && (
              <View style={styles.vehicleInfo}>
                <Text style={styles.vehicleTitle}>Vehicle Details:</Text>
                <Text style={styles.vehicleText}>
                  {driverInfo.vehicle.make} {driverInfo.vehicle.model} ({driverInfo.vehicle.color})
                </Text>
                <Text style={styles.vehicleText}>
                  License: {driverInfo.vehicle.licensePlate}
                </Text>
              </View>
            )}
          </View>
        )}

        {driverLocation && (
          <View style={styles.locationCard}>
            <Text style={styles.locationTitle}>Driver Location</Text>
            <Text style={styles.locationText}>
              📍 Lat: {driverLocation.latitude.toFixed(6)}
            </Text>
            <Text style={styles.locationText}>
              📍 Lng: {driverLocation.longitude.toFixed(6)}
            </Text>
            {estimatedArrival && (
              <Text style={styles.etaText}>
                ⏰ Estimated arrival: {estimatedArrival}
              </Text>
            )}
            
          </View>

          
        )}

        <View style={styles.routeInfo}>
          <Text style={styles.routeTitle}>Route Information</Text>
          <Text style={styles.routeText}>
            🚀 From: {origin.latitude.toFixed(6)}, {origin.longitude.toFixed(6)}
          </Text>
          <Text style={styles.routeText}>
            🎯 To: {destination.latitude.toFixed(6)}, {destination.longitude.toFixed(6)}
          </Text>
        </View>

        {rideStatus === 'requested' && (
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancelRide}>
            <Text style={styles.cancelButtonText}>Cancel Ride</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Rating Modal */}
      {rideData && (
        <RideRatingModal
          visible={ratingModalVisible}
          onClose={() => {
            setRatingModalVisible(false);
            // Navigate back after rating
            navigation.goBack();
          }}
          rideId={realtimeId}
          rideData={{
            from: `Location (${origin.latitude.toFixed(4)}, ${origin.longitude.toFixed(4)})`,
            to: `Location (${destination.latitude.toFixed(4)}, ${destination.longitude.toFixed(4)})`,
            driverName: driverInfo?.name || 'Driver',
            driverId: rideData.driverId || 'unknown',
            amount: '0',
            distance: '0',
            date: new Date().toDateString(),
            time: new Date().toTimeString(),
          }}
        />
      )}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  darkContainer: {
    backgroundColor: '#121212',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  statusTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 30,
  },
  driverCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  driverTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 15,
    textAlign: 'center',
  },
  driverName: {
    fontSize: 18,
    color: '#374151',
    marginBottom: 8,
  },
  driverPhone: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 15,
  },
  vehicleInfo: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 15,
  },
  vehicleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  vehicleText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  locationCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 15,
    textAlign: 'center',
  },
  locationText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  etaText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
    marginTop: 10,
    textAlign: 'center',
  },
  routeInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 30,
  },
  routeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 15,
    textAlign: 'center',
  },
  routeText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  cancelButton: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingText: {
    fontSize: 18,
    color: '#6b7280',
    marginTop: 20,
    textAlign: 'center',
  },
  darkText: {
    color: '#d1d5db',
  },
});

export default CarpoolWaiting;