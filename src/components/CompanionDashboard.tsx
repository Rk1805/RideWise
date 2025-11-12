import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../service/themeContext';
import { companionService } from '../service/companionService';
import { companionTrackingService } from '../service/companionTrackingService';
import { notificationService } from '../service/notificationService';
import { auth } from '../service/firebase';

interface TravelerLink {
  id: string;
  travelerName: string;
  status: string;
  createdAt: Date;
}

interface ActiveTracking {
  id: string;
  travelerName: string;
  rideId: string;
  destination: string;
  status: string;
  startTime: Date;
  currentLocation?: {
    latitude: number;
    longitude: number;
    timestamp: number;
  };
  estimatedArrival?: number;
}

const CompanionDashboard = () => {
  const { isDarkMode } = useTheme();
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalLinks: 0,
    activeLinks: 0,
    totalTrackingSessions: 0,
    completedTrackingSessions: 0,
  });
  const [activeLinks, setActiveLinks] = useState<TravelerLink[]>([]);
  const [activeTracking, setActiveTracking] = useState<ActiveTracking[]>([]);

  // Function to check for new active rides
  const checkForNewActiveRides = async () => {
    try {
      // Check for new active rides from linked travelers
      const newRides = await companionService.checkForActiveRidesFromLinkedTravelers();
      
      if (newRides.length > 0) {
        console.log(`🆕 Found ${newRides.length} new active rides:`, newRides);
        
        // Update the active tracking list with new rides
        setActiveTracking(prev => {
          const existingRideIds = new Set(prev.map(t => t.rideId));
          const newTrackingData = newRides
            .filter(ride => !existingRideIds.has(ride.rideId))
            .map(ride => ({
              id: ride.id,
              rideId: ride.rideId,
              travelerName: companionService.getTravelerNameFromId(ride.travelerId),
              status: ride.status,
              startTime: new Date(ride.startTime),
              destination: ride.destination.address,
              currentLocation: ride.currentLocation ? {
                latitude: ride.currentLocation.latitude,
                longitude: ride.currentLocation.longitude,
                timestamp: ride.currentLocation.timestamp.getTime(),
              } : undefined,
              estimatedArrival: ride.estimatedArrival ? ride.estimatedArrival.getTime() : undefined,
            }));
          
          return [...prev, ...newTrackingData];
        });

        // Start real-time tracking for new rides
        newRides.forEach(ride => {
          companionTrackingService.subscribeToTrackingUpdates(ride.rideId, (trackingData) => {
            if (trackingData) {
              setActiveTracking(prev => 
                prev.map(t => 
                  t.rideId === ride.rideId 
                    ? {
                        ...t,
                        status: trackingData.status,
                        currentLocation: trackingData.currentLocation ? {
                          latitude: trackingData.currentLocation.latitude,
                          longitude: trackingData.currentLocation.longitude,
                          timestamp: trackingData.currentLocation.timestamp,
                        } : undefined,
                        estimatedArrival: trackingData.estimatedArrival,
                      }
                    : t
                )
              );
            }
          });
        });
      }
    } catch (error) {
      // Error checking for new active rides
    }
  };

  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        console.log('🚀 Initializing companion dashboard...');
        
        // Initialize companion service for current user
        await companionService.initializeForUser();
        console.log('✅ Companion service initialized');
        
        // Initialize companion tracking service
        await companionTrackingService.initializeForUser();
        console.log('✅ Companion tracking service initialized');
        
        // Load dashboard data
        await loadDashboardData();
        console.log('✅ Dashboard data loaded');
      } catch (error) {
        Alert.alert('Initialization Error', 'Failed to initialize dashboard. Please try again.');
      }
    };
    
    initializeDashboard();
  }, []);

  // Set up real-time listener for new ride requests
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let intervalId: NodeJS.Timeout | null = null;
    
    const setupRealtimeListener = () => {
      try {
        const { ref, onValue } = require('firebase/database');
        const { realtimeDb } = require('../service/firebase');
        
        const rideRequestsRef = ref(realtimeDb, 'rideRequests');
        unsubscribe = onValue(rideRequestsRef, async (snapshot: any) => {
          try {
            if (snapshot.exists()) {
              console.log('🆕 Real-time update: New ride data detected');
              // Check for new rides when real-time data changes
              await checkForNewActiveRides();
              
              // Also refresh the dashboard data to show new rides immediately
              await loadDashboardData();
            }
          } catch (listenerError) {
            // Error in real-time listener callback
          }
        }, (error: any) => {
          // Real-time listener error
        });

        console.log('✅ Real-time listener set up for ride requests');
      } catch (error) {
        // Error setting up real-time listener
      }
    };

    const setupPeriodicCheck = () => {
      // Check for new rides every 10 seconds as a backup
      intervalId = setInterval(async () => {
        try {
          console.log('🔄 Periodic check for new active rides...');
          await checkForNewActiveRides();
        } catch (error) {
          // Error in periodic check
        }
      }, 10000) as any; // 10 seconds
    };

    setupRealtimeListener();
    setupPeriodicCheck();

    // Cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
        console.log('🧹 Real-time listener cleaned up');
      }
      if (intervalId) {
        clearInterval(intervalId);
        console.log('🧹 Periodic check cleaned up');
      }
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Check if companion profile exists
      if (!companionService.hasCompanionProfile()) {
        console.log('⚠️ No companion profile found. User may need to create one.');
        Alert.alert(
          'Companion Profile Required',
          'You need to create a companion profile to use this feature. Please contact support or try logging in again.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Load companion stats
      const companionStats = await companionService.getCompanionStats();
      setStats(companionStats);

      // Load active links
      const links = companionService.getActiveLinks();
      console.log('Active links loaded:', links);
      setActiveLinks(links);

      // Load active tracking from tracking service
      const tracking = companionTrackingService.getActiveTracking();
      console.log('Explicit tracking data:', tracking);
      
      // Also check for active rides from linked travelers
      const linkedTravelerRides = await companionService.checkForActiveRidesFromLinkedTravelers();
      console.log('Linked traveler rides found:', linkedTravelerRides);
      
      // Combine both sources of tracking data
      const allTracking: ActiveTracking[] = [
        ...tracking.map(t => ({
          id: t.id,
          rideId: t.rideId,
          travelerName: 'Active Tracking', // Default name for tracking service data
          status: t.status,
          startTime: new Date(t.startTime),
          destination: t.destination?.address || 'Unknown destination',
          currentLocation: t.currentLocation,
          estimatedArrival: t.estimatedArrival,
        })),
        ...linkedTravelerRides.map(ride => ({
          id: ride.id,
          rideId: ride.rideId,
          travelerName: companionService.getTravelerNameFromId(ride.travelerId),
          status: ride.status,
          startTime: ride.startTime,
          destination: ride.destination.address,
          currentLocation: ride.currentLocation ? {
            latitude: ride.currentLocation.latitude,
            longitude: ride.currentLocation.longitude,
            timestamp: ride.currentLocation.timestamp.getTime(),
          } : undefined,
          estimatedArrival: ride.estimatedArrival ? ride.estimatedArrival.getTime() : undefined,
        }))
      ];
      
      console.log('Combined tracking data:', allTracking);
      setActiveTracking(allTracking);

      // Start real-time tracking updates for active rides
      if (allTracking.length > 0) {
        allTracking.forEach(track => {
          // Subscribe to real-time updates for this ride
          companionTrackingService.subscribeToTrackingUpdates(track.rideId, (trackingData) => {
            if (trackingData) {
              // Update the tracking data in real-time
              setActiveTracking(prev => 
                prev.map(t => 
                  t.rideId === track.rideId 
                    ? {
                        ...t,
                        status: trackingData.status,
                        currentLocation: trackingData.currentLocation ? {
                          latitude: trackingData.currentLocation.latitude,
                          longitude: trackingData.currentLocation.longitude,
                          timestamp: trackingData.currentLocation.timestamp,
                        } : undefined,
                        estimatedArrival: trackingData.estimatedArrival,
                      }
                    : t
                )
              );
            }
          });
        });
      }

    } catch (error) {
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handleManualRefresh = async () => {
    try {
      setLoading(true);
      // Force refresh of tracking data
      await companionService.checkForActiveRidesFromLinkedTravelers();
      await loadDashboardData();
      Alert.alert('Success', 'Tracking data refreshed successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh tracking data');
    } finally {
      setLoading(false);
    }
  };

  const handleDebugRideData = async () => {
    try {
      console.log('🔍 Starting debug ride data...');
      await companionService.debugRideDataStructure();
      Alert.alert('Debug Complete', 'Check console for detailed debug information');
    } catch (error) {
      Alert.alert('Debug Error', 'Failed to run debug');
    }
  };

  const handleAcceptAllPending = async () => {
    try {
      setLoading(true);
      await companionService.acceptAllPendingLinks();
      await loadDashboardData();
      Alert.alert('Success', 'All pending links accepted successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to accept pending links');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkToTraveler = () => {
    (navigation as any).navigate('LinkToTraveler');
  };

  const handleViewTracking = (rideId: string) => {
    console.log('🚗 Navigating to tracking screen with rideId:', rideId);
    (navigation as any).navigate('CompanionTrackingScreen', { rideId });
  };

  const handleViewRideHistory = () => {
    (navigation as any).navigate('CompanionRideHistory');
  };

  const handleSettings = () => {
    (navigation as any).navigate('CompanionSettings');
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await auth.signOut();
              (navigation as any).reset({
                index: 0,
                routes: [{ name: 'LandingPage' }],
              });
            } catch (error) {
              // Logout error
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'tracking':
        return '#4CAF50'; // Green for active
      case 'completed':
        return '#FF9800'; // Orange for completed
      case 'cancelled':
        return '#F44336'; // Red for cancelled
      default:
        return '#9E9E9E'; // Grey for unknown
    }
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString();
  };

  const renderStatsCard = (title: string, value: number, icon: string, color: string) => (
    <View style={[styles.statsCard, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
      <Text style={styles.statsIcon}>{icon}</Text>
      <Text style={[styles.statsValue, { color: color }]}>{value}</Text>
      <Text style={[styles.statsTitle, { color: isDarkMode ? '#cccccc' : '#666666' }]}>{title}</Text>
    </View>
  );

  const renderTravelerLink = ({ item }: { item: TravelerLink }) => (
    <View style={[styles.linkCard, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
      <View style={styles.linkHeader}>
        <Text style={[styles.travelerName, { color: isDarkMode ? '#ffffff' : '#333333' }]}>
          {item.travelerName}
        </Text>
        <View style={[
          styles.statusBadge, 
          { 
            backgroundColor: item.status === 'active' ? '#4CAF50' : 
                           item.status === 'pending' ? '#FF9800' : '#9E9E9E' 
          }
        ]}>
          <Text style={styles.statusText}>
            {item.status === 'active' ? '✅ Active' : 
             item.status === 'pending' ? '⏳ Pending' : item.status}
          </Text>
        </View>
      </View>
      <Text style={[styles.linkDate, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
        Linked since: {new Date(item.createdAt).toLocaleDateString()}
      </Text>
      {item.status === 'pending' && (
        <Text style={[styles.pendingNote, { color: '#FF9800' }]}>
          ⚠️ This link needs to be accepted to start tracking
        </Text>
      )}
    </View>
  );

  const renderTrackingItem = ({ item }: { item: ActiveTracking }) => (
    <TouchableOpacity
      style={[styles.trackingCard, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}
      onPress={() => handleViewTracking(item.rideId)}
    >
      <View style={styles.trackingHeader}>
        <Text style={[styles.travelerName, { color: isDarkMode ? '#ffffff' : '#333333' }]}>
          {item.travelerName}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: '#2196F3' }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      <Text style={[styles.destinationText, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
        🎯 {item.destination}
      </Text>
      <Text style={[styles.trackingTime, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
        Started: {new Date(item.startTime).toLocaleTimeString()}
      </Text>
      <Text style={styles.tapToView}>Tap to view tracking</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: isDarkMode ? '#121212' : '#f5f5f5' }]}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={[styles.loadingText, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
          Loading dashboard...
        </Text>
      </View>
    );
  }

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Companion Dashboard</Text>
          <Text style={styles.headerSubtitle}>Track your loved ones' journeys</Text>
        </View>

        {/* Stats Section */}
        <View style={styles.statsSection}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#ffffff' : '#333333' }]}>
            Your Activity
          </Text>
          <View style={styles.statsGrid}>
            {renderStatsCard('Total Links', stats.totalLinks, '👥', '#4CAF50')}
            {renderStatsCard('Active Links', stats.activeLinks, '✅', '#2196F3')}
            {renderStatsCard('Tracking Sessions', stats.totalTrackingSessions, '📍', '#FF9800')}
            {renderStatsCard('Completed', stats.completedTrackingSessions, '🎯', '#9C27B0')}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#ffffff' : '#333333' }]}>
            Quick Actions
          </Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
              onPress={handleLinkToTraveler}
            >
              <Text style={styles.actionButtonText}>🔗 Link to Traveler</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#2196F3' }]}
              onPress={handleViewRideHistory}
            >
              <Text style={styles.actionButtonText}>📊 Ride History</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
              onPress={handleSettings}
            >
              <Text style={styles.actionButtonText}>⚙️ Settings</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#9C27B0' }]}
              onPress={handleAcceptAllPending}
            >
              <Text style={styles.actionButtonText}>👥 Accept Pending</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Active Links */}
        <View style={styles.linksSection}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#ffffff' : '#333333' }]}>
            Linked Travelers ({activeLinks.length})
          </Text>
          {activeLinks.length > 0 ? (
            <FlatList
              data={activeLinks}
              renderItem={renderTravelerLink}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={[styles.emptyState, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={[styles.emptyTitle, { color: isDarkMode ? '#ffffff' : '#333333' }]}>
                No Travelers Linked
              </Text>
              <Text style={[styles.emptySubtitle, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
                Link to travelers to start tracking their rides
              </Text>
              <TouchableOpacity
                style={[styles.emptyActionButton, { backgroundColor: '#4CAF50' }]}
                onPress={handleLinkToTraveler}
              >
                <Text style={styles.emptyActionButtonText}>Link to Traveler</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Active Tracking Section */}
        <View style={[styles.section, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: isDarkMode ? '#f3f4f6' : '#374151' }]}>
              Active Tracking ({activeTracking.length})
            </Text>
            <TouchableOpacity onPress={handleManualRefresh} style={styles.refreshButton}>
              <Text style={styles.refreshButtonText}>🔄 Refresh</Text>
            </TouchableOpacity>
          </View>
          
          {activeTracking.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: isDarkMode ? '#404040' : '#f9fafb' }]}>
              <Text style={styles.emptyIcon}>📍</Text>
              <Text style={[styles.emptyText, { color: isDarkMode ? '#d1d5db' : '#6b7280' }]}>
                No Active Tracking
              </Text>
              <Text style={[styles.emptySubtext, { color: isDarkMode ? '#9ca3af' : '#9ca3af' }]}>
                When travelers start rides, you'll see them here
              </Text>
              <TouchableOpacity onPress={handleManualRefresh} style={styles.checkRidesButton}>
                <Text style={styles.checkRidesButtonText}>🔍 Check for Active Rides</Text>
              </TouchableOpacity>
            </View>
          ) : (
            activeTracking.map((track) => (
              <TouchableOpacity
                key={track.id}
                style={[styles.trackingCard, { backgroundColor: isDarkMode ? '#404040' : '#f9fafb' }]}
                onPress={() => handleViewTracking(track.rideId)}
              >
                <View style={styles.trackingHeader}>
                  <Text style={[styles.travelerName, { color: isDarkMode ? '#f3f4f6' : '#374151' }]}>
                    {track.travelerName}
                  </Text>
                  <Text style={[styles.trackingStatus, { color: getStatusColor(track.status) }]}>
                    {track.status.toUpperCase()}
                  </Text>
                </View>
                
                <Text style={[styles.destinationText, { color: isDarkMode ? '#d1d5db' : '#6b7280' }]}>
                  🎯 {track.destination}
                </Text>
                
                {track.currentLocation && (
                  <Text style={[styles.locationText, { color: isDarkMode ? '#9ca3af' : '#9ca3af' }]}>
                    📍 Lat: {track.currentLocation.latitude.toFixed(4)}, 
                    Long: {track.currentLocation.longitude.toFixed(4)}
                  </Text>
                )}
                
                {track.estimatedArrival && (
                  <Text style={[styles.etaText, { color: isDarkMode ? '#9ca3af' : '#9ca3af' }]}>
                    ⏰ ETA: {new Date(track.estimatedArrival).toLocaleTimeString()}
                  </Text>
                )}
                
                <Text style={[styles.startTimeText, { color: isDarkMode ? '#9ca3af' : '#9ca3af' }]}>
                  🕐 Started: {new Date(track.startTime).toLocaleTimeString()}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>🚪 Logout</Text>
        </TouchableOpacity>
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
  scrollContent: {
    padding: 20,
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
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.9,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  statsSection: {
    marginBottom: 25,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statsCard: {
    width: '48%',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsIcon: {
    fontSize: 32,
    marginBottom: 10,
  },
  statsValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  statsTitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  actionsSection: {
    marginBottom: 25,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  actionButton: {
    width: '48%',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  linksSection: {
    marginBottom: 25,
  },
  linkCard: {
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  linkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  travelerName: {
    fontSize: 18,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  linkDate: {
    fontSize: 14,
  },
  pendingNote: {
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
  },
  trackingSection: {
    marginBottom: 25,
  },
  trackingCard: {
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  trackingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  destinationText: {
    fontSize: 16,
    marginBottom: 8,
  },
  trackingTime: {
    fontSize: 14,
    marginBottom: 10,
  },
  tapToView: {
    fontSize: 12,
    color: '#2196F3',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  emptyState: {
    padding: 40,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 15,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  emptyActionButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  emptyActionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#f44336',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  refreshButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#2196F3',
  },
  refreshButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    borderRadius: 15,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  trackingStatus: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 15,
  },
  locationText: {
    fontSize: 14,
    marginTop: 5,
  },
  etaText: {
    fontSize: 14,
    marginTop: 5,
  },
  startTimeText: {
    fontSize: 14,
    marginTop: 5,
  },
  emptyCard: {
    padding: 40,
    alignItems: 'center',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  checkRidesButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    backgroundColor: '#FF9800',
  },
  checkRidesButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default CompanionDashboard;
