import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LogBox } from 'react-native';
import LandingPage from "./components/LandingPage";
import Login from "./components/loginPage";
import DriverLogin from "./components/DriverLogin";
import Dashboard from './components/dashboard';
import DriverDashboard from './components/DriverDashboard';
import RideBooking from './components/rideBooking';
import LocationPicker from './service/locationPicker';
import CarpoolScreen from './components/CarpoolScreen';
import InboxScreen from './components/InboxScreen';
import GroupDetails from './components/GroupDetailsScreen';
import OfferRideScreen from './components/OfferRideScreen';
import RideHistory from './components/RideHistory';
import DriverRideHistory from './components/DriverRideHistory';
import RideRequests from './components/RideRequests';
import DriverVerification from './components/DriverVerification';
import UsernameScreen from './components/UsernameScreen';
import UpdateProfile from './components/UpdateProfile';
import { ThemeProvider } from './service/themeContext';
import Settings from './components/settings';
import GroupDetailsScreen from './components/GroupDetailsScreen';
import ResetPassword from './components/ResetPassword';
import RideWaiting from './components/rideWaiting';
import DriverRouteScreen from './components/DriverRouteScreen';
import DriverSettings from './components/DriverSettings';
import DriverUsername from './components/DriverUsername';
import AnalyticsScreen from './components/AnalyticsScreen';
import DriverVehicleDetailsScreen from './components/DriverVehicleDetailsScreen';
import Profile from './components/Profile';
import GroupScreen from './components/GroupScreen';
import MembersScreen from './components/MembersScreen';
import AdminDashboard from './components/AdminDashboard';
import AdminRatingsScreen from './components/AdminRatingsScreen';
import CarpoolBooking from './components/CarpoolBooking';
import CarpoolWaiting from './components/CarpoolWaiting';

import AdminLogin from './components/AdminLogin';
import CompanionUserRegistration from './components/CompanionUserRegistration';
import CompanionDashboard from './components/CompanionDashboard';
import CompanionTrackingScreen from './components/CompanionTrackingScreen';
import CompanionTrackingDemo from './components/CompanionTrackingDemo';
import CompanionRideHistory from './components/CompanionRideHistory';
import CompanionSettings from './components/CompanionSettings';
import LinkToTraveler from './components/LinkToTraveler';
import ShareTravelerID from './components/ShareTravelerID';
import RideSharing from './components/RideSharing';
import FeedbackForm from './components/FeedbackForm';
import TestCompanionNotification from './components/TestCompanionNotification';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export type RootStackParamList = {
  LandingPage: undefined;
  Login: undefined;
  DriverLogin: undefined;
  Dashboard: undefined;
  DriverDashboard: undefined;
  RideBooking: undefined;
  LocationPicker: {
    latitude: number;
    longitude: number;
    which: string;
    onLocationSelect: (lat: number, long: number) => void;
  };
  CarpoolScreen: undefined;
  Settings: undefined;
  DriverSettings: undefined;
  OfferRideScreen: {
    tripId: string;
    users: any[];
  };
  InboxScreen: undefined;
  RideHistory: undefined;
  DriverRideHistory: undefined;
  RideRequests: undefined;
  DriverVerification: undefined;
  UsernameScreen: { uid: string };
  UpdateProfile: { uid: string };
  ResetPassword: undefined;
  RideWaiting: {
    origin: { latitude: number; longitude: number };
    destination: { latitude: number; longitude: number };
    realtimeId: string;
  };
  DriverRouteScreen: {
    origin: { latitude: number; longitude: number };
    destination: { latitude: number; longitude: number };
    realtimeId: string;
  };
  DriverUsername: { uid: string };
  AnalyticsScreen: undefined;
  DriverVehicleDetailsScreen: undefined;
  GroupScreen: undefined;
  MembersScreen: {
    groupId: string;
  };
  GroupDetails: {
    groupId: string;
    groupName: string;
    members: any[];
  };
  GroupDetailsScreen: {
    groupId: string;
    groupName: string;
    members: any[];
  };
  Profile: undefined;
  AdminDashboard: undefined;
  AdminRatingsScreen: undefined;
  AdminLogin: undefined;
  CompanionUserRegistration: undefined;
  CompanionDashboard: undefined;
  RideSharing: {
    rideId: string;
    from: string;
    to: string;
    driverName?: string;
    driverPhone?: string;
    cabNumber?: string;
    estimatedArrival?: Date;
    rideStatus: string;
  };
  FeedbackForm: {
    rideId: string;
    from: string;
    to: string;
    driverName?: string;
    driverId?: string;
    amount?: number;
    distance?: number;
    duration?: number;
  };
  CompanionTrackingScreen: {
    trackingId: string;
    rideId: string;
  };
  CompanionTrackingDemo: undefined;
  LinkToTraveler: undefined;
  ShareTravelerID: undefined;
  CompanionRideHistory: undefined;
  CompanionSettings: undefined;
  TestCompanionNotification: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const isTokenValid = async () => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    const expiry = await AsyncStorage.getItem('tokenExpiry');

    if (!token || !expiry) return false;

    const currentTime = Math.floor(Date.now() / 1000);
    return parseInt(expiry, 10) > currentTime;
  } catch (error) {
    // Error checking token
    return false;
  }
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userType, setUserType] = useState<string | null>(null);

  // Suppress Expo Go push notification warnings
  useEffect(() => {
    LogBox.ignoreLogs([
      'expo-notifications: Android Push notifications',
      'Expo Go',
      'SDK 53',
      'development build',
    ]);

    // Override console.error to filter out Expo Go push notification errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const message = args.join(' ');
      if (message.includes('expo-notifications') && message.includes('Expo Go')) {
        // Silently ignore Expo Go push notification errors
        return;
      }
      if (message.includes('SDK 53') && message.includes('development build')) {
        // Silently ignore SDK 53 warnings
        return;
      }
      // Call original console.error for other errors
      originalConsoleError.apply(console, args);
    };
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const valid = await isTokenValid();
      setIsAuthenticated(valid);

      if (valid) {
        const type = await AsyncStorage.getItem('userType');
        setUserType(type || 'user');
      }
    };

    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  // Always start with LandingPage regardless of authentication status
  const initialRoute = 'LandingPage';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <NavigationContainer>
          <Stack.Navigator id={undefined} initialRouteName={initialRoute}>
            <Stack.Screen name="LandingPage" component={LandingPage} options={{ headerShown: false }} />
            <Stack.Screen name="Login" component={Login} options={{ headerShown: false }} />
            <Stack.Screen name="DriverLogin" component={DriverLogin} options={{ headerShown: false }} />
            <Stack.Screen name="GroupDetails" component={GroupDetails} />
            <Stack.Screen name="UsernameScreen" component={UsernameScreen} />
            <Stack.Screen name="OfferRideScreen" component={OfferRideScreen} />
            <Stack.Screen name="InboxScreen" component={InboxScreen} />
            <Stack.Screen name="RideHistory" component={RideHistory} />
            <Stack.Screen name="DriverRideHistory" component={DriverRideHistory} options={{ title: 'Ride History' }} />
            <Stack.Screen name="RideRequests" component={RideRequests} options={{ title: 'Ride Requests' }} />
            <Stack.Screen name="DriverVerification" component={DriverVerification} options={{ title: 'Verification' }} />
            <Stack.Screen name="GroupDetailsScreen" component={GroupDetailsScreen} />
            <Stack.Screen name="UpdateProfile" component={UpdateProfile} />
            <Stack.Screen name="ResetPassword" component={ResetPassword} />
            <Stack.Screen name="RideWaiting" component={RideWaiting} />
            <Stack.Screen name="DriverRouteScreen" component={DriverRouteScreen} options={{ title: 'Driver Route' }} />
            <Stack.Screen name="DriverSettings" component={DriverSettings} options={{ title: 'Settings' }} />
            <Stack.Screen name="DriverUsername" component={DriverUsername} options={{ title: 'Username' }} />
            <Stack.Screen name="AnalyticsScreen" component={AnalyticsScreen} options={{ title: 'Analytics' }} />
            <Stack.Screen name="DriverVehicleDetailsScreen" component={DriverVehicleDetailsScreen} options={{ title: 'My Vehicle Details' }} />
            <Stack.Screen name="Profile" component={Profile} />
            <Stack.Screen name="GroupScreen" component={GroupScreen} options={{ title: 'Groups' }} />
            <Stack.Screen name="MembersScreen" component={MembersScreen} options={{ title: 'Members' }} />
            <Stack.Screen name="AdminLogin" component={AdminLogin} options={{ title: 'Admin Login' }} />
            <Stack.Screen name="AdminDashboard" component={AdminDashboard} options={{ title: 'Admin Dashboard' }} />
            <Stack.Screen name="AdminRatingsScreen" component={AdminRatingsScreen} options={{ title: 'Ratings & Feedback' }} />

            <Stack.Screen name="CompanionUserRegistration" component={CompanionUserRegistration} options={{ headerShown: false }} />
            <Stack.Screen name="CompanionDashboard" component={CompanionDashboard} options={{ headerShown: true, title: 'Companion Dashboard' }} />
            <Stack.Screen name="CompanionTrackingScreen" component={CompanionTrackingScreen} options={{ headerShown: true, title: 'Track Ride' }} />
            <Stack.Screen name="CompanionTrackingDemo" component={CompanionTrackingDemo} options={{ headerShown: true, title: 'Test Tracking' }} />
            <Stack.Screen name="CompanionRideHistory" component={CompanionRideHistory} options={{ headerShown: true, title: 'Ride History' }} />
            <Stack.Screen name="CompanionSettings" component={CompanionSettings} options={{ headerShown: true, title: 'Settings' }} />
            <Stack.Screen name="LinkToTraveler" component={LinkToTraveler} options={{ headerShown: true, title: 'Link to Traveler' }} />
            <Stack.Screen name="ShareTravelerID" component={ShareTravelerID} options={{ headerShown: true, title: 'Share Your ID' }} />
            <Stack.Screen name="RideSharing" component={RideSharing} options={{ headerShown: true, title: 'Share Ride' }} />
            <Stack.Screen name="FeedbackForm" component={FeedbackForm} options={{ headerShown: true, title: 'Rate Your Ride' }} />
            <Stack.Screen name="Dashboard" component={Dashboard} options={{ headerShown: true }} />
            <Stack.Screen name="DriverDashboard" component={DriverDashboard} options={{ headerShown: true, title: 'Driver Dashboard' }} />
            <Stack.Screen name="RideBooking" component={RideBooking} options={{ headerShown: true }} />
            <Stack.Screen name="CarpoolBooking" component={CarpoolBooking} options={{ headerShown: true }} />
            <Stack.Screen name="CarpoolWaiting" component={CarpoolWaiting} options={{ headerShown: true }} />
            <Stack.Screen name="LocationPicker" component={LocationPicker} options={{ headerShown: true }} />
            <Stack.Screen name="CarpoolScreen" component={CarpoolScreen} />
            <Stack.Screen name="Settings" component={Settings} />
            <Stack.Screen name="TestCompanionNotification" component={TestCompanionNotification} options={{ headerShown: true, title: 'Test Companion Tracking' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
};

export default App;
