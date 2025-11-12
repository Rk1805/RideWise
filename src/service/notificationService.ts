import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { auth, db } from './firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  onSnapshot,
  getDocs,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';

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

export interface NotificationData {
  id: string;
  userId: string;
  type: 'ride_started' | 'ride_completed' | 'geofence_alert' | 'companion_linked' | 'feedback_request';
  title: string;
  body: string;
  data?: any;
  read: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

export interface PushNotificationPayload {
  to: string;
  notification: {
    title: string;
    body: string;
  };
  data?: any;
  priority?: 'high' | 'normal';
}

class NotificationService {
  private expoPushToken: string | null = null;
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;

  constructor() {
    this.setupNotificationListeners();
  }

  // Setup notification listeners
  private setupNotificationListeners() {
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      this.handleNotificationResponse(response);
    });
  }

  // Handle notification tap
  private handleNotificationResponse(response: Notifications.NotificationResponse) {
    const data = response.notification.request.content.data;
    if (data?.type === 'ride_started') {
      // Navigate to ride tracking
      console.log('Navigate to ride tracking');
    } else if (data?.type === 'ride_completed') {
      // Navigate to feedback
      console.log('Navigate to feedback');
    }
  }

  // Register for push notifications
  async registerForPushNotifications(): Promise<string | null> {
    // Check if we're in Expo Go (which doesn't support push notifications in SDK 53+)
    const isExpoGo = __DEV__ && !Device.isDevice;
    
    if (isExpoGo) {
      console.log('Running in Expo Go - push notifications not supported in SDK 53+');
      return null;
    }

    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    try {
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: 'sps1020/RideWise', // Updated with your Expo project ID
      });
      
      this.expoPushToken = token.data;
      console.log('Expo push token:', token.data);
      
      // Save token to user's document
      if (auth.currentUser) {
        await this.savePushToken(auth.currentUser.uid, token.data);
      }
      
      return token.data;
    } catch (error) {
      // Silently handle Expo Go push notification errors
      if (error.message && error.message.includes('Expo Go')) {
        console.log('Push notifications not available in Expo Go');
        return null;
      }
      // Error getting push token
      return null;
    }
  }

  // Unregister from push notifications
  async unregisterFromPushNotifications(): Promise<void> {
    try {
      // Remove the notification token from the database
      if (auth.currentUser) {
        const tokenRef = doc(db, 'fcmTokens', auth.currentUser.uid);
        await deleteDoc(tokenRef);
        console.log('Push notification token removed');
      }
    } catch (error) {
      // Error unregistering from push notifications
    }
  }

  // Save push token to user document
  private async savePushToken(userId: string, token: string) {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        pushToken: token,
        lastTokenUpdate: new Date(),
      });
    } catch (error) {
      // Error saving push token
    }
  }

  // Send local notification
  async sendLocalNotification(title: string, body: string, data?: any) {
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

  // Send push notification via FCM
  async sendPushNotification(userId: string, title: string, body: string, data?: any) {
    try {
      // Get user's push token
      const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', userId)));
      if (userDoc.empty) {
        console.log('User not found for push notification');
        return;
      }

      const userData = userDoc.docs[0].data();
      const pushToken = userData.pushToken;

      if (!pushToken) {
        console.log('User has no push token');
        return;
      }

      // Send via FCM (you'll need to implement the actual FCM call)
      // For now, we'll save to notifications collection
      await this.saveNotificationToDatabase(userId, title, body, data);
      
      // Also send local notification for immediate feedback
      await this.sendLocalNotification(title, body, data);
      
    } catch (error) {
      // Error sending push notification
    }
  }

  // Save notification to database
  private async saveNotificationToDatabase(userId: string, title: string, body: string, data?: any) {
    try {
      const notificationData: Omit<NotificationData, 'id'> = {
        userId,
        type: data?.type || 'general',
        title,
        body,
        data,
        read: false,
        createdAt: new Date(),
        expiresAt: data?.expiresAt,
      };

      await addDoc(collection(db, 'notifications'), notificationData);
    } catch (error) {
      // Error saving notification to database
    }
  }

  // Send ride started notification
  async sendRideStartedNotification(userId: string, rideData: any) {
    const title = '🚗 Ride Started!';
    const body = `Your ride from ${rideData.from} to ${rideData.to} has begun.`;
    const data = {
      type: 'ride_started',
      rideId: rideData.id,
      from: rideData.from,
      to: rideData.to,
    };

    await this.sendPushNotification(userId, title, body, data);
  }

  // Send ride completed notification
  async sendRideCompletedNotification(userId: string, rideData: any) {
    const title = '✅ Ride Completed!';
    const body = `Your ride has been completed. Please rate your experience.`;
    const data = {
      type: 'ride_completed',
      rideId: rideData.id,
      from: rideData.from,
      to: rideData.to,
    };

    await this.sendPushNotification(userId, title, body, data);
  }

  // Send geofence alert notification
  async sendGeofenceAlertNotification(userId: string, location: string) {
    const title = '📍 Approaching Destination!';
    const body = `You're approaching ${location}. Get ready to arrive.`;
    const data = {
      type: 'geofence_alert',
      location,
    };

    await this.sendPushNotification(userId, title, body, data);
  }

  // Send companion linked notification
  async sendCompanionLinkedNotification(userId: string, companionName: string) {
    const title = '👥 Companion Linked!';
    const body = `${companionName} is now tracking your ride.`;
    const data = {
      type: 'companion_linked',
      companionName,
    };

    await this.sendPushNotification(userId, title, body, data);
  }

  // Send feedback request notification
  async sendFeedbackRequestNotification(userId: string, rideData: any) {
    const title = '⭐ Rate Your Ride!';
    const body = `How was your ride from ${rideData.from} to ${rideData.to}?`;
    const data = {
      type: 'feedback_request',
      rideId: rideData.id,
      from: rideData.from,
      to: rideData.to,
    };

    await this.sendPushNotification(userId, title, body, data);
  }

  // Get user notifications
  async getUserNotifications(userId: string, callback: (notifications: NotificationData[]) => void) {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );

    return onSnapshot(q, (snapshot) => {
      const notifications: NotificationData[] = [];
      snapshot.forEach((doc) => {
        notifications.push({
          id: doc.id,
          ...doc.data()
        } as NotificationData);
      });
      
      callback(notifications);
    });
  }

  // Mark notification as read
  async markNotificationAsRead(notificationId: string) {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        read: true,
        readAt: new Date(),
      });
    } catch (error) {
      // Error marking notification as read
    }
  }

  // Clean up expired notifications
  async cleanupExpiredNotifications() {
    try {
      const now = new Date();
      const q = query(
        collection(db, 'notifications'),
        where('expiresAt', '<', now)
      );

      const snapshot = await getDocs(q);
      const batch = writeBatch(db);

      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
    } catch (error) {
      // Error cleaning up expired notifications
    }
  }

  // Cleanup method
  cleanup() {
    if (this.notificationListener) {
      this.notificationListener.remove();
    }
    if (this.responseListener) {
      this.responseListener.remove();
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
export default notificationService;
