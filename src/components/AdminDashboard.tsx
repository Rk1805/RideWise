import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../service/themeContext';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db } from '../service/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native';

interface RideData {
  id: string;
  userID: string;
  rideID: string;
  from: string;
  to: string;
  amount: string;
  distance: string;
  timestamp: string;
  type: string;
}

const AdminDashboard = () => {
  const navigation = useNavigation<any>();
  const { isDarkMode } = useTheme();
  const [rides, setRides] = useState<RideData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    checkAdminAuth();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchRides();
    }
  }, [filter, isAdmin]);

  const checkAdminAuth = async () => {
    try {
      const userType = (await AsyncStorage.getItem('userType')) || '';
      const adminStatus = (await AsyncStorage.getItem('isAdmin')) || '';
      
      console.log("DEBUG: userType=", userType, "isAdmin=", adminStatus);
  
      if (userType.toLowerCase() !== 'admin' || adminStatus !== 'true') {
        Alert.alert('Access Denied', 'You do not have permission to access this panel.');
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'LandingPage' }],
          })
        );
        return;
      }
  
      setIsAdmin(true);
    } catch (error) {
      console.error('Error checking admin auth:', error);
    }
  };
  

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('uid');
      await AsyncStorage.removeItem('userType');
      await AsyncStorage.removeItem('isAdmin');
      
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'LandingPage' }],
        })
      );
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const fetchRides = async () => {
    try {
      setLoading(true);
      const ridesRef = collection(db, 'history');
      const q = query(ridesRef, orderBy('timestamp', 'desc'));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const ridesData: RideData[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          ridesData.push({
            id: doc.id,
            userID: data.userID || data.userId || 'N/A',
            rideID: data.rideID || data.rideId || doc.id,
            from: data.from || 'N/A',
            to: data.to || 'N/A',
            amount: data.amount || '0',
            distance: data.distance || '0',
            timestamp: data.timestamp ? data.timestamp.toDate ? data.timestamp.toDate().toISOString() : data.timestamp.toString() : 'N/A',
            type: data.type || 'individual'
          } as RideData);
        });
        setRides(ridesData);
        setLoading(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error fetching rides:', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to fetch rides');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRides();
    setRefreshing(false);
  };

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  const handleDropdownAction = (action: 'ratings' | 'logout') => {
    setShowDropdown(false);
    if (action === 'ratings') {
      navigation.navigate('AdminRatingsScreen' as never);
    } else if (action === 'logout') {
      handleLogout();
    }
  };

  const renderRideItem = ({ item }: { item: RideData }) => (
    <View style={[styles.rideCard, isDarkMode && styles.darkRideCard]}>
      <View style={styles.rideHeader}>
        <Text style={[styles.detailLabel, isDarkMode && styles.darkText]}>Ride ID: {item.rideID}</Text>
        <Text style={[styles.detailLabel, isDarkMode && styles.darkText]}>Type: {item.type || 'N/A'}</Text>
      </View>
      
      <View style={styles.rideDetails}>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, isDarkMode && styles.darkText]}>User ID:</Text>
          <Text style={[styles.detailValue, isDarkMode && styles.darkText]}>{item.userID}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, isDarkMode && styles.darkText]}>From:</Text>
          <Text style={[styles.detailValue, isDarkMode && styles.darkText]}>{item.from || 'N/A'}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, isDarkMode && styles.darkText]}>To:</Text>
          <Text style={[styles.detailValue, isDarkMode && styles.darkText]}>{item.to || 'N/A'}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, isDarkMode && styles.darkText]}>Amount:</Text>
          <Text style={[styles.amountText, isDarkMode && styles.darkText]}>₹{item.amount || '0'}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, isDarkMode && styles.darkText]}>Distance:</Text>
          <Text style={[styles.detailValue, isDarkMode && styles.darkText]}>{item.distance || '0'} km</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, isDarkMode && styles.darkText]}>Timestamp:</Text>
          <Text style={[styles.detailValue, isDarkMode && styles.darkText]}>{item.timestamp || 'N/A'}</Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, isDarkMode && styles.darkBackground, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={[styles.loadingText, isDarkMode && styles.darkText]}>Loading rides...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDarkMode && styles.darkBackground]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.headerTitle, isDarkMode && styles.darkText]}>Admin Dashboard</Text>
            <Text style={[styles.headerSubtitle, isDarkMode && styles.darkText]}>
              Monitor all rides and system status
            </Text>
          </View>
          
          {/* Dropdown Menu Button */}
          <View style={styles.dropdownContainer}>
            <TouchableOpacity 
              style={styles.dropdownButton} 
              onPress={toggleDropdown}
            >
              <Text style={styles.dropdownButtonText}>⚙️ Menu</Text>
              <Text style={styles.dropdownArrow}>{showDropdown ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            
            {/* Dropdown Menu */}
            {showDropdown && (
              <View style={[styles.dropdownMenu, isDarkMode && styles.darkDropdownMenu]}>
                <TouchableOpacity 
                  style={styles.dropdownItem}
                  onPress={() => handleDropdownAction('ratings')}
                >
                  <Text style={[styles.dropdownItemText, isDarkMode && styles.darkDropdownItemText]}>
                    ⭐ Ratings
                  </Text>
                </TouchableOpacity>
                
                <View style={[styles.dropdownDivider, isDarkMode && styles.darkDropdownDivider]} />
                
                <TouchableOpacity 
                  style={styles.dropdownItem}
                  onPress={() => handleDropdownAction('logout')}
                >
                  <Text style={[styles.dropdownItemText, isDarkMode && styles.darkDropdownItemText]}>
                    🚪 Logout
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <View style={[styles.statCard, isDarkMode && styles.darkStatCard]}>
          <Text style={[styles.statNumber, isDarkMode && styles.darkText]}>{rides.length}</Text>
          <Text style={[styles.statLabel, isDarkMode && styles.darkText]}>Total Rides</Text>
        </View>
        
        <View style={[styles.statCard, isDarkMode && styles.darkStatCard]}>
          <Text style={[styles.statNumber, isDarkMode && styles.darkText]}>
            {rides.filter(ride => ride.type === 'carpool').length}
          </Text>
          <Text style={[styles.statLabel, isDarkMode && styles.darkText]}>Carpool</Text>
        </View>
        
        <View style={[styles.statCard, isDarkMode && styles.darkStatCard]}>
          <Text style={[styles.statNumber, isDarkMode && styles.darkText]}>
            {rides.filter(ride => ride.type === 'individual').length}
          </Text>
          <Text style={[styles.statLabel, isDarkMode && styles.darkText]}>Individual</Text>
        </View>
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.activeFilterButton]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.activeFilterText]}>All</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterButton, filter === 'pending' && styles.activeFilterButton]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterText, filter === 'pending' && styles.activeFilterText]}>Carpool</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterButton, filter === 'completed' && styles.activeFilterButton]}
          onPress={() => setFilter('completed')}
        >
          <Text style={[styles.filterText, filter === 'completed' && styles.activeFilterText]}>Individual</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={rides.filter(ride => {
          if (filter === 'all') return true;
          if (filter === 'pending') return ride.type === 'carpool';
          if (filter === 'completed') return ride.type === 'individual';
          return true;
        })}
        renderItem={renderRideItem}
        keyExtractor={(item) => item.id}
        style={styles.ridesList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, isDarkMode && styles.darkText]}>
              No rides found for the selected filter
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  darkBackground: {
    backgroundColor: '#000',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  dropdownContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  dropdownButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 100,
    justifyContent: 'space-between',
  },
  dropdownButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownArrow: {
    color: 'white',
    fontSize: 12,
    marginLeft: 8,
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    backgroundColor: 'white',
    borderRadius: 8,
    paddingVertical: 8,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    minWidth: 150,
  },
  darkDropdownMenu: {
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  darkDropdownItemText: {
    color: '#f9fafb',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 4,
  },
  darkDropdownDivider: {
    backgroundColor: '#374151',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  darkStatCard: {
    backgroundColor: '#1f2937',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
    marginRight: 10,
  },
  activeFilterButton: {
    backgroundColor: '#3b82f6',
  },
  filterText: {
    color: '#6b7280',
    fontWeight: '500',
  },
  activeFilterText: {
    color: 'white',
  },
  ridesList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  rideCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  darkRideCard: {
    backgroundColor: '#1f2937',
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },

  rideDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#1f2937',
    flex: 1,
    textAlign: 'right',
    marginLeft: 10,
  },
  amountText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#059669',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  darkText: {
    color: '#f9fafb',
  },
});

export default AdminDashboard;
