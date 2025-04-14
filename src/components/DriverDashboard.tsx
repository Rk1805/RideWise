import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Switch,ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { collection, query, where, getDoc, onSnapshot ,doc,getDocs,updateDoc} from 'firebase/firestore';
import { auth, db } from '../service/firebase';
import { useTheme } from '../service/themeContext';
import DashboardTemplate from './dashboardTemplate';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DriverDashboard = () => {
  const { isDarkMode } = useTheme();
  const navigation = useNavigation();
  const [pendingRides, setPendingRides] = useState(0);
  const [driverName, setDriverName] = useState('');
  const [availability, setAvailability] = useState('unavailable');
  const [isSwitchOn, setIsSwitchOn] = useState(false);

  const currentUserUID = auth.currentUser?.uid;

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!currentUserUID) {
        console.warn('⚠️ No logged-in user found');
        return;
      }

      try {
        const driverDocRef = doc(db, 'drivers', currentUserUID);
        const driverSnap = await getDoc(driverDocRef);

        if (driverSnap.exists()) {
          const data = driverSnap.data();
          setDriverName(data.username || 'Driver');
          setAvailability(data.status || 'unavailable');
          setIsSwitchOn(data.status === 'available');
        } else {
          console.warn('❌ No driver document found with this UID');
        }
      } catch (err) {
        console.error('❌ Error fetching dashboard data:', err);
      }
    };

    fetchDashboardData();
  }, [currentUserUID]);

  const handleToggleAvailability = async () => {
    if (!currentUserUID) return;

    try {
      const newStatus = isSwitchOn ? 'unavailable' : 'available';
      const driverDocRef = doc(db, 'drivers', currentUserUID);

      await updateDoc(driverDocRef, {
        status: newStatus,
         updatedAt: new Date(),
      });

      setIsSwitchOn(!isSwitchOn);
      setAvailability(newStatus);
    } catch (err) {
      console.error('❌ Failed to toggle availability:', err);
    }
  };

  const cardData = [
    {
      title: 'Ride Requests',
      description: `${pendingRides} pending requests`,
      route: 'RideRequests',
      source: require('../assets/ridereq.png'),
      iconStyle: { width: 50, height: 50 }
    },
    {
      title: 'My Vehicle Details',
      description: 'View or update your vehicle info',
      route: 'DriverVehicleDetailsScreen',
      source: require('../assets/myv.png'),
      iconStyle: { width: 80, height: 40 }
    },
    {
      title: 'Ride History',
      description: 'View your completed rides',
      route: 'DriverRideHistory',
      source: require('../assets/his.png'),
      iconStyle: { width: 50, height: 50 }
    },
  ];

  const styles = getStyles(isDarkMode);

  return (
    <DashboardTemplate>
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>Welcome, {driverName}</Text>
        <View style={styles.toggleRow}>
          <Text style={styles.statusText}>Status: {availability}</Text>
          <Switch value={isSwitchOn} onValueChange={handleToggleAvailability} />
        </View>
      </View>

      {cardData.map((card, index) => (
        <TouchableOpacity
          key={index}
          style={styles.card}
          onPress={() => navigation.navigate(card.route as never)}
        >
          <Image source={card.source} style={[{ marginBottom: 8 }, card.iconStyle]} />
          <Text style={styles.cardTitle}>{card.title}</Text>
          <Text style={styles.cardDescription}>{card.description}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </DashboardTemplate>
  );
};

const getStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 16,
      paddingVertical: 20,
      backgroundColor: isDarkMode ? '#121212' : '#f9f9f9',
    },
    welcomeSection: {
      marginBottom: 20,
    },
    welcomeText: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDarkMode ? '#f3f4f6' : '#1f2937',
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    statusText: {
      fontSize: 16,
      color: isDarkMode ? '#9ca3af' : '#6b7280',
    },
    card: {
      width: '100%',
      paddingVertical: 30,
      paddingHorizontal: 20,
      borderRadius: 12,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 5,
      marginBottom: 16,
      backgroundColor: isDarkMode ? '#1f1f1f' : '#f8f9fa',
    },
    cardTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginTop: 10,
      color: '#3b82f6',
    },
    cardDescription: {
      fontSize: 16,
      textAlign: 'center',
      marginTop: 5,
      color: isDarkMode ? '#9ca3af' : '#6b7280',
    },
  });

export default DriverDashboard;
