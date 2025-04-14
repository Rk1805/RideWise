import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LandingPage from "./components/LandingPage";
import Login from "./components/loginPage"
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
import 'react-native-gesture-handler'; // 👈 very important
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
  OfferRideScreen: undefined;
  InboxScreen: undefined;
  RideHistory: undefined;
  DriverRideHistory: undefined;
  RideRequests: undefined;
  DriverVerification: undefined;
  UsernameScreen: {
    uid: string;
  };
  UpdateProfile: {
    uid: string;
  };
  ResetPassword: undefined;
  RideWaiting:{
    origin: { latitude: number; longitude: number };
    destination: { latitude: number; longitude: number };
    realtimeId: string;
  };
  DriverRouteScreen:{
    origin: { latitude: number; longitude: number };
    destination: { latitude: number; longitude: number };
    realtimeId: string;
  };
  DriverUsername:{
    uid: string;
  };
  AnalyticsScreen: undefined;
  DriverVehicleDetailsScreen: undefined;
  GroupScreen:undefined;
  MembersScreen:undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const isTokenValid = async () => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    const expiry = await AsyncStorage.getItem('tokenExpiry');

    if (!token || !expiry)
      return false;

    const currentTime = Math.floor(Date.now() / 1000);
    return parseInt(expiry, 10) > currentTime;
  } catch (error) {
    console.error('Error checking token:', error);
    return false;
  }
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userType, setUserType] = useState<string | null>(null);

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
        <Stack.Navigator initialRouteName={initialRoute}>
          <Stack.Screen name="LandingPage" component={LandingPage} options={{ headerShown: false }} />
          <Stack.Screen name="Login" component={Login} options={{ headerShown: false }} />
          <Stack.Screen name="DriverLogin" component={DriverLogin} options={{ headerShown: false }} />
          <Stack.Screen name="Dashboard" component={Dashboard} options={{ headerShown: true }} />
          <Stack.Screen name="DriverDashboard" component={DriverDashboard} options={{ headerShown: true, title: 'Driver Dashboard' }} />
          <Stack.Screen name="RideBooking" component={RideBooking} options={{ headerShown: true }} />
          <Stack.Screen name="LocationPicker" component={LocationPicker} options={{ headerShown: true }} />
          <Stack.Screen name="CarpoolScreen" component={CarpoolScreen} />
          <Stack.Screen name="Settings" component={Settings} />
          <Stack.Screen name="GroupDetails" component={GroupDetails} />
          <Stack.Screen name="UsernameScreen" component={UsernameScreen} />
          <Stack.Screen name="OfferRide" component={OfferRideScreen} />
          <Stack.Screen name="Inbox" component={InboxScreen} />
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
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
    </GestureHandlerRootView>
  );
};

export default App;