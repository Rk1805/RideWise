import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../service/themeContext';
import { companionService } from '../service/companionService';
import { notificationService } from '../service/notificationService';

interface CompanionPreferences {
  notifications: boolean;
  trackingDistance: number;
  autoTracking: boolean;
}

const CompanionSettings = () => {
  const { isDarkMode } = useTheme();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<CompanionPreferences>({
    notifications: true,
    trackingDistance: 500,
    autoTracking: true,
  });

  useEffect(() => {
    const initializeSettings = async () => {
      try {
        // Initialize companion service for current user
        await companionService.initializeForUser();
        await loadPreferences();
      } catch (error) {
        console.error('Error initializing settings:', error);
      }
    };
    
    initializeSettings();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const prefs = await companionService.getCompanionPreferences();
      setPreferences(prefs);
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: keyof CompanionPreferences, value: any) => {
    try {
      const newPreferences = { ...preferences, [key]: value };
      setPreferences(newPreferences);
      
      await companionService.updateCompanionPreferences(newPreferences);
      
      // Update notification settings if needed
      if (key === 'notifications') {
        if (value) {
          await notificationService.registerForPushNotifications();
        } else {
          await notificationService.unregisterFromPushNotifications();
        }
      }
    } catch (error) {
      console.error('Error updating preference:', error);
      Alert.alert('Error', 'Failed to update preference');
      
      // Revert the change on error
      setPreferences(preferences);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await companionService.logout();
              navigation.reset({
                index: 0,
                routes: [{ name: 'LandingPage' }],
              });
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await companionService.deleteCompanionAccount();
              navigation.reset({
                index: 0,
                routes: [{ name: 'LandingPage' }],
              });
            } catch (error) {
              console.error('Delete account error:', error);
              Alert.alert('Error', 'Failed to delete account');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <LinearGradient
        colors={isDarkMode ? ['#121212', '#1e1e1e'] : ['#e0f2ff', '#b9e6ff']}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={[styles.loadingText, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
          Loading settings...
        </Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={isDarkMode ? ['#121212', '#1e1e1e'] : ['#e0f2ff', '#b9e6ff']}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: isDarkMode ? '#ffffff' : '#1f2937' }]}>
            Companion Settings
          </Text>
          <Text style={[styles.subtitle, { color: isDarkMode ? '#d1d5db' : '#6b7280' }]}>
            Manage your tracking preferences and account
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
            Tracking Preferences
          </Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
                Push Notifications
              </Text>
              <Text style={[styles.settingDescription, { color: isDarkMode ? '#9ca3af' : '#6b7280' }]}>
                Receive alerts for ride updates
              </Text>
            </View>
            <Switch
              value={preferences.notifications}
              onValueChange={(value) => updatePreference('notifications', value)}
              trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
              thumbColor={preferences.notifications ? '#ffffff' : '#9ca3af'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
                Auto Tracking
              </Text>
              <Text style={[styles.settingDescription, { color: isDarkMode ? '#9ca3af' : '#6b7280' }]}>
                Automatically start tracking when rides begin
              </Text>
            </View>
            <Switch
              value={preferences.autoTracking}
              onValueChange={(value) => updatePreference('autoTracking', value)}
              trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
              thumbColor={preferences.autoTracking ? '#ffffff' : '#9ca3af'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
                Tracking Distance
              </Text>
              <Text style={[styles.settingDescription, { color: isDarkMode ? '#9ca3af' : '#6b7280' }]}>
                {preferences.trackingDistance}m radius for location alerts
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.distanceButton, { backgroundColor: isDarkMode ? '#404040' : '#f3f4f6' }]}
              onPress={() => {
                // TODO: Implement distance picker
                Alert.alert('Coming Soon', 'Distance picker will be available in the next update');
              }}
            >
              <Text style={[styles.distanceButtonText, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
                {preferences.trackingDistance}m
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#f3f4f6' : '#1f2937' }]}>
            Account Actions
          </Text>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#3b82f6' }]}
            onPress={() => navigation.navigate('UpdateProfile')}
          >
            <Text style={styles.actionButtonText}>Edit Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#f59e0b' }]}
            onPress={() => navigation.navigate('ResetPassword')}
          >
            <Text style={styles.actionButtonText}>Change Password</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#ef4444' }]}
            onPress={handleLogout}
          >
            <Text style={styles.actionButtonText}>Logout</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.deleteButton]}
            onPress={handleDeleteAccount}
          >
            <Text style={styles.deleteButtonText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666666',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  settingInfo: {
    flex: 1,
    marginRight: 15,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    lineHeight: 18,
  },
  distanceButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  distanceButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionButton: {
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#dc2626',
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CompanionSettings;
