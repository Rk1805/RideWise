import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Dimensions, ColorValue } from 'react-native';
import { useTheme } from '../service/themeContext';
import { auth, db } from '../service/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const screenWidth = Dimensions.get('window').width;

const AnalyticsScreen = () => {
  const { isDarkMode } = useTheme();
  const [userType, setUserType] = useState<'user' | 'driver' | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRides: 0,
    completedRides: 0,
    cancelledRides: 0,
    totalEarnings: 0,
    totalCost: 0,
    totalDistance: 0,
    totalTime: 0
  });

  const fetchUserType = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const userType = await AsyncStorage.getItem('userType');
    setUserType(userType === 'driver' ? 'driver' : 'user');
  };

  const fetchAnalytics = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      let targetCollection = userType === 'driver' ? 'driverHistory' : 'history';
      let q = query(collection(db, targetCollection), where(userType === 'driver' ? 'driverId' : 'userId', '==', uid));
      const querySnapshot = await getDocs(q);

      let total :number = 0, completed:number = 0, cancelled :number= 0;
      let earnings :number = 0, cost = 0, distance :number = 0, time :number = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        total++;
        if (data.status === 'Completed') completed++;
        if (data.status === 'Cancelled') cancelled++;

        if (userType === 'driver') {
          earnings += data.amount || 0;
          distance += data.distance || 0;
          time += data.duration || 0;
        } else {
          cost += data.amount || 0;
          distance += data.distance || 0;
          time += data.duration || 0;
        }
      });

      setStats({
        totalRides: total,
        completedRides: completed,
        cancelledRides: cancelled,
        totalEarnings: earnings, 
        totalCost: cost,
        totalDistance: distance,
        totalTime: time,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserType();
  }, []);

  useEffect(() => {
    if (userType) {
      fetchAnalytics();
    }
  }, [userType]);

  if (loading || userType === null) {
    return (
      <View style={[styles.container, { backgroundColor: isDarkMode ? '#0f172a' : '#f1f5f9' }]}>        
        <ActivityIndicator size="large" color={isDarkMode ? '#60a5fa' : '#2563eb'} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: isDarkMode ? '#0f172a' : '#f1f5f9' }]}>
      <Text style={[styles.header, { color: isDarkMode ? '#e0f2fe' : '#1e3a8a' }]}>📊 {userType === 'driver' ? 'Driver' : 'User'} Ride Analytics</Text>

      <View style={styles.cardContainer}>
        <StatCard icon="car" label="Total Rides" value={stats.totalRides} gradient={['#6366f1', '#818cf8']} />
        <StatCard icon="check-circle-outline" label="Completed" value={stats.completedRides} gradient={['#10b981', '#34d399']} />
        <StatCard icon="cancel" label="Cancelled" value={stats.cancelledRides} gradient={['#ef4444', '#f87171']} />

        {userType === 'driver' ? (
          <>
            <StatCard icon="currency-inr" label="Total Earnings"  value={`₹${(stats.totalEarnings ?? 0)}`} gradient={['#f59e0b', '#fbbf24']} />
            <StatCard icon="map-marker-distance" label="Distance Travelled" value={`${stats.totalDistance} km`} gradient={['#3b82f6', '#60a5fa']} />
            <StatCard icon="clock-outline" label="Time Spent" value={`${stats.totalTime.toFixed(1)} min`} gradient={['#8b5cf6', '#a78bfa']} />
          </>
        ) : ( 
          <>
            <StatCard icon="currency-inr" label="Total Spent"  value={`₹${(stats.totalCost ?? 0)}`} gradient={['#f59e0b', '#fbbf24']} />
            <StatCard icon="map-marker-distance" label="Distance Travelled" value={`${stats.totalDistance} km`} gradient={['#3b82f6', '#60a5fa']} />
            <StatCard icon="clock-outline" label="Time Spent" value={`${stats.totalTime.toFixed(1)} min`} gradient={['#8b5cf6', '#a78bfa']} />
          </>
        )}
      </View>
    </ScrollView>
  );
};

const StatCard = ({ icon, label, value, gradient }: { 
  icon: keyof typeof MaterialCommunityIcons.glyphMap; 
  label: string; 
  value: string | number; 
  gradient: [ColorValue, ColorValue, ...ColorValue[]] 
}) => (
  <LinearGradient colors={gradient} style={styles.statCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
    <MaterialCommunityIcons name={icon} size={26} color="#fff" style={{ marginBottom: 6 }} />
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </LinearGradient>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
  },
  cardContainer: {
    flexDirection: 'column',
    gap: 16,
  },
  statCard: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  statLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 4,
  },
});

export default AnalyticsScreen;
