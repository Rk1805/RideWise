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

interface RideHistoryItem {
  id: string;
  rideId: string;
  travelerName: string;
  destination: string;
  status: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

const CompanionRideHistory = () => {
  const { isDarkMode } = useTheme();
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rideHistory, setRideHistory] = useState<RideHistoryItem[]>([]);

  useEffect(() => {
    const initializeHistory = async () => {
      try {
        // Initialize companion service for current user
        await companionService.initializeForUser();
        await loadRideHistory();
      } catch (error) {
        console.error('Error initializing history:', error);
      }
    };
    
    initializeHistory();
  }, []);

  const loadRideHistory = async () => {
    try {
      setLoading(true);
      
      // Load ride history from companion service
      const history = await companionService.getRideHistory();
      setRideHistory(history);

    } catch (error) {
      console.error('Error loading ride history:', error);
      Alert.alert('Error', 'Failed to load ride history');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRideHistory();
    setRefreshing(false);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString();
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString();
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return 'N/A';
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#10b981';
      case 'cancelled':
        return '#ef4444';
      case 'in_progress':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '✅ Completed';
      case 'cancelled':
        return '❌ Cancelled';
      case 'in_progress':
        return '🚀 In Progress';
      default:
        return '⏳ Processing';
    }
  };

  const renderRideItem = ({ item }: { item: RideHistoryItem }) => (
    <View style={[styles.rideCard, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
      <View style={styles.rideHeader}>
        <Text style={[styles.travelerName, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
          {item.travelerName}
        </Text>
        <Text style={[styles.status, { color: getStatusColor(item.status) }]}>
          {getStatusText(item.status)}
        </Text>
      </View>

      <View style={styles.rideDetails}>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: isDarkMode ? '#9ca3af' : '#6b7280' }]}>
            Destination:
          </Text>
          <Text style={[styles.detailValue, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
            {item.destination}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: isDarkMode ? '#9ca3af' : '#6b7280' }]}>
            Start Time:
          </Text>
          <Text style={[styles.detailValue, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
            {formatDate(item.startTime)} at {formatTime(item.startTime)}
          </Text>
        </View>

        {item.endTime && (
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: isDarkMode ? '#9ca3af' : '#6b7280' }]}>
              End Time:
            </Text>
            <Text style={[styles.detailValue, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
              {formatDate(item.endTime)} at {formatTime(item.endTime)}
            </Text>
          </View>
        )}

        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: isDarkMode ? '#9ca3af' : '#6b7280' }]}>
            Duration:
          </Text>
          <Text style={[styles.detailValue, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
            {formatDuration(item.duration)}
          </Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <LinearGradient
        colors={isDarkMode ? ['#121212', '#1e1e1e'] : ['#e0f2ff', '#b9e6ff']}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={[styles.loadingText, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
          Loading ride history...
        </Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={isDarkMode ? ['#121212', '#1e1e1e'] : ['#e0f2ff', '#b9e6ff']}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDarkMode ? '#ffffff' : '#1f2937' }]}>
          Ride History
        </Text>
        <Text style={[styles.subtitle, { color: isDarkMode ? '#d1d5db' : '#6b7280' }]}>
          Track your linked travelers' ride history
        </Text>
      </View>

      {rideHistory.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyIcon, { color: isDarkMode ? '#6b7280' : '#9ca3af' }]}>
            📋
          </Text>
          <Text style={[styles.emptyTitle, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
            No Ride History Yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: isDarkMode ? '#9ca3af' : '#6b7280' }]}>
            Start tracking rides to see history here
          </Text>
        </View>
      ) : (
        <FlatList
          data={rideHistory}
          renderItem={renderRideItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666666',
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  listContainer: {
    padding: 20,
  },
  rideCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  travelerName: {
    fontSize: 18,
    fontWeight: '600',
  },
  status: {
    fontSize: 14,
    fontWeight: '500',
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
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
    marginLeft: 10,
  },
});

export default CompanionRideHistory;
