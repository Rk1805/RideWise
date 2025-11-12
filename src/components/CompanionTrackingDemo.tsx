import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../service/themeContext';
import { companionTrackingService } from '../service/companionTrackingService';
import { expoNotificationService } from '../service/fcmService';
import { useNavigation } from '@react-navigation/native';

const CompanionTrackingDemo = () => {
  const { isDarkMode } = useTheme();
  const navigation = useNavigation();
  
  const [rideId, setRideId] = useState('');
  const [travelerId, setTravelerId] = useState('');
  const [destination, setDestination] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  const handleStartTracking = async () => {
    if (!rideId || !travelerId || !destination || !latitude || !longitude) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);

      if (isNaN(lat) || isNaN(lng)) {
        Alert.alert('Error', 'Please enter valid coordinates');
        return;
      }

      const trackingId = await companionTrackingService.startTrackingTraveler(
        travelerId,
        rideId,
        {
          latitude: lat,
          longitude: lng,
          address: destination,
        }
      );

      Alert.alert(
        'Tracking Started!',
        `Successfully started tracking ride ${rideId}`,
        [
          {
            text: 'View Tracking',
            onPress: () => navigation.navigate('CompanionTrackingScreen', { 
              trackingId, 
              rideId 
            }),
          },
          {
            text: 'OK',
            style: 'cancel',
          },
        ]
      );

      // Clear form
      setRideId('');
      setTravelerId('');
      setDestination('');
      setLatitude('');
      setLongitude('');

    } catch (error) {
      console.error('Error starting tracking:', error);
      Alert.alert('Error', 'Failed to start tracking. Please try again.');
    }
  };

  const handleTestNotification = async () => {
    try {
      // Test the notification system
      await expoNotificationService.sendTestNotification();
      Alert.alert('Success', 'Test notification sent successfully! Check your notification panel.');

    } catch (error) {
      console.error('Error sending test notification:', error);
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  const handleTestLocationUpdate = async () => {
    if (!rideId) {
      Alert.alert('Error', 'Please enter a ride ID first');
      return;
    }

    try {
      // Simulate a ride status update
      const testLocation = {
        latitude: 37.78825,
        longitude: -122.4324,
        accuracy: 10,
      };

      await companionTrackingService.updateTrackingLocation(rideId, testLocation);
      Alert.alert('Success', 'Test location updated successfully!');

    } catch (error) {
      console.error('Error updating test location:', error);
      Alert.alert('Error', 'Failed to update test location');
    }
  };

  const handleViewActiveTracking = () => {
    const activeTracking = companionTrackingService.getActiveTracking();
    if (activeTracking.length === 0) {
      Alert.alert('No Active Tracking', 'There are no active tracking sessions.');
      return;
    }

    const tracking = activeTracking[0];
    navigation.navigate('CompanionTrackingScreen', { 
      trackingId: tracking.id, 
      rideId: tracking.rideId 
    });
  };

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Companion Tracking Demo</Text>
          <Text style={styles.headerSubtitle}>Test the real-time tracking system</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>🚀 Start Tracking a Ride</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Ride ID:</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}
              value={rideId}
              onChangeText={setRideId}
              placeholder="Enter ride ID"
              placeholderTextColor={isDarkMode ? '#cccccc' : '#666666'}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Traveler ID:</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}
              value={travelerId}
              onChangeText={setTravelerId}
              placeholder="Enter traveler ID"
              placeholderTextColor={isDarkMode ? '#cccccc' : '#666666'}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Destination Address:</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}
              value={destination}
              onChangeText={setDestination}
              placeholder="Enter destination address"
              placeholderTextColor={isDarkMode ? '#cccccc' : '#666666'}
            />
          </View>

          <View style={styles.coordinatesContainer}>
            <View style={styles.coordinateInput}>
              <Text style={styles.inputLabel}>Latitude:</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}
                value={latitude}
                onChangeText={setLatitude}
                placeholder="e.g., 37.78825"
                placeholderTextColor={isDarkMode ? '#cccccc' : '#666666'}
                keyboardType="numeric"
              />
            </View>
            
            <View style={styles.coordinateInput}>
              <Text style={styles.inputLabel}>Longitude:</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}
                value={longitude}
                onChangeText={setLongitude}
                placeholder="e.g., -122.4324"
                placeholderTextColor={isDarkMode ? '#cccccc' : '#666666'}
                keyboardType="numeric"
              />
            </View>
          </View>

          <TouchableOpacity style={styles.startButton} onPress={handleStartTracking}>
            <Text style={styles.startButtonText}>🚗 Start Tracking</Text>
          </TouchableOpacity>
        </View>

        {/* Test Actions Section */}
        <View style={styles.testSection}>
          <Text style={styles.sectionTitle}>🧪 Test Actions</Text>
          
                     <TouchableOpacity 
             style={[styles.testButton, { backgroundColor: '#10b981' }]} 
             onPress={handleTestLocationUpdate}
           >
             <Text style={styles.testButtonText}>📍 Update Test Location</Text>
           </TouchableOpacity>
           
           <TouchableOpacity 
             style={[styles.testButton, { backgroundColor: '#8b5cf6' }]} 
             onPress={handleTestNotification}
           >
             <Text style={styles.testButtonText}>🔔 Test Notification</Text>
           </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.testButton, { backgroundColor: '#3b82f6' }]} 
            onPress={handleViewActiveTracking}
          >
            <Text style={styles.testButtonText}>👁️ View Active Tracking</Text>
          </TouchableOpacity>
        </View>

        {/* Instructions Section */}
        <View style={styles.instructionsSection}>
          <Text style={styles.sectionTitle}>📋 How to Test</Text>
          
          <View style={styles.instructionCard}>
            <Text style={styles.instructionStep}>1. Fill in the form above with test data</Text>
            <Text style={styles.instructionStep}>2. Click "Start Tracking" to begin</Text>
            <Text style={styles.instructionStep}>3. Use "Update Test Location" to simulate driver movement</Text>
            <Text style={styles.instructionStep}>4. Click "View Active Tracking" to see real-time updates</Text>
            <Text style={styles.instructionStep}>5. The tracking screen will show live progress</Text>
          </View>
        </View>

        {/* Sample Data Section */}
        <View style={styles.sampleSection}>
          <Text style={styles.sectionTitle}>💡 Sample Test Data</Text>
          
          <View style={styles.sampleCard}>
            <Text style={styles.sampleTitle}>Ride ID:</Text>
            <Text style={styles.sampleText}>test_ride_001</Text>
            
            <Text style={styles.sampleTitle}>Traveler ID:</Text>
            <Text style={styles.sampleText}>traveler_123</Text>
            
            <Text style={styles.sampleTitle}>Destination:</Text>
            <Text style={styles.sampleText}>San Francisco, CA</Text>
            
            <Text style={styles.sampleTitle}>Coordinates:</Text>
            <Text style={styles.sampleText}>Lat: 37.78825, Lng: -122.4324</Text>
          </View>
        </View>

        {/* Back Button */}
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>🔙 Back to Dashboard</Text>
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
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    opacity: 0.9,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
  },
  formSection: {
    marginBottom: 25,
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333333',
  },
  coordinatesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  coordinateInput: {
    width: '48%',
  },
  startButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  testSection: {
    marginBottom: 25,
  },
  testButton: {
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
  },
  testButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  instructionsSection: {
    marginBottom: 25,
  },
  instructionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 20,
  },
  instructionStep: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 8,
    lineHeight: 22,
  },
  sampleSection: {
    marginBottom: 25,
  },
  sampleCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 20,
  },
  sampleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 5,
    marginTop: 10,
  },
  sampleText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 10,
    fontFamily: 'monospace',
  },
  backButton: {
    backgroundColor: '#6b7280',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CompanionTrackingDemo;
