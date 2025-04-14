import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, FlatList, TextInput, Platform, PermissionsAndroid } from 'react-native';
import LocationPicker from '../service/locationPicker';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { connectStorageEmulator } from 'firebase/storage';
import { useTheme } from '../service/themeContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { addDoc, collection } from 'firebase/firestore';
import { getDatabase, ref, push, set } from "firebase/database";
import { auth, db } from '../service/firebase'; // adjust path as needed

// const [date, setDate] = useState(new Date());
// const [showDatePicker, setShowDatePicker] = useState(false);
// const [showTimePicker, setShowTimePicker] = useState(false);

const RideBooking = () => {
  const { isDarkMode } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const [startLocation, setStartLocation] = useState('');
  const [startLat,setStartLat] = useState(26.4755);
  const [startLong,setStartLong] = useState(73.1149);
  const [endLat,setEndLat] = useState(26.4690);
  const [endLong,setEndLong] = useState(73.1259);
  const [lat, setLatitude] = useState(26.4755);
  const [long, setLongitude] = useState(73.1149);
  const [endLocation, setEndLocation] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [startSuggestions, setStartSuggestions] = useState([]);
  const [endSuggestions, setEndSuggestions] = useState([]);
  const [showStartMapOption, setShowStartMapOption] = useState(false);
  const [showEndMapOption, setShowEndMapOption] = useState(false);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSelectingStartSuggestion, setIsSelectingStartSuggestion] = useState(false);
  const [isSelectingEndSuggestion, setIsSelectingEndSuggestion] = useState(false);  
  const [requestId, setRequestId] = useState(""); // State to hold the request ID


  const GOOGLE_MAPS_API_KEY = 'AIzaSyBGdExMD_KJEa-QVVZGM4bsLbVLfxFMGLA'; // Replace with your actual API key


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
      console.error('Error fetching location:', error);
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
      console.error('Error fetching location:', error);
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
      console.error('Error fetching location:', error);
    }
  }
  const onDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(false);
    setDate(currentDate);
  };

  const onTimeChange = (event, selectedTime) => {
    const currentTime = selectedTime || date;
    setShowTimePicker(false);
    setDate(currentTime); // Same state holds both date and time
  };


  // Function to fetch location suggestions from API
  const fetchLocationSuggestions = async (query, setSuggestions) => {
    if (!query) return setSuggestions([]);

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${query}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();

      if (data.status === 'OK') {
        const predictions = data.predictions.map((item) => ({
          place_id: item.place_id,
          description: item.description,
        }));

        setSuggestions(predictions);
      } else {
        console.error('Error fetching location suggestions:', data.status);
        setSuggestions([]);
      }
    } catch (error) {
      console.error('Error fetching location suggestions:', error);
    }
  };

  const getCoordinatesFromAddress = async (address) => {
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
      console.error('Geocode error:', error);
      return null;
    }
  };

  const handleStartAddressChange = async (text) => {
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
  
  const handleEndAddressChange = async (text) => {
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

  const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const toRad = (val) => (val * Math.PI) / 180;
    const R = 6371; // Earth radius in km
  
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
  
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };  


  const addRideRequestToRealtimeDB = async () => {

    const resp1=await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${startLat},${startLong}&destination=${endLat},${endLong}&departure_time=now&key=${GOOGLE_MAPS_API_KEY}`);
    const data1=await resp1.json();
    const duration=data1.routes[0].legs[0].duration.value;
    const trafficDuration=data1.routes[0].legs[0].duration_in_traffic.value;
    const trafficFactor=trafficDuration/duration;
    const dist=haversineDistance(startLat, startLong,endLat,endLong);
    const currentHour = new Date().getHours();
    const timeOfDayFactor = 
      (currentHour >= 8 && currentHour <= 10) || (currentHour >= 18 && currentHour <= 21)
      ? 1.2 // Rush hour
      : 1.0;
    const amt:Number =calculateDynamicFare(dist,duration, trafficFactor,timeOfDayFactor);

    console.log('Adding ride request to Realtime DB');
    const user = auth.currentUser;
    if (!user) {
      console.error('No user logged in');
      return;
    }
    
    const db = getDatabase(); // get Realtime DB instance
    const rideRequestRef = ref(db, 'rideRequests');
    const newRequestRef = push(rideRequestRef); // generate unique ID
  
    const payload = {
      userId: user.uid,
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
      amount : Number(amt),
      driverAccepted: false,
    };
  
    await set(newRequestRef, payload);
    const reqId = newRequestRef.key;
    console.log('Ride request ID:', reqId);
    setRequestId(reqId); // Store the request ID in state
    console.log('Ride request pushed to Realtime DB');
    return reqId;
  };

  function calculateDynamicFare(
    distance ,
    duration,
    trafficFactor,
    timeOfDayFactor 
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
              onLocationSelect: async (lat, long) => {
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
              onLocationSelect: async (lat, long) => {
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

      <TouchableOpacity
        style={styles.bookButton}
        onPress={async () => {
          try {
            console.log('inside book button')
            const req= await addRideRequestToRealtimeDB();
              console.log('startLat', startLat,'startLog', startLong)
              console.log('endLat', endLat,'endLog', endLong)
              console.log('requestId', req) 
              navigation.navigate('RideWaiting', {
                origin: { latitude: startLat, longitude: startLong }, 
                destination: { latitude: endLat, longitude: endLong}, 
                realtimeId: req,
              });
          } catch (error) {
            console.error('Error booking ride:', error);
            Alert.alert('Error', 'Failed to book ride. Please try again.');
          }
        }}
      >
        <Text style={styles.bookButtonText}>Book Ride</Text>
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
