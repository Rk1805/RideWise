import React from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useTheme } from '../service/themeContext';
import { db, auth } from '../service/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import RideRatingModal from './RideRatingModal';

interface RideData {
  id: string;
  date: string;
  time: string;
  from: string;
  to: string;
  driverName?: string;
  driverId?: string;
  amount?: string;
  status?: string;
  type?: string;
  rideID?: string;
  userID?: string;
  isRated?: boolean;
  userRating?: number;
  userComment?: string;
  ratedAt?: Date;
}

const RideHistory = () => {
  const { isDarkMode } = useTheme();
  const [rideData, setRideData] = useState<RideData[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedRide, setSelectedRide] = useState<RideData | null>(null);
  const navigation = useNavigation<any>();

  const fetchRideHistory = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.log('No user is currently logged in.');
        setLoading(false);
        return;
      }

      const q = query(collection(db, 'history'), where('userID', '==', user.uid));
      const querySnapshot = await getDocs(q);

      const rides: RideData[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        rides.push({
          id: doc.id,
          date: data.date || data.timestamp?.toDate?.()?.toDateString() || 'N/A',
          time: data.time || data.timestamp?.toDate?.()?.toTimeString() || 'N/A',
          from: data.from || 'N/A',
          to: data.to || 'N/A',
          driverName: data.driverName || 'N/A',
          driverId: data.driverId || data.driverID || 'N/A',
          amount: data.amount || '0',
          status: data.status || 'N/A',
          type: data.type || 'individual',
          rideID: data.rideID || data.rideId || doc.id,
          userID: data.userID || data.userId || 'N/A',
          isRated: data.isRated || false,
          userRating: data.userRating || 0,
          userComment: data.userComment || '',
          ratedAt: data.ratedAt || null
        } as RideData);
      });
      console.log('Fetched rides:', rides);

      rides.sort((a, b) => new Date(b.date + ' ' + b.time).getTime() - new Date(a.date + ' ' + a.time).getTime());
      setRideData(rides);
    } catch (error) {
      // Error fetching ride history
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRideHistory();
  }, []);

  // Auto-show rating modal for newly completed rides
  useEffect(() => {
    const newlyCompletedRide = rideData.find(ride => 
      ride.status === 'Completed' && !ride.isRated
    );
    
    if (newlyCompletedRide) {
      setSelectedRide(newlyCompletedRide);
      setRatingModalVisible(true);
    }
  }, [rideData]);

  const formatDateTime = (dateStr: string, timeStr: string) => {
    try {
      const dt = new Date(`${dateStr} ${timeStr}`);
      return new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(dt);
    } catch {
      return `${dateStr} at ${timeStr}`;
    }
  };

  const getStatusStyle = (status: string) => ({
    ...styles.statusBadge,
    backgroundColor: status === 'Completed' ? '#10b98133' : '#ef444433',
    color: status === 'Completed' ? '#10b981' : '#ef4444',
  });

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#1f2937' : '#f3f4f6' }]}>
      <Text style={[styles.header, { color: isDarkMode ? '#93c5fd' : '#3b82f6' }]}>Your Ride History</Text>

      {loading ? (
        <ActivityIndicator size="large" color={isDarkMode ? '#60a5fa' : '#2563eb'} />
      ) : rideData.length === 0 ? (
        <Text style={[styles.emptyText, { color: isDarkMode ? '#e5e7eb' : '#374151' }]}>
          No completed or cancelled rides found.
        </Text>
      ) : (
        <FlatList
          data={rideData}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View
              style={[
                styles.rideCard,
                { backgroundColor: isDarkMode ? '#374151' : '#ffffff' },
              ]}
            >
              <View style={styles.rideInfo}>
                <Text style={[styles.dateText, { color: isDarkMode ? '#f3f4f6' : '#111827' }]}>
                  {formatDateTime(item.date, item.time)}
                </Text>

                <Text style={[styles.routeText, { color: isDarkMode ? '#f9fafb' : '#1f2937' }]}>
                  {item.from} → {item.to}
                </Text>

                {item.driverName && (
                  <Text style={[styles.subText, { color: isDarkMode ? '#d1d5db' : '#4b5563' }]}>
                    Driver: {item.driverName}
                  </Text>
                )}

                {item.amount && (
                  <Text style={[styles.subText, { color: isDarkMode ? '#d1d5db' : '#4b5563' }]}>
                    Cost: ₹{item.amount}
                  </Text>
                )}
                
                {/* Rating Button for Completed Rides */}
                {item.status === 'Completed' && !item.isRated && (
                  <TouchableOpacity
                    style={styles.rateButton}
                    onPress={() => {
                      setSelectedRide(item);
                      setRatingModalVisible(true);
                    }}
                  >
                    <Text style={styles.rateButtonText}>⭐ Rate This Ride</Text>
                  </TouchableOpacity>
                )}
                
                {/* Share Ride Button for Active/Recent Rides */}
                {(item.status === 'Accepted' || item.status === 'Started' || item.status === 'Completed') && (
                  <TouchableOpacity
                    style={[styles.rateButton, { backgroundColor: '#10b981', marginTop: 8 }]}
                    onPress={() => {
                      navigation.navigate('RideSharing', {
                        rideId: item.rideID || item.id,
                        from: item.from,
                        to: item.to,
                        driverName: item.driverName,
                        driverPhone: 'N/A',
                        cabNumber: 'N/A',
                        estimatedArrival: new Date(),
                        rideStatus: item.status || 'Unknown'
                      });
                    }}
                  >
                    <Text style={styles.rateButtonText}>📤 Share Ride</Text>
                  </TouchableOpacity>
                )}
                
                {/* Show Rating if Already Rated */}
                {item.status === 'Completed' && item.isRated && item.userRating && (
                  <View style={styles.ratingDisplay}>
                    <Text style={[styles.ratingText, { color: isDarkMode ? '#fbbf24' : '#d97706' }]}>
                      {'★'.repeat(item.userRating)}{'☆'.repeat(5 - item.userRating)}
                    </Text>
                    <Text style={[styles.ratedText, { color: isDarkMode ? '#9ca3af' : '#6b7280' }]}>
                      Rated {item.userRating}/5
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        />
      )}
      
      {/* Rating Modal */}
      {selectedRide && (
        <RideRatingModal
          visible={ratingModalVisible}
          onClose={() => {
            setRatingModalVisible(false);
            setSelectedRide(null);
            // Refresh ride history to show updated rating
            fetchRideHistory();
          }}
          rideId={selectedRide.rideID || selectedRide.id}
          rideData={{
            from: selectedRide.from,
            to: selectedRide.to,
            driverName: selectedRide.driverName || 'Unknown Driver',
            driverId: selectedRide.driverId || selectedRide.id,
            amount: selectedRide.amount || '0',
            distance: '0', // You might want to add distance to RideData interface
            date: selectedRide.date,
            time: selectedRide.time,
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 20,
  },
  rideCard: {
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  rideInfo: {
    flexDirection: 'column',
  },
  dateText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  routeText: {
    fontSize: 18,
    fontWeight: '600',
    marginVertical: 4,
  },
  subText: {
    fontSize: 14,
    marginTop: 2,
  },
  statusBadge: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    fontWeight: 'bold',
    overflow: 'hidden',
    fontSize: 13,
  },
  rateButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  rateButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  ratingDisplay: {
    marginTop: 12,
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 18,
    marginBottom: 4,
  },
  ratedText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});

export default RideHistory;
