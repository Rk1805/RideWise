import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, FlatList, TextInput, Platform, PermissionsAndroid } from 'react-native';
import LocationPicker from '../service/locationPicker';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { connectStorageEmulator } from 'firebase/storage';
import { useTheme } from '../service/themeContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { addDoc, collection } from 'firebase/firestore';
import { ref, push, set } from "firebase/database";
import { auth, realtimeDb, db } from '../service/firebase';
import { GOOGLE_MAPS_API_KEY } from '@env';

interface LocationSuggestion {
  place_id: string;
  description: string;
}

interface Coordinates {
  lat: number;
  lng: number;
}

const RideBooking = () => {
  const { isDarkMode } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [startLocation, setStartLocation] = useState('');
  const [startLat,setStartLat] = useState(26.4755);
  const [startLong,setStartLong] = useState(73.1149);
  const [endLat,setEndLat] = useState(26.4690);
  const [endLong,setEndLong] = useState(73.1259);
  const [lat, setLatitude] = useState(26.4755);
  const [long, setLongitude] = useState(73.1149);
  const [endLocation, setEndLocation] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [startSuggestions, setStartSuggestions] = useState<LocationSuggestion[]>([]);
  const [endSuggestions, setEndSuggestions] = useState<LocationSuggestion[]>([]);
  const [showStartMapOption, setShowStartMapOption] = useState(false);
  const [showEndMapOption, setShowEndMapOption] = useState(false);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSelectingStartSuggestion, setIsSelectingStartSuggestion] = useState(false);
  const [isSelectingEndSuggestion, setIsSelectingEndSuggestion] = useState(false);  
  const [requestId, setRequestId] = useState(""); // State to hold the request ID
  const [calculatedAmount, setCalculatedAmount] = useState<number | null>(null);
  const [showAmount, setShowAmount] = useState(false);
  const [isFareEstimated, setIsFareEstimated] = useState(false);
  const [isBooking, setIsBooking] = useState(false);



  const getCurrentLocation = async () => {
    try {
      const response = await fetch(
        `https://www.googleapis.com/geolocation/v1/geolocate?key=${GOOGLE_MAPS_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );
      const data = await response.json();
      console.log('Current Location:', data);
      setLatitude(data.location.lat);
      setLongitude(data.location.lng);
      getStartAddress();
      // Example:
      // data.location.lat, data.location.lng
    } catch (error) {
      // Error fetching location
    }
  };

  const getStartAddress = async () => {
    try {
      console.log(lat,long)
      console.log(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${long}&key=${GOOGLE_MAPS_API_KEY}`)
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${long}&key=${GOOGLE_MAPS_API_KEY}`,
        {
          method: 'GET',
        }
      );
      const data = await response.json();
      if (data.status == 'OK') {
        const address = data.results[0].formatted_address;
        setStartLocation(address);
        setStartLat(lat);
        setStartLong(long);
        console.log(startLocation)
      }
    } catch (error) {
      // Error fetching location
    }
  }
  const getEndAddress = async () => {
    try {
      console.log(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${long}&key=${GOOGLE_MAPS_API_KEY}`)
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${long}&key=${GOOGLE_MAPS_API_KEY}`,
        {
          method: 'GET',
        }
      );
      const data = await response.json();
      console.log(data)
      if (data.status == 'OK') {
        console.log('Current Location:', data);
        const address = data.results[0].formatted_address;
        setEndLocation(address);
        setEndLat(lat);
        setEndLong(long);
        console.log('addr', address)
        console.log(endLocation)
      }
    } catch (error) {
      // Error fetching location
    }
  }
  const onDateChange = (event: any, selectedDate: Date | undefined) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(false);
    setDate(currentDate);
  };

  const onTimeChange = (event: any, selectedTime: Date | undefined) => {
    const currentTime = selectedTime || date;
    setShowTimePicker(false);
    setDate(currentTime); // Same state holds both date and time
  };


  // Function to fetch location suggestions from API
  const fetchLocationSuggestions = async (query: string, setSuggestions: React.Dispatch<React.SetStateAction<LocationSuggestion[]>>) => {
    if (!query) return setSuggestions([]);

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${query}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();

      if (data.status === 'OK') {
        const predictions = data.predictions.map((item: any) => ({
          place_id: item.place_id,
          description: item.description,
        }));

        setSuggestions(predictions);
      } else {
        // Error fetching location suggestions
        setSuggestions([]);
      }
    } catch (error) {
      // Error fetching location suggestions
    }
  };

  const getCoordinatesFromAddress = async (address: string): Promise<Coordinates | null> => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();
  
      if (data.status === 'OK') {
        const { lat, lng } = data.results[0].geometry.location;
        return { lat, lng };
      } else {
        console.warn('Geocode failed:', data.status);
        return null;
      }
    } catch (error) {
      // Geocode error
      return null;
    }
  };

  const handleStartAddressChange = async (text: string) => {
    setStartLocation(text);
  
    if (!isSelectingStartSuggestion) {
      fetchLocationSuggestions(text, setStartSuggestions);
    }
  
    const coords = await getCoordinatesFromAddress(text);
    if (coords) {
      setStartLat(coords.lat);
      setStartLong(coords.lng);
    }
  
    setIsSelectingStartSuggestion(false); // reset
  };
  
  const handleEndAddressChange = async (text: string) => {
    setEndLocation(text);
  
    if (!isSelectingEndSuggestion) {
      fetchLocationSuggestions(text, setEndSuggestions);
    }
  
    const coords = await getCoordinatesFromAddress(text);
    if (coords) {
      setEndLat(coords.lat);
      setEndLong(coords.lng);
    }
  
    setIsSelectingEndSuggestion(false);
  };

  const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const toRad = (val: number) => (val * Math.PI) / 180;
    const R = 6371; // Earth radius in km
  
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
  
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };  


  // Separate function to estimate fare
  const estimateFare = async () => {
    if (!startLocation || !endLocation) {
      Alert.alert('Error', 'Please select both start and end locations');
      return;
    }

    try {
      setIsBooking(true);
      const resp1 = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${startLat},${startLong}&destination=${endLat},${endLong}&departure_time=now&key=${GOOGLE_MAPS_API_KEY}`);
      const data1 = await resp1.json();
      
      if (data1.status !== 'OK' || !data1.routes || data1.routes.length === 0) {
        Alert.alert('Error', 'Unable to calculate route. Please check your locations.');
        return;
      }

      const duration = data1.routes[0].legs[0].duration.value;
      const trafficDuration = data1.routes[0].legs[0].duration_in_traffic?.value || duration;
      const trafficFactor = trafficDuration / duration;
      const dist = haversineDistance(startLat, startLong, endLat, endLong);
      const currentHour = new Date().getHours();
      const timeOfDayFactor = 
        (currentHour >= 8 && currentHour <= 10) || (currentHour >= 18 && currentHour <= 21)
        ? 1.2 // Rush hour
        : 1.0;
      
      const amt: Number = calculateDynamicFare(dist, duration, trafficFactor, timeOfDayFactor);
      
      // Set the calculated amount to display
      setCalculatedAmount(Number(amt));
      setShowAmount(true);
      setIsFareEstimated(true);
      
      console.log('Fare estimated successfully:', {
        distance: dist,
        duration: duration,
        trafficFactor: trafficFactor,
        timeOfDayFactor: timeOfDayFactor,
        amount: amt
      });
      
    } catch (error) {
      Alert.alert('Error', 'Failed to estimate fare. Please try again.');
    } finally {
      setIsBooking(false);
    }
  };

  const addRideRequestToRealtimeDB = async () => {
    if (!isFareEstimated) {
      Alert.alert('Error', 'Please estimate fare first before booking');
      return;
    }

    try {
      setIsBooking(true);
      const resp1 = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${startLat},${startLong}&destination=${endLat},${endLong}&departure_time=now&key=${GOOGLE_MAPS_API_KEY}`);
      const data1 = await resp1.json();
      const duration = data1.routes[0].legs[0].duration.value;
      const trafficDuration = data1.routes[0].legs[0].duration_in_traffic?.value || duration;
      const trafficFactor = trafficDuration / duration;
      const dist = haversineDistance(startLat, startLong, endLat, endLong);
      const currentHour = new Date().getHours();
      const timeOfDayFactor = 
        (currentHour >= 8 && currentHour <= 10) || (currentHour >= 18 && currentHour <= 21)
        ? 1.2 // Rush hour
        : 1.0;
                  const amt: Number = calculateDynamicFare(dist, duration, trafficFactor, timeOfDayFactor);
      
      console.log('Adding ride request to Realtime DB');
      const user = auth.currentUser;
      if (!user) {
        return;
      }
      
      const rideRequestRef = ref(realtimeDb, 'rideRequests');
      const newRequestRef = push(rideRequestRef); // generate unique ID
    
      const payload = {
        userID: user.uid,
        userName: user.displayName || 'Anonymous',
        from: startLocation,
        to: endLocation,
        startLat,
        startLong,
        endLat,
        endLong,
        date: date.toDateString(),
        time: new Date().toISOString(),
        requestedAt: Date.now(),
        status: 'requested',
        distance: dist,
        duration: duration,
        amount: Number(amt),
        driverAccepted: false,
      };
    
      await set(newRequestRef, payload);
      const reqId = newRequestRef.key;
      console.log('Ride request ID:', reqId);
      setRequestId(reqId); // Store the request ID in state
      console.log('Ride request pushed to Realtime DB');
      
      // Save to Firestore history collection
      try {
        await addDoc(collection(db, 'history'), {
          userID: payload.userID,
          rideID: reqId,
          from: payload.from,
          to: payload.to,
          startLat: payload.startLat,
          startLong: payload.startLong,
          endLat: payload.endLat,
          endLong: payload.endLong,
          date: payload.date,
          time: payload.time,
          amount: payload.amount.toString(),
          distance: payload.distance.toString(),
          duration: payload.duration,
          status: payload.status,
          type: 'individual',
          timestamp: new Date(),
          userName: payload.userName
        });
        console.log('Ride saved to Firestore history');
      } catch (error) {
        // Error saving to history
      }
      
      return reqId;
    } catch (error) {
      Alert.alert('Error', 'Failed to book ride. Please try again.');
      return null;
    } finally {
      setIsBooking(false);
    }
  };

  function calculateDynamicFare(
    distance : number,
    duration: number,
    trafficFactor: number,
    timeOfDayFactor : number 
  ) {
    const baseFare = 30,perKmRate = 12,perMinRate = 2,demandIndex = 1,weatherFactor = 1.0,tolls = 0,minimumFare = 5;
    const surgeMultiplier = 1 + ((demandIndex - 1) * 0.25);
  
    const distanceFare = distance * perKmRate;
    const timeFare = duration/60 * perMinRate * trafficFactor;
  
    let total = (baseFare + distanceFare + timeFare)
                * surgeMultiplier 
                * timeOfDayFactor
                * weatherFactor
                + tolls;
    console.log('Total:', total);
  
    return parseFloat(Math.max(total, minimumFare).toFixed(2));
  }

  return (
    <View style={[styles.container, isDarkMode && styles.darkBackground]}>
      <Text style={[styles.header, isDarkMode && styles.darkText]}>Book a Ride</Text>

      <View style={[styles.inputContainer, isDarkMode && styles.darkInputContainer]}>
        <TextInput
          style={[styles.textInput, isDarkMode && styles.darkTextInput]}
          placeholder="Enter Start Location"
          placeholderTextColor={isDarkMode ? '#aaa' : '#888'}
          value={startLocation}
          onChangeText={(text) => {
            handleStartAddressChange(text);
          }}
          onFocus={() => setShowStartMapOption(true)}
          onBlur={() => setShowStartMapOption(false)}
        />
        <TouchableOpacity onPress={getCurrentLocation} style={styles.locationButton}>
          {loadingLocation ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.buttonText}>🎯</Text>
          )}
        </TouchableOpacity>
      </View>



      {showStartMapOption && (
        <TouchableOpacity
          style={styles.pickLocationButton}
          onPress={() =>
            navigation.navigate('LocationPicker', {
              latitude: lat,
              longitude: long,
              which: 'start',
                             onLocationSelect: async (lat: number, long: number) => {
                 setLatitude(lat);
                 setLongitude(long);
                 await getStartAddress();
               },
            })
          }
        >
          <Text style={styles.buttonText}>📍 Mark Start Location on Map</Text>
        </TouchableOpacity>
      )}

      {startSuggestions.length > 0 && (
        <FlatList
          data={startSuggestions}
          keyExtractor={(item) => item.place_id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.suggestionItem, isDarkMode && styles.darkSuggestionItem]}
              onPress={async () => {
                setIsSelectingStartSuggestion(true);
                setStartLocation(item.description);
                await handleStartAddressChange(item.description);
                setStartSuggestions([]);
              }}
            >
              <Text style={isDarkMode && styles.darkText}>{item.description}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <View style={[styles.inputContainer, isDarkMode && styles.darkInputContainer]}>
        <TextInput
          style={[styles.textInput, isDarkMode && styles.darkTextInput]}
          placeholder="Enter End Location"
          placeholderTextColor={isDarkMode ? '#aaa' : '#888'}
          value={endLocation}
          onChangeText={(text) => {
            handleEndAddressChange(text);
          }}
          onFocus={() => setShowEndMapOption(true)}
          onBlur={() => setShowEndMapOption(false)}
        />
      </View>

      {showEndMapOption && (
        <TouchableOpacity
          style={styles.pickLocationButton}
          onPress={() =>
            navigation.navigate('LocationPicker', {
              latitude: lat,
              longitude: long,
              which: 'end',
                             onLocationSelect: async (lat: number, long: number) => {
                 setLatitude(lat);
                 setLongitude(long);
                 await getEndAddress();
               },
            })
          }
        >
          <Text style={styles.buttonText}>📍 Mark End Location on Map</Text>
        </TouchableOpacity>
      )}



      {endSuggestions.length > 0 && (
        <FlatList
          data={endSuggestions}
          keyExtractor={(item) => item.place_id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.suggestionItem, isDarkMode && styles.darkSuggestionItem]}
              onPress={async() => {
                setIsSelectingEndSuggestion(true);
                setEndLocation(item.description);
                await handleEndAddressChange(item.description);
                setEndSuggestions([]);
              }}
            >
              <Text style={isDarkMode && styles.darkText}>{item.description}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Show calculated amount */}
      {calculatedAmount && (
        <View style={[styles.amountContainer, isDarkMode && styles.darkAmountContainer]}>
          <Text style={[styles.amountLabel, isDarkMode && styles.darkText]}>
            Estimated Fare:
          </Text>
          <Text style={[styles.amountValue, isDarkMode && styles.darkText]}>
            ₹{calculatedAmount}
          </Text>
        </View>
      )}

      <View style={{ marginTop: 10 }}>
        <Text style={[{ fontSize: 16, marginBottom: 5 }, isDarkMode && styles.darkText]}>
          Selected Date: {date.toDateString()}
        </Text>
        <TouchableOpacity
          style={styles.pickLocationButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.buttonText}>📅 Pick Date</Text>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            onChange={onDateChange}
          />
        )}

        <Text style={[{ fontSize: 16, marginVertical: 5 }, isDarkMode && styles.darkText]}>
          Selected Time: {date.toLocaleTimeString()}
        </Text>
        <TouchableOpacity
          style={styles.pickLocationButton}
          onPress={() => setShowTimePicker(true)}
        >
          <Text style={styles.buttonText}>⏰ Pick Time</Text>
        </TouchableOpacity>

        {showTimePicker && (
          <DateTimePicker
            value={date}
            mode="time"
            display="default"
            onChange={onTimeChange}
          />
        )}
      </View>

      {/* Estimate Fare Button */}
      <TouchableOpacity
        style={[styles.estimateButton, isFareEstimated && styles.estimatedButton]}
        onPress={estimateFare}
        disabled={isBooking || !startLocation || !endLocation}
      >
        <Text style={styles.estimateButtonText}>
          {isBooking ? 'Calculating...' : isFareEstimated ? '✓ Fare Estimated' : '💰 Estimate Fare'}
        </Text>
      </TouchableOpacity>

      {/* Book Ride Button - Only enabled after fare estimation */}
      <TouchableOpacity
        style={[styles.bookButton, !isFareEstimated && styles.disabledButton]}
        onPress={async () => {
          try {
            console.log('inside book button')
            const req = await addRideRequestToRealtimeDB();
            if (req) {
              console.log('startLat', startLat,'startLog', startLong)
              console.log('endLat', endLat,'endLog', endLong)
              console.log('requestId', req) 
              navigation.navigate('RideWaiting', {
                origin: { latitude: startLat, longitude: startLong }, 
                destination: { latitude: endLat, longitude: endLong}, 
                realtimeId: req,
              });
            }
          } catch (error) {
            Alert.alert('Error', 'Failed to book ride. Please try again.');
          }
        }}
        disabled={!isFareEstimated || isBooking}
      >
        <Text style={styles.bookButtonText}>
          {isBooking ? 'Booking...' : '🚗 Book Ride'}
        </Text>
      </TouchableOpacity>

    </View >
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f3f4f6',
  },
  darkBackground: {
    backgroundColor: '#000',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 20,
    textAlign: 'center',
  },
  darkText: {
    color: '#fff',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: 'white',
    borderRadius: 10,
    elevation: 3,
    paddingHorizontal: 10,
  },
  darkInputContainer: {
    backgroundColor: '#1e1e1e',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    padding: 10,
    color: '#000',
  },
  darkTextInput: {
    color: '#fff',
  },
  locationButton: {
    backgroundColor: '#3b82f6',
    padding: 10,
    borderRadius: 8,
    marginLeft: 10,
  },
  pickLocationButton: {
    backgroundColor: '#4285F4',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  suggestionItem: {
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    zIndex: 1,
    elevation: 2,
  },
  darkSuggestionItem: {
    backgroundColor: '#1e1e1e',
  },
  estimateButton: {
    backgroundColor: '#10b981',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  estimatedButton: {
    backgroundColor: '#059669',
  },
  estimateButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  bookButton: {
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
    opacity: 0.6,
  },
  bookButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  amountContainer: {
    backgroundColor: '#f0f8ff',
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  darkAmountContainer: {
    backgroundColor: '#1e3a8a',
    borderColor: '#60a5fa',
  },
  amountLabel: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 5,
  },
  amountValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#059669',
  },
});


export default RideBooking;
