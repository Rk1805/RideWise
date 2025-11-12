import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../service/firebase';
import { useTheme } from '../service/themeContext';
import { Clipboard } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const Profile = () => {
  const { isDarkMode } = useTheme();
  const navigation = useNavigation<any>();
  const currentUser = auth.currentUser;

  const [userData, setUserData] = useState({
    username: 'User',
    email: currentUser?.email || 'Not provided',
    vehicle: {
      color: '',
      licensePlate: '',
      make: '',
      model: '',
      year: '',
    },
    userId: '', // Added userId to state
  });

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const uid = currentUser?.uid;
        if (!uid) return;

        const userType = await AsyncStorage.getItem('userType');

        let username = 'User';
        let email = currentUser?.email || 'Not provided';
        let vehicle = {
          color: '',
          licensePlate: '',
          make: '',
          model: '',
          year: '',
        };
        let userId = '';

        if (userType === 'driver') {
          const driverRef = doc(db, 'drivers', uid);
          const driverSnap = await getDoc(driverRef);

          if (driverSnap.exists()) {
            const data = driverSnap.data();
            username = data.username || username;
            email = data.email || email;
            userId = uid; // Set userId for driver

            if (data.vehicleInfo) {
              vehicle = {
                color: data.vehicleInfo.color || '',
                licensePlate: data.vehicleInfo.licensePlate || '',
                make: data.vehicleInfo.make || '',
                model: data.vehicleInfo.model || '',
                year: data.vehicleInfo.year || '',
              };
            }
          }
        } else {
          const userRef = doc(db, 'users', uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const data = userSnap.data();
            username = data.username || username;
            email = data.email || email;
            userId = uid; // Set userId for user
          }
        }

        setUserData({ username, email, vehicle, userId });
      } catch (error) {
        // Error fetching user data
      }
    };

    fetchUserData();
  }, [currentUser]);

  const copyUserId = () => {
    Clipboard.setString(userData.userId);
    Alert.alert('Copied!', 'User ID copied to clipboard');
  };

  const goToShareID = () => {
    navigation.navigate('ShareTravelerID');
  };

  const styles = getStyles(isDarkMode);

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/user_icon.png')}
        style={styles.profileImage}
      />
      <Text style={styles.label}>Name:</Text>
      <Text style={styles.value}>{userData.username}</Text>
      <Text style={styles.label}>Email:</Text>
      <Text style={styles.value}>{userData.email}</Text>
      
      {/* User ID Section */}
      <Text style={styles.label}>User ID:</Text>
      <TouchableOpacity onPress={copyUserId} style={styles.userIdContainer}>
        <Text style={styles.userIdText}>{userData.userId}</Text>
        <Text style={styles.copyText}>📋 Tap to copy</Text>
      </TouchableOpacity>
      <Text style={styles.userIdHelp}>
        Share this ID with companions who want to track your rides
      </Text>

      {/* Share ID Button */}
      <TouchableOpacity onPress={goToShareID} style={styles.shareButton}>
        <Text style={styles.shareButtonText}>📤 Share My ID</Text>
      </TouchableOpacity>

      {/* Show vehicle info only if filled */}
      {userData.vehicle.make ? (
        <>
          <Text style={styles.label}>Vehicle Details:</Text>
          <Text style={styles.value}>Color: {userData.vehicle.color}</Text>
          <Text style={styles.value}>License Plate: {userData.vehicle.licensePlate}</Text>
          <Text style={styles.value}>Make: {userData.vehicle.make}</Text>
          <Text style={styles.value}>Model: {userData.vehicle.model}</Text>
          <Text style={styles.value}>Year: {userData.vehicle.year}</Text>          
        </>
      ) : null}
    </View>
  );
};

const getStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingTop: 40,
      backgroundColor: isDarkMode ? '#121212' : '#fff',
      flex: 1,
    },
    profileImage: {
      width: 100,
      height: 100,
      borderRadius: 50,
      marginBottom: 20,
    },
    label: {
      fontSize: 18,
      fontWeight: '600',
      color: isDarkMode ? '#f3f4f6' : '#111827',
      marginTop: 10,
    },
    value: {
      fontSize: 16,
      color: isDarkMode ? '#d1d5db' : '#374151',
    },
    userIdContainer: {
      backgroundColor: isDarkMode ? '#2a2a2a' : '#f3f4f6',
      padding: 10,
      borderRadius: 8,
      marginVertical: 5,
      alignItems: 'center',
      minWidth: 200,
    },
    userIdText: {
      fontSize: 14,
      fontFamily: 'monospace',
      color: isDarkMode ? '#ffffff' : '#1f2937',
      textAlign: 'center',
      marginBottom: 5,
    },
    copyText: {
      fontSize: 12,
      color: isDarkMode ? '#9ca3af' : '#6b7280',
      fontStyle: 'italic',
    },
    userIdHelp: {
      fontSize: 12,
      color: isDarkMode ? '#9ca3af' : '#6b7280',
      textAlign: 'center',
      marginTop: 5,
      marginBottom: 10,
      paddingHorizontal: 20,
    },
    shareButton: {
      backgroundColor: '#3b82f6',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 8,
      marginTop: 10,
      marginBottom: 20,
    },
    shareButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
  });

export default Profile;
