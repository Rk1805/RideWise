import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, TextInput } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const RideBooking = () => {
  const [startLocation, setStartLocation] = useState('IIT Jodhpur');
  const [endLocation, setEndLocation] = useState('Jodhpur Airport');
  const [loadingLocation, setLoadingLocation] = useState(false);

  // Dummy function to simulate fetching live location
  const getCurrentLocation = () => {
    setLoadingLocation(true);
    setTimeout(() => {
      setStartLocation('Current Location: IIT Jodhpur, Nh-62, Nagaur Road, Najariya, Jodhpur, Rajasthan 342037');
      setLoadingLocation(false);
    }, 1500);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Book a Ride</Text>

      {/* Start Location Search (Dummy Data) */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={startLocation}
          onChangeText={setStartLocation}
          placeholder="Enter Start Location"
        />
        <TouchableOpacity onPress={getCurrentLocation} style={styles.locationButton}>
          {loadingLocation ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <MaterialCommunityIcons name="crosshairs-gps" size={24} color="white" />
          )}
        </TouchableOpacity>
      </View>

      {/* End Location Search (Dummy Data) */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={endLocation}
          onChangeText={setEndLocation}
          placeholder="Enter Destination"
        />
      </View>

      {/* Book Ride Button */}
      <TouchableOpacity
        style={styles.bookButton}
        onPress={() => Alert.alert('Ride Booked!', `From: ${startLocation}\nTo: ${endLocation}`)}
      >
        <Text style={styles.bookButtonText}>Book Ride</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f3f4f6',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    elevation: 3,
    paddingHorizontal: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    padding: 10,
    borderRadius: 8,
  },
  locationButton: {
    backgroundColor: '#3b82f6',
    padding: 10,
    borderRadius: 8,
    marginLeft: 10,
  },
  bookButton: {
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  bookButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
});

export default RideBooking;