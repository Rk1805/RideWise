import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, StyleSheet, TouchableOpacity, 
  Alert, ActivityIndicator 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, writeBatch,getDoc } from 'firebase/firestore';
import { getDatabase, ref, push, set ,get,update} from 'firebase/database';
import { auth, db } from '../service/firebase';
import { useTheme } from '../service/themeContext';
import * as Location from 'expo-location';
import { navigate } from 'expo-router/build/global-state/routing';
import { UserX } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RideRequests = () => {
  const { isDarkMode } = useTheme();
  const navigation = useNavigation();
  
  const [rideRequests, setRideRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [driverAvailable, setDriverAvailable] = useState(false);
  const [isVerified, setIsVerified] = useState(false);


  useEffect(() => {
    const checkDriverStatus = async () => {
      const uid = await AsyncStorage.getItem('uid');
      if (!uid) return;

      const driverDoc = await getDoc(doc(db, 'drivers', uid));
      if (driverDoc.exists()) {
        const data = driverDoc.data();
        setDriverAvailable(data.status=== 'available'? true : false);
        setIsVerified(data.isVerified);
      } else {
        setDriverAvailable(false);
      }
    };

    checkDriverStatus();
  }, []);
  
  useEffect(() => {
    fetchRideRequests();
  }, []);
  
  const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const toRad = (val) => (val * Math.PI) / 180;
    const R = 6371; // Earth radius in km
  
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
  
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };
  
  const fetchRideRequests = async () => {
    try {
      setLoading(true);
  
      // Get driver's current location
      console.log('Requesting location permissions...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location permission denied');
        console.error('Location permission denied');
        return;
      }
      console.log('Fetching current location...');
      const {
        coords: { latitude: driverLat, longitude: driverLon },
      } = await Location.getCurrentPositionAsync({});

      console.log(`Driver's location: ${driverLat}, ${driverLon}`);
  
      const db = getDatabase();
      const snapshot = await get(ref(db, 'rideRequests'));
      console.log(snapshot.val()); 
  
      if (snapshot.exists()) {
        const data = snapshot.val();
        const filtered = [];
  
        Object.entries(data).forEach(([key, value]) => {
          if (
            value.status === 'requested' &&
            value.startLat &&
            value.startLong
          ) {
            const distance = haversineDistance(
              driverLat,
              driverLon,
              value.startLat,
              value.startLong
            );
            console.log(`Distance to ${key}: ${distance} km`);
  
            if (distance <= 25) {
              filtered.push({
                id: key,
                ...value,
                dist: distance.toFixed(2)
              });
            }
          }
        });
        console.log(filtered);
        setRideRequests(filtered);
      } else {
        setRideRequests([]);
      }
    } catch (err) {
      console.error("Error fetching ride requests:", err);
      Alert.alert("Failed", "Could not fetch ride requests");
    } finally {
      setLoading(false);
    }
  };
  
  // New function to reset rejected rides to requested
  const resetRejectedRides = async () => {
    try {
      setLoading(true);
      
      // Fetch rejected rides
      const rejectedQuery = query(
        collection(db, 'carpool'),
        where('status', '==', 'rejected')
      );
      
      const rejectedSnapshot = await getDocs(rejectedQuery);
      
      if (rejectedSnapshot.empty) {
        Alert.alert('Info', 'No rejected rides to reset');
        setLoading(false);
        return;
      }
      
      // Use batch to update multiple documents
      const batch = writeBatch(db);
      let count = 0;
      
      rejectedSnapshot.forEach((document) => {
        batch.update(doc(db, 'carpool', document.id), {
          status: 'requested',
          rejectedBy: null,
          rejectedAt: null
        });
        count++;
      });
      
      await batch.commit();
      Alert.alert('Success', `${count} rejected rides have been reset and are now available`);
      
      // Refresh the list to show the newly available rides
      fetchRideRequests();
      
    } catch (error) {
      console.error('Error resetting rejected rides:', error);
      Alert.alert('Error', `Failed to reset rejected rides: ${error.message}`);
      setLoading(false);
    }
  };
  
  const fetchAllRides = async () => {
    try {
      setLoading(true);
      
      // Fetch both requested and rejected rides
      const q = query(
        collection(db, 'carpool'),
        where('status', 'in', ['requested', 'rejected'])
      );
      
      const querySnapshot = await getDocs(q);
      const requests = [];
      
      querySnapshot.forEach((doc) => {
        requests.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setRideRequests(requests);
      Alert.alert('Refreshed', `Found ${requests.length} rides (including rejected)`);
    } catch (error) {
      console.error('Error fetching all rides:', error);
      Alert.alert('Error', 'Could not load all ride requests');
    } finally {
      setLoading(false);
    }
  };
  
  const handleAcceptRide = async (rideId) => {
    if (!auth.currentUser) return;
  
    try {
      setProcessingId(rideId);
      
      const uid=await AsyncStorage.getItem('uid');
      const driverRef = doc(collection(db, 'drivers'), uid);
      const driverSnap = await getDoc(driverRef);
  
      let driverData;
      let vehicleInfo;
      if (driverSnap.exists()) {
         driverData = driverSnap.data();
         console.log("Driver Data:", driverData);
         vehicleInfo = driverData.vehicleInfo;
        
        console.log("Vehicle Info:", vehicleInfo);
      }
      const dbRT = getDatabase();
      const rideRef = ref(dbRT, `rideRequests/${rideId}`);
      const rideSnap = await get(rideRef);
  
      if (!rideSnap.exists()) {
        throw new Error("Ride not found");
      }
  
      const rideData = rideSnap.val();
      const origin = {
        latitude: rideData.startLat,
        longitude: rideData.startLong
      };
      const destination = {
        latitude: rideData.endLat,
        longitude: rideData.endLong
      };
      let driverName
      
      const driverDoc = await getDoc(doc(db, 'drivers', uid));
      if (driverDoc.exists()) {
          const driverData = driverDoc.data();
          driverName = driverData.username;
      } else {
          driverName = 'Driver';
      }
      const timestamp = new Date();
  
      // ✅ Get driver current location using expo-location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission not granted');
      }
  
      const {
        coords: { latitude, longitude },
      } = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
  
      // ✅ Update ride request in Realtime DB
      await update(rideRef, {
        status: 'active',
        driverId: auth.currentUser.uid,
        driverName: driverName,
        driverPhone: auth.currentUser.phoneNumber || 'N/A',
        driverLocation: {
          latitude,
          longitude,
        },
        vehicleInfo: {
          make: vehicleInfo.make,
          model: vehicleInfo.model,
          color: vehicleInfo.color,
          licensePlate: vehicleInfo.licensePlate,
          year: vehicleInfo.year,
        },
        driverAccepted: true,
      });
  
      setRideRequests(prev => prev.filter(ride => ride.id !== rideId));
      Alert.alert('Success', 'Ride accepted successfully!');
      navigation.navigate('DriverRouteScreen', {
        origin,
        destination,
        realtimeId: rideId,
      });
  
    } catch (error) {
      console.error('Error accepting ride:', error);
      Alert.alert('Error', `Failed to accept ride: ${error.message}`);
    } finally {
      setProcessingId(null);
    }
  };
  

  const handleRejectRide = async (rideId) => {
    if (!auth.currentUser) return;
  
    try {
      setProcessingId(rideId);
  
      const dbRT = getDatabase();
      const rideRef = ref(dbRT, `rideRequests/${rideId}`);
      const rideSnap = await get(rideRef);
  
      if (!rideSnap.exists()) {
        throw new Error("Ride not found");
      }
  
      await update(rideRef, {
        status: 'rejected',
        rejectedBy: auth.currentUser.uid,
        rejectedAt: new Date().toISOString()
      });
  
      // ✅ Update UI
      setRideRequests(prev => prev.filter(ride => ride.id !== rideId));
      Alert.alert('Success', 'Ride request rejected');
    } catch (error) {
      console.error('Error rejecting ride:', error);
      Alert.alert('Error', `Failed to reject ride: ${error.message}`);
    } finally {
      setProcessingId(null);
    }
  };
  
  const styles = getStyles(isDarkMode);
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading requests...</Text>
      </View>
    );
  }

  if (!driverAvailable) {
    return (
      <View style={styles.container}>
        <View style={styles.iconWrapper}>
          <UserX size={60} color="#9ca3af" />
        </View>
        <Text style={styles.title}>You're Unavailable</Text>
        <Text style={styles.subtitle}>
          To receive ride requests, please change your status to available.
        </Text>
      </View>
    );
  }
  if (!isVerified) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-lg font-semibold text-gray-600">You are not verified . Verify your details first</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>         Available Ride Requests</Text>
      </View>
      
      {rideRequests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No ride requests available</Text>
          <View style={styles.refreshButtonGroup}>
            <TouchableOpacity style={styles.refreshButton} onPress={fetchRideRequests}>
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.refreshButton, styles.advancedRefreshButton]} 
              onPress={resetRejectedRides}
            >
              <Text style={styles.refreshButtonText}>Reset Rejected Rides</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={rideRequests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.headerRow}>
                <Text style={styles.routeText}>{item.from} → {item.to}</Text>
                <View style={[
                  styles.statusBadge,
                  item.status === 'rejected' ? styles.rejectedBadge : styles.requestedBadge
                ]}>
                  <Text style={styles.statusText}>
                    {item.status === 'rejected' ? 'Rejected' : 'Requested'}
                  </Text>
                </View>
              </View>
              
              <Text style={styles.dateText}>{item.date} at {item.time}</Text>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Distance from you:</Text>
                <Text style={styles.detailValue}>{item.dist || 'Not specified'} km</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Route Distance :</Text>
                <Text style={styles.detailValue}>{item.distance || 'Not specified'} km</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Est. Fare:</Text>
                <Text style={styles.detailValue}>{item.amount || 'Not calculated'}</Text>
              </View>
              
              {/* Only show action buttons for non-rejected rides */}
              {item.status !== 'Completed' && (
                <View style={styles.buttonRow}>
                  <TouchableOpacity 
                    style={styles.acceptButton}
                    onPress={() => handleAcceptRide(item.id)}
                    disabled={processingId === item.id}
                  >
                    {processingId === item.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>Accept</Text>
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.rejectButton}
                    onPress={() => handleRejectRide(item.id)}
                    disabled={processingId === item.id}
                  >
                    <Text style={styles.buttonText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
};

const getStyles = (isDarkMode) => StyleSheet.create({
  // Styles remain the same
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: isDarkMode ? '#121212' : '#f9f9f9',
  },
  iconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: isDarkMode ? '#121212' : '#f9f9f9',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: isDarkMode ? '#d1d5db' : '#4b5563',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: isDarkMode ? '#f3f4f6' : '#1f2937',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: isDarkMode ? '#9ca3af' : '#6b7280',
    marginBottom: 16,
  },
  refreshButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  card: {
    backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDarkMode ? 0.3 : 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  routeText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: isDarkMode ? '#f3f4f6' : '#1f2937',
  },
  dateText: {
    fontSize: 16,
    color: isDarkMode ? '#d1d5db' : '#4b5563',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: isDarkMode ? '#9ca3af' : '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: isDarkMode ? '#d1d5db' : '#4b5563',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  acceptButton: {
    backgroundColor: '#10b981',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  refreshButtonGroup: {
    flexDirection: 'row',
    marginTop: 12,
  },
  advancedRefreshButton: {
    backgroundColor: '#6366f1',
    marginLeft: 8,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  requestedBadge: {
    backgroundColor: '#3b82f6',
  },
  rejectedBadge: {
    backgroundColor: '#ef4444',
  },
  statusText: {
    color: 'white',
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 8,
    color: '#6b7280', // Tailwind's gray-500
    textAlign: 'center',
  },
});

export default RideRequests;