import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../service/themeContext';
import { ratingService, Rating, DriverRating } from '../service/ratingService';

const AdminRatingsScreen = () => {
  const navigation = useNavigation<any>();
  const { isDarkMode } = useTheme();
  
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [topDrivers, setTopDrivers] = useState<DriverRating[]>([]);
  const [statistics, setStatistics] = useState({
    totalRatings: 0,
    averageRating: 0,
    ratingDistribution: {} as { [key: number]: number },
    totalDrivers: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'ratings' | 'drivers'>('overview');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [allRatings, topRated, stats] = await Promise.all([
        ratingService.getAllRatings(),
        ratingService.getTopRatedDrivers(10),
        ratingService.getRatingStatistics()
      ]);
      
      setRatings(allRatings);
      setTopDrivers(topRated);
      setStatistics(stats);
    } catch (error) {
      console.error('Error fetching ratings data:', error);
      Alert.alert('Error', 'Failed to fetch ratings data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const renderStarRating = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Text
          key={i}
          style={[
            styles.star,
            { color: i <= rating ? '#FFD700' : '#ccc' }
          ]}
        >
          ★
        </Text>
      );
    }
    return <View style={styles.starsContainer}>{stars}</View>;
  };

  const renderRatingItem = ({ item }: { item: Rating }) => (
    <View style={[
      styles.ratingCard,
      { backgroundColor: isDarkMode ? '#1f2937' : '#ffffff' }
    ]}>
      <View style={styles.ratingHeader}>
        <View style={styles.ratingInfo}>
          {renderStarRating(item.rating)}
          <Text style={[
            styles.ratingValue,
            { color: isDarkMode ? '#f3f4f6' : '#1f2937' }
          ]}>
            {item.rating}/5
          </Text>
        </View>
        <Text style={[
          styles.ratingDate,
          { color: isDarkMode ? '#9ca3af' : '#6b7280' }
        ]}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
      
      <Text style={[
        styles.rideRoute,
        { color: isDarkMode ? '#d1d5db' : '#4b5563' }
      ]}>
        {item.rideData.from} → {item.rideData.to}
      </Text>
      
      <Text style={[
        styles.driverName,
        { color: isDarkMode ? '#9ca3af' : '#6b7280' }
      ]}>
        Driver: {item.rideData.driverName}
      </Text>
      
      {item.comment && (
        <Text style={[
          styles.comment,
          { color: isDarkMode ? '#d1d5db' : '#4b5563' }
        ]}>
          "{item.comment}"
        </Text>
      )}
      
      <View style={styles.rideDetails}>
        <Text style={[
          styles.detailText,
          { color: isDarkMode ? '#9ca3af' : '#6b7280' }
        ]}>
          {item.rideData.date} at {item.rideData.time}
        </Text>
        <Text style={[
          styles.detailText,
          { color: isDarkMode ? '#9ca3af' : '#6b7280' }
        ]}>
          Distance: {item.rideData.distance} km | Amount: ${item.rideData.amount}
        </Text>
      </View>
    </View>
  );

  const renderDriverItem = ({ item }: { item: DriverRating }) => (
    <View style={[
      styles.driverCard,
      { backgroundColor: isDarkMode ? '#1f2937' : '#ffffff' }
    ]}>
      <View style={styles.driverHeader}>
        <Text style={[
          styles.driverName,
          { color: isDarkMode ? '#f3f4f6' : '#1f2937' }
        ]}>
          {item.driverName}
        </Text>
        <View style={styles.driverRating}>
          {renderStarRating(item.averageRating)}
          <Text style={[
            styles.averageRating,
            { color: isDarkMode ? '#f3f4f6' : '#1f2937' }
          ]}>
            {item.averageRating}
          </Text>
        </View>
      </View>
      
      <Text style={[
        styles.ratingCount,
        { color: isDarkMode ? '#9ca3af' : '#6b7280' }
      ]}>
        {item.totalRatings} rating{item.totalRatings !== 1 ? 's' : ''}
      </Text>
      
      <View style={styles.ratingBreakdown}>
        {[5, 4, 3, 2, 1].map(star => {
          const count = item.ratings.filter(r => r.rating === star).length;
          const percentage = item.totalRatings > 0 ? (count / item.totalRatings) * 100 : 0;
          
          return (
            <View key={star} style={styles.starBreakdown}>
              <Text style={[
                styles.starLabel,
                { color: isDarkMode ? '#9ca3af' : '#6b7280' }
              ]}>
                {star}★
              </Text>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill,
                    { 
                      width: `${percentage}%`,
                      backgroundColor: star >= 4 ? '#10b981' : star >= 3 ? '#f59e0b' : '#ef4444'
                    }
                  ]} 
                />
              </View>
              <Text style={[
                styles.starCount,
                { color: isDarkMode ? '#9ca3af' : '#6b7280' }
              ]}>
                {count}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );

  const renderOverview = () => (
    <ScrollView style={styles.overviewContainer}>
      {/* Statistics Cards */}
      <View style={styles.statsContainer}>
        <View style={[
          styles.statCard,
          { backgroundColor: isDarkMode ? '#1f2937' : '#ffffff' }
        ]}>
          <Text style={[
            styles.statValue,
            { color: isDarkMode ? '#f3f4f6' : '#1f2937' }
          ]}>
            {statistics.totalRatings}
          </Text>
          <Text style={[
            styles.statLabel,
            { color: isDarkMode ? '#9ca3af' : '#6b7280' }
          ]}>
            Total Ratings
          </Text>
        </View>
        
        <View style={[
          styles.statCard,
          { backgroundColor: isDarkMode ? '#1f2937' : '#ffffff' }
        ]}>
          <Text style={[
            styles.statValue,
            { color: isDarkMode ? '#f3f4f6' : '#1f2937' }
          ]}>
            {statistics.averageRating.toFixed(1)}
          </Text>
          <Text style={[
            styles.statLabel,
            { color: isDarkMode ? '#9ca3af' : '#6b7280' }
          ]}>
            Average Rating
          </Text>
        </View>
        
        <View style={[
          styles.statCard,
          { backgroundColor: isDarkMode ? '#1f2937' : '#ffffff' }
        ]}>
          <Text style={[
            styles.statValue,
            { color: isDarkMode ? '#f3f4f6' : '#1f2937' }
          ]}>
            {statistics.totalDrivers}
          </Text>
          <Text style={[
            styles.statLabel,
            { color: isDarkMode ? '#9ca3af' : '#6b7280' }
          ]}>
            Rated Drivers
          </Text>
        </View>
      </View>

      {/* Rating Distribution */}
      <View style={[
        styles.distributionCard,
        { backgroundColor: isDarkMode ? '#1f2937' : '#ffffff' }
      ]}>
        <Text style={[
          styles.sectionTitle,
          { color: isDarkMode ? '#f3f4f6' : '#1f2937' }
        ]}>
          Rating Distribution
        </Text>
        {[5, 4, 3, 2, 1].map(star => {
          const count = statistics.ratingDistribution[star] || 0;
          const percentage = statistics.totalRatings > 0 ? (count / statistics.totalRatings) * 100 : 0;
          
          return (
            <View key={star} style={styles.distributionRow}>
              <Text style={[
                styles.starLabel,
                { color: isDarkMode ? '#9ca3af' : '#6b7280' }
              ]}>
                {star}★
              </Text>
              <View style={styles.distributionBar}>
                <View 
                  style={[
                    styles.distributionFill,
                    { 
                      width: `${percentage}%`,
                      backgroundColor: star >= 4 ? '#10b981' : star >= 3 ? '#f59e0b' : '#ef4444'
                    }
                  ]} 
                />
              </View>
              <Text style={[
                styles.distributionCount,
                { color: isDarkMode ? '#9ca3af' : '#6b7280' }
              ]}>
                {count} ({percentage.toFixed(1)}%)
              </Text>
            </View>
          );
        })}
      </View>

      {/* Top Rated Drivers */}
      <View style={[
        styles.topDriversCard,
        { backgroundColor: isDarkMode ? '#1f2937' : '#ffffff' }
      ]}>
        <Text style={[
          styles.sectionTitle,
          { color: isDarkMode ? '#f3f4f6' : '#1f2937' }
        ]}>
          Top Rated Drivers
        </Text>
        {topDrivers.slice(0, 5).map((driver, index) => (
          <View key={driver.driverId} style={styles.topDriverRow}>
            <Text style={[
              styles.rank,
              { color: isDarkMode ? '#9ca3af' : '#6b7280' }
            ]}>
              #{index + 1}
            </Text>
            <Text style={[
              styles.driverName,
              { color: isDarkMode ? '#f3f4f6' : '#1f2937' }
            ]}>
              {driver.driverName}
            </Text>
            <View style={styles.topDriverRating}>
              {renderStarRating(driver.averageRating)}
              <Text style={[
                styles.averageRating,
                { color: isDarkMode ? '#f3f4f6' : '#1f2937' }
              ]}>
                {driver.averageRating}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={[
        styles.loadingContainer,
        { backgroundColor: isDarkMode ? '#121212' : '#f9f9f9' }
      ]}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={[
          styles.loadingText,
          { color: isDarkMode ? '#d1d5db' : '#4b5563' }
        ]}>
          Loading ratings data...
        </Text>
      </View>
    );
  }

  return (
    <View style={[
      styles.container,
      { backgroundColor: isDarkMode ? '#121212' : '#f9f9f9' }
    ]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={[
          styles.title,
          { color: isDarkMode ? '#f3f4f6' : '#1f2937' }
        ]}>
          Ratings & Feedback
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'overview' && styles.activeTab
          ]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'overview' && styles.activeTabText
          ]}>
            Overview
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'ratings' && styles.activeTab
          ]}
          onPress={() => setActiveTab('ratings')}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'ratings' && styles.activeTabText
          ]}>
            All Ratings ({ratings.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'drivers' && styles.activeTab
          ]}
          onPress={() => setActiveTab('drivers')}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'drivers' && styles.activeTabText
          ]}>
            Driver Ratings ({topDrivers.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'overview' && renderOverview()}
      
      {activeTab === 'ratings' && (
        <FlatList
          data={ratings}
          keyExtractor={(item) => item.id || item.rideId}
          renderItem={renderRatingItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContainer}
        />
      )}
      
      {activeTab === 'drivers' && (
        <FlatList
          data={topDrivers}
          keyExtractor={(item) => item.driverId}
          renderItem={renderDriverItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 50,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#3b82f6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  overviewContainer: {
    flex: 1,
    padding: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  distributionCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  starLabel: {
    width: 30,
    fontSize: 14,
    fontWeight: '600',
  },
  distributionBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    marginHorizontal: 12,
  },
  distributionFill: {
    height: '100%',
    borderRadius: 4,
  },
  distributionCount: {
    width: 80,
    fontSize: 12,
    textAlign: 'right',
  },
  topDriversCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  topDriverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  rank: {
    width: 30,
    fontSize: 14,
    fontWeight: '600',
  },
  driverName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  topDriverRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  ratingCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: 8,
  },
  star: {
    fontSize: 16,
  },
  ratingValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  ratingDate: {
    fontSize: 12,
  },
  rideRoute: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  comment: {
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 8,
    marginBottom: 8,
  },
  rideDetails: {
    marginTop: 8,
  },
  detailText: {
    fontSize: 12,
    marginBottom: 2,
  },
  driverCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  driverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  driverRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  averageRating: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  ratingCount: {
    fontSize: 14,
    marginBottom: 16,
  },
  ratingBreakdown: {
    marginTop: 8,
  },
  starBreakdown: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    marginHorizontal: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  starCount: {
    width: 30,
    fontSize: 12,
    textAlign: 'right',
  },
});

export default AdminRatingsScreen;
