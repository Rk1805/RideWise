import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { auth, realtimeDb } from './firebase';
import { ref, set, get, onValue, off } from 'firebase/database';
import { notificationService } from './notificationService';

export interface NotificationTokenData {
  userId: string;
  token: string;
  deviceType: 'android' | 'ios' | 'web';
  lastUpdated: number;
  isActive: boolean;
}

export interface CompanionNotificationPayload {
  type: 'ride_started' | 'ride_in_progress' | 'ride_completed' | 'ride_cancelled';
  rideId: string;
  companionId: string;
  travelerId: string;
  title: string;
  body: string;
  data?: any;
}

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class ExpoNotificationService {
  private currentToken: string | null = null;
  private tokenRefreshInterval: ReturnType<typeof setInterval> | null = null;
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;

  constructor() {
    this.initializeService();
  }

  // Initialize the service
  private async initializeService() {
    try {
      // Request permission and get token
      await this.requestPermissionAndGetToken();
      
      // Set up token refresh interval (every 24 hours)
      this.tokenRefreshInterval = setInterval(() => {
        this.refreshToken();
      }, 24 * 60 * 60 * 1000);

      // Set up notification listeners
      this.setupNotificationListeners();

    } catch (error) {
      // Error initializing notification service
    }
  }

  // Request permission and get notification token
  private async requestPermissionAndGetToken(): Promise<string | null> {
    try {
      // Check if we're in Expo Go (which doesn't support push notifications in SDK 53+)
      const isExpoGo = __DEV__ && !Device.isDevice;
      
      if (isExpoGo) {
        console.log('Running in Expo Go - push notifications not supported in SDK 53+');
        return null;
      }

      // Request permission
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Notification permission denied');
        return null;
      }

      // Get push token - using a valid project ID
      let token;
      try {
        token = await Notifications.getExpoPushTokenAsync({
          projectId: 'sps1020-ridewise', // Updated project ID
        });
      } catch (tokenError) {
        // Silently handle Expo Go push notification errors
        if (tokenError.message && tokenError.message.includes('Expo Go')) {
          console.log('Push notifications not available in Expo Go');
          return null;
        }
        console.log('Expo token error, trying alternative method');
        // Fallback: try without project ID for development
        try {
          token = await Notifications.getExpoPushTokenAsync();
        } catch (fallbackError) {
          console.log('Fallback token method also failed');
          return null;
        }
      }
      
      if (token && token.data) {
        this.currentToken = token.data;
        await this.saveTokenToDatabase(token.data);
        console.log('Expo push token obtained:', token.data);
        return token.data;
      }

    } catch (error) {
      // Silently handle all notification errors to prevent console spam
      if (error.message && error.message.includes('Expo Go')) {
        return null;
      }
    }
    return null;
  }

  // Save notification token to database
  private async saveTokenToDatabase(token: string) {
    if (!auth.currentUser) return;

    try {
      const tokenData: NotificationTokenData = {
        userId: auth.currentUser.uid,
        token,
        deviceType: this.getDeviceType(),
        lastUpdated: Date.now(),
        isActive: true,
      };

      // Save to real-time database for quick access
      const tokenRef = ref(realtimeDb, `notificationTokens/${auth.currentUser.uid}`);
      await set(tokenRef, tokenData);

      // Also save to user's profile
      const userTokenRef = ref(realtimeDb, `users/${auth.currentUser.uid}/notificationToken`);
      await set(userTokenRef, {
        token,
        lastUpdated: Date.now(),
        isActive: true,
      });

      console.log('Notification token saved to database');
    } catch (error) {
      // Error saving notification token
    }
  }

  // Get device type
  private getDeviceType(): 'android' | 'ios' | 'web' {
    if (Platform.OS === 'android') return 'android';
    if (Platform.OS === 'ios') return 'ios';
    return 'web';
  }

  // Refresh notification token
  private async refreshToken() {
    try {
      let token;
      try {
        token = await Notifications.getExpoPushTokenAsync({
          projectId: 'cf53ffdc-f68a-45fe-9e75-1c9fec1361f0',
        });
      } catch (error) {
        token = await Notifications.getExpoPushTokenAsync();
      }
      
      if (token && token.data && token.data !== this.currentToken) {
        this.currentToken = token.data;
        await this.saveTokenToDatabase(token.data);
        console.log('Notification token refreshed');
      }
    } catch (error) {
      // Error refreshing notification token
    }
  }

  // Setup notification listeners
  private setupNotificationListeners() {
    // Listen for notifications received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      this.handleForegroundNotification(notification);
    });

    // Listen for notification responses (when user taps notification)
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      this.handleNotificationResponse(response);
    });
  }

  // Handle foreground notifications
  private handleForegroundNotification(notification: Notifications.Notification) {
    const data = notification.request.content.data;
    
    if (data?.type === 'ride_started') {
      notificationService.sendLocalNotification(
        '🚗 Ride Started!',
        `Your companion's ride has begun.`,
        data
      );
    } else if (data?.type === 'ride_completed') {
      notificationService.sendLocalNotification(
        '✅ Ride Completed!',
        `Your companion has reached their destination.`,
        data
      );
    } else if (data?.type === 'ride_cancelled') {
      notificationService.sendLocalNotification(
        '❌ Ride Cancelled',
        `Your companion's ride has been cancelled.`,
        data
      );
    }
  }

  // Handle notification responses
  private handleNotificationResponse(response: Notifications.NotificationResponse) {
    const data = response.notification.request.content.data;
    console.log('Notification tapped:', data);
    
    // You can add navigation logic here based on notification type
    if (data?.type === 'ride_started') {
      // Navigate to ride tracking
      console.log('Navigate to ride tracking');
    } else if (data?.type === 'ride_completed') {
      // Navigate to feedback
      console.log('Navigate to feedback');
    }
  }

  // Get current notification token
  getCurrentToken(): string | null {
    return this.currentToken;
  }

  // Send notification to companion
  async sendCompanionNotification(companionId: string, payload: CompanionNotificationPayload): Promise<boolean> {
    try {
      // Get companion's notification token
      const companionTokenRef = ref(realtimeDb, `users/${companionId}/notificationToken`);
      const tokenSnapshot = await get(companionTokenRef);
      
      if (!tokenSnapshot.exists()) {
        console.log('Companion has no notification token');
        return false;
      }

      const tokenData = tokenSnapshot.val();
      if (!tokenData.isActive || !tokenData.token) {
        console.log('Companion notification token is not active');
        return false;
      }

      // Save notification to real-time database for real-time updates
      const notificationRef = ref(realtimeDb, `companionNotifications/${companionId}/${Date.now()}`);
      await set(notificationRef, {
        ...payload,
        timestamp: Date.now(),
        read: false,
      });

      // Also save to companion's ride tracking
      if (payload.rideId) {
        const rideTrackingRef = ref(realtimeDb, `companionRideTracking/${companionId}/${payload.rideId}`);
        await set(rideTrackingRef, {
          lastNotification: payload,
          lastUpdate: Date.now(),
        });
      }

      // Send local notification for immediate feedback
      await this.sendLocalNotification(payload.title, payload.body, payload.data);

      console.log('Companion notification sent successfully');
      return true;
    } catch (error) {
      // Error sending companion notification
      return false;
    }
  }

  // Send local notification
  async sendLocalNotification(title: string, body: string, data?: any): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
        },
        trigger: null, // Send immediately
      });
    } catch (error) {
      // Error sending local notification
    }
  }

  // Subscribe to companion notifications
  subscribeToCompanionNotifications(companionId: string, callback: (notifications: any[]) => void) {
    const notificationsRef = ref(realtimeDb, `companionNotifications/${companionId}`);
    
    return onValue(notificationsRef, (snapshot) => {
      if (snapshot.exists()) {
        const notifications: any[] = [];
        snapshot.forEach((childSnapshot) => {
          notifications.push({
            id: childSnapshot.key,
            ...childSnapshot.val(),
          });
        });
        
        // Sort by timestamp (newest first)
        notifications.sort((a, b) => b.timestamp - a.timestamp);
        callback(notifications);
      } else {
        callback([]);
      }
    });
  }

  // Subscribe to companion ride tracking
  subscribeToCompanionRideTracking(companionId: string, rideId: string, callback: (trackingData: any) => void) {
    const trackingRef = ref(realtimeDb, `companionRideTracking/${companionId}/${rideId}`);
    
    return onValue(trackingRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val());
      } else {
        callback(null);
      }
    });
  }

  // Mark notification as read
  async markNotificationAsRead(companionId: string, notificationId: string): Promise<void> {
    try {
      const notificationRef = ref(realtimeDb, `companionNotifications/${companionId}/${notificationId}`);
      await set(notificationRef, { read: true, readAt: Date.now() });
    } catch (error) {
      // Error marking notification as read
    }
  }

  // Test notification (for debugging)
  async sendTestNotification(): Promise<void> {
    try {
      await this.sendLocalNotification(
        '🧪 Test Notification',
        'This is a test notification from the companion tracking system!',
        { type: 'test', timestamp: Date.now() }
      );
      console.log('Test notification sent successfully');
    } catch (error) {
      // Error sending test notification
    }
  }

  // Cleanup method
  cleanup() {
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
      this.tokenRefreshInterval = null;
    }
    
    if (this.notificationListener) {
      this.notificationListener.remove();
    }
    
    if (this.responseListener) {
      this.responseListener.remove();
    }
  }
}

// Export singleton instance
export const expoNotificationService = new ExpoNotificationService();
export default expoNotificationService;
