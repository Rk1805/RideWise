import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions, TouchableOpacity,Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { getDatabase, ref, onValue, off,ref as dbRef, set ,remove} from 'firebase/database';
import { useTheme } from '../service/themeContext';
import { update} from 'firebase/database';
import { collection,addDoc, updateDoc,doc, arrayUnion } from 'firebase/firestore';
import {db,auth} from '../service/firebase';
import { AirbnbRating } from 'react-native-ratings';
import Modal from 'react-native-modal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation,CommonActions } from '@react-navigation/native';
import { GOOGLE_MAPS_API_KEY } from '@env';

const { width, height } = Dimensions.get('window');

type Props = {
  route: {
    params: {
      origin: { latitude: number; longitude: number };
      destination: { latitude: number; longitude: number };
      realtimeId: string;
    };
  };
};


const RideWaiting: React.FC<Props> = ({ route }) => {
  const navigation = useNavigation();
  const { isDarkMode } = useTheme();
  const mapRef = useRef<MapView>(null);
  const { origin, destination, realtimeId } = route.params;

  const [rideStatus, setRideStatus] = useState<string>('requested');
  const [driverDetails, setDriverDetails] = useState<{ driverId: string; driverName: string } | null>(null);
  const [vehicleInfo, setVehicleInfo] = useState<{
    make: string;
    model: string;
    year: string;
    color: string;
    licensePlate: string;
  } | null>(null);
  const [otp, setOtp] = useState<string | null>(null);
  const [otpGenerated, setOtpGenerated] = useState<boolean>(false); // prevent multiple OTP generations
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [otpVerified, setOtpVerified] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(0);


  // Fit map view
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.fitToCoordinates([origin, destination], {
        edgePadding: { top: 80, right: 80, bottom: 180, left: 80 },
        animated: true,
      });
    }
  }, [origin, destination]);

  const calculateDuration = (startTime: string, endTime: string) => {
    const start = new Date(startTime);
    console.log('Start:', start);
    const end = new Date(endTime);
    console.log('End:', end);
  
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.error('Invalid date format for duration calculation', { startTime, endTime });
      return 0;
    }
  
    const durationInMs = end.getTime() - start.getTime();
    console.log('Duration in ms:', durationInMs);
    return Math.floor(durationInMs / 60000);
  };

  const generateOtp = () => Math.floor(1000 + Math.random() * 9000).toString();

  const listenToRideRequest = (realtimeId, setRideStatus, setDriverDetails) => {
    if (!realtimeId) return; 
    const d = getDatabase();
    const rideRef = ref(d, `rideRequests/${realtimeId}`);
  
    const unsubscribe = onValue(rideRef, async (snapshot) => {
      const rideData = snapshot.val();
      console.log('Ride status updated:', rideData);
  
      if (rideData?.status) {
        setRideStatus(rideData.status);
  
        if (rideData.status === 'active' && rideData.driverId && rideData.driverName) {
          setDriverDetails({
            driverId: rideData.driverId,
            driverName: rideData.driverName,
          });
  
          if (rideData.driverLocation?.longitude && rideData.driverLocation?.latitude) {
            setDriverLocation({
              latitude: rideData.driverLocation.latitude,
              longitude: rideData.driverLocation.longitude,
            });
          }
  
          if (!rideData.otp && !otpGenerated) {
            const generatedOtp = generateOtp();
            await update(rideRef, { otp: generatedOtp, otpVerified: false });
            setOtp(generatedOtp);
            setOtpGenerated(true);
          } else if (rideData.otp && !otp) {
            setOtp(rideData.otp);
          }
  
          if (rideData.otpVerified) {
            setOtpVerified(true);
          }
          console.log(rideData)
          if (rideData?.vehicleInfo) {
            setVehicleInfo(rideData.vehicleInfo);
          }
          if(rideData?.driverAccepted){
            setRideStatus('active');
          }
          if(!rideData.driverAccepted){
            setRideStatus('requested');
          }
        }
      }
      if (rideData?.isRideCompleted && !rideData?.isUserConfirmed) {
        console.log('Ride completed:', rideData);
        Alert.alert(
          'Ride Completed',
          'Your driver has dropped you off. Confirm completion?',
          [
            {
              text: 'Confirm',
              onPress: async () => {
                
                console.log('User confirmed ride completion');
                setShowRatingModal(true);         
                const dur=calculateDuration(rideData.time, new Date().toISOString());
                await addDoc(collection(db, 'history'), {
                    userId: rideData.userId,
                    date: new Date().toISOString(),
                    time: new Date().toLocaleTimeString(),
                    from: rideData.from,
                    to: rideData.to,
                    amount: Number(rideData.amount) || 100,
                    user: rideData.userName,
                    driverId:rideData.driverId,
                    driverName:rideData.driverName,
                    status: 'Completed',
                    distance:rideData.distance,
                    duration:dur,
                  });
              },
            },
            {
              text: 'Cancel',
              style: 'cancel',
            },
          ],
          { cancelable: false }
        );
      }
    });
  
    return () => off(rideRef);
  };

  // Listen for ride status updates
  useEffect(() => {
    if (!realtimeId) return;

    const unsubscribe = listenToRideRequest(realtimeId, setRideStatus, setDriverDetails);
    return unsubscribe;
  }, [realtimeId]);

  const handleCancelBooking = async () => {
    const db = getDatabase();
    const rideRef = ref(db, `rideRequests/${realtimeId}`);
    await remove(rideRef);
    navigation.goBack();
    setRideStatus('cancelled');
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation
        followsUserLocation
        initialRegion={{
          latitude: origin.latitude,
          longitude: origin.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        customMapStyle={isDarkMode ? darkMapStyle : []}
      >
        

            {!otpVerified ? (
            // Show route from driver to pickup
            <>
                {driverLocation && <Marker coordinate={driverLocation} title="Driver" pinColor="blue" />}
                <Marker coordinate={origin} title="Pickup" />
            </>
            ) : (
            // After OTP is verified, show route from pickup to destination
            <>
            <Marker coordinate={destination} title="destination" pinColor='red'/>
            <MapViewDirections
                origin={driverLocation}
                destination={destination}
                apikey={GOOGLE_MAPS_API_KEY}
                strokeWidth={5}
                strokeColor="#4CAF50"
            />
            </>
        )}
      </MapView>

      <View style={[styles.waitingContainer, { backgroundColor: isDarkMode ? '#1e1e1e' : '#fff' }]}>
        {rideStatus === 'active' && driverDetails ? (
          <>
            <Text style={[styles.waitingText, { color: isDarkMode ? '#fff' : '#000' }]}>
              Driver Found!
            </Text>
            <Text style={[styles.waitingText, { color: '#FFA72F', marginTop: 5 }]}>
              {driverDetails.driverName}
            </Text>
            {otp && rideStatus=='active' && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Driver Details</Text>

                    <Text style={styles.infoText}>👤 {driverDetails.driverName}</Text>
                    <Text style={styles.infoText}>🔐 OTP: <Text style={styles.highlight}>{otp}</Text></Text>

                    <Text style={[styles.cardTitle, { marginTop: 15 }]}>Vehicle Info</Text>
                    <Text style={styles.infoText}>🚗 {vehicleInfo.year} {vehicleInfo.make} {vehicleInfo.model}</Text>
                    <Text style={styles.infoText}>🎨 Color: {vehicleInfo.color}</Text>
                    <Text style={styles.infoText}>🔢 Plate: {vehicleInfo.licensePlate}</Text>
                </View>
             )}
          </>
        ) : (
          <>
            <Text style={[styles.waitingText, { color: isDarkMode ? '#fff' : '#000' }]}>
              Looking for drivers...
            </Text>
            <ActivityIndicator size="large" color="#FFA72F" style={{ marginTop: 10 }} />
            <TouchableOpacity onPress={()=>handleCancelBooking()}>
                <Text style={[styles.waitingText, { color: '#FFA72F', marginTop: 15 }]}>
                     Cancel Booking
                </Text>
            </TouchableOpacity>
          </>
        )}
            <Modal isVisible={showRatingModal}>
      <View style={styles.ratingContainer}>
        <Text style={styles.ratingTitle}>Rate the driver</Text>
        <AirbnbRating
          defaultRating={5}
          showRating={false}
          onFinishRating={(value) => setRating(value)}
        />
        <TouchableOpacity
          style={styles.ratingButton}
          onPress={async () => {
            setShowRatingModal(false);
            try {
                const d = getDatabase();
                console.log('rating:',rating)
                const rideRef = ref(d, `rideRequests/${realtimeId}`);
                await update(rideRef, { isUserConfirmed: true ,Rating:rating});
              Alert.alert('Thank you!', 'Your rating has been submitted.');
              
              // ✅ Now reset navigation to Dashboard
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'Dashboard' }],
                })
              );
            } catch (e) {
              console.error('Rating submission error:', e);
              Alert.alert('Error', 'Failed to submit rating.');
            }
          }}
        >
          <Text style={styles.ratingButtonText}>Submit</Text>
        </TouchableOpacity>
      </View>
    </Modal>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width,
    height: height * 0.75,
  },
  waitingContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: 25,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
    alignItems: 'center',
  },
  waitingText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#FFF8F0',
    padding: 18,
    borderRadius: 16,
    marginTop: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6F4E37',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 15,
    color: '#333',
    marginVertical: 2,
  },
  highlight: {
    fontWeight: 'bold',
    color: '#FF5722',
  },
  ratingContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 6,
  },
  
  ratingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  
  ratingButton: {
    marginTop: 20,
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  
  ratingButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

const darkMapStyle = [
  {
    elementType: 'geometry',
    stylers: [{ color: '#242f3e' }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#242f3e' }],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#746855' }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#263c3f' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6b9a76' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#38414e' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#212a37' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9ca5b3' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#2f3948' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#17263c' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#515c6d' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#17263c' }],
  },
  
];

export default RideWaiting;