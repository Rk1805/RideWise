import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Share,
  Linking,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTheme } from '../service/themeContext';
import { sharingService } from '../service/sharingService';
import { notificationService } from '../service/notificationService';
import { auth, db } from '../service/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface RideSharingRouteParams {
  rideId: string;
  from: string;
  to: string;
  driverName?: string;
  driverPhone?: string;
  cabNumber?: string;
  estimatedArrival?: Date;
  rideStatus: string;
}

const RideSharing = () => {
  const { isDarkMode } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ RideSharing: RideSharingRouteParams }, 'RideSharing'>>();
  const { rideId, from, to, driverName, driverPhone, cabNumber, estimatedArrival, rideStatus } = route.params;

  const [shareMessage, setShareMessage] = useState('');
  const [recipients, setRecipients] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeShares, setActiveShares] = useState<any[]>([]);
  const [shareType, setShareType] = useState<'whatsapp' | 'sms' | 'link'>('whatsapp');

  useEffect(() => {
    generateDefaultShareMessage();
    loadActiveShares();
  }, []);

  const generateDefaultShareMessage = () => {
    const message = `🚗 RideWise Trip Update\n\n` +
      `📍 From: ${from}\n` +
      `🎯 To: ${to}\n` +
      `👤 Driver: ${driverName || 'Assigned'}\n` +
      `📱 Driver Phone: ${driverPhone || 'N/A'}\n` +
      `🚙 Cab Number: ${cabNumber || 'N/A'}\n` +
      `⏰ ETA: ${estimatedArrival ? new Date(estimatedArrival).toLocaleTimeString() : 'Calculating...'}\n` +
      `📊 Status: ${rideStatus}\n\n` +
      `🔗 Track your ride: ${generateShareLink()}\n\n` +
      `⚠️ This link expires when the trip is completed.`;
    
    setShareMessage(message);
  };

  const generateShareLink = () => {
    // Generate a unique shareable link
    return `https://ridewise.app/track/${rideId}`;
  };

  const loadActiveShares = async () => {
    try {
      const shares = await sharingService.getRideSharesForRide(rideId);
      setActiveShares(shares);
    } catch (error) {
      console.error('Error loading active shares:', error);
    }
  };

  const handleShareViaWhatsApp = async () => {
    if (!recipients.trim()) {
      Alert.alert('Error', 'Please enter recipient phone numbers');
      return;
    }

    setLoading(true);
    try {
      const phoneNumbers = recipients.split(',').map(p => p.trim());
      
      // Create shareable ride info
      const rideInfo = {
        rideId,
        from,
        to,
        driverName,
        driverPhone,
        cabNumber,
        estimatedArrival,
        rideStatus,
        shareMessage,
        shareLink: generateShareLink(),
      };

      // Save to database
      const shareId = await sharingService.shareRideViaWhatsApp(rideInfo, phoneNumbers);

      // Share via WhatsApp
      const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(shareMessage)}&phone=${phoneNumbers[0]}`;
      
      if (await Linking.canOpenURL(whatsappUrl)) {
        await Linking.openURL(whatsappUrl);
      } else {
        Alert.alert('Error', 'WhatsApp is not installed on this device');
      }

      // Refresh active shares
      await loadActiveShares();
      
      Alert.alert('Success', 'Ride shared via WhatsApp successfully!');
    } catch (error) {
      console.error('Error sharing via WhatsApp:', error);
      Alert.alert('Error', 'Failed to share ride via WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  const handleShareViaSMS = async () => {
    if (!recipients.trim()) {
      Alert.alert('Error', 'Please enter recipient phone numbers');
      return;
    }

    setLoading(true);
    try {
      const phoneNumbers = recipients.split(',').map(p => p.trim());
      
      // Create shareable ride info
      const rideInfo = {
        rideId,
        from,
        to,
        driverName,
        driverPhone,
        cabNumber,
        estimatedArrival,
        rideStatus,
        shareMessage,
        shareLink: generateShareLink(),
      };

      // Save to database
      const shareId = await sharingService.shareRideViaSMS(rideInfo, phoneNumbers);

      // Share via SMS
      const smsUrl = `sms:${phoneNumbers[0]}?body=${encodeURIComponent(shareMessage)}`;
      
      if (await Linking.canOpenURL(smsUrl)) {
        await Linking.openURL(smsUrl);
      } else {
        Alert.alert('Error', 'SMS app is not available on this device');
      }

      // Refresh active shares
      await loadActiveShares();
      
      Alert.alert('Success', 'Ride shared via SMS successfully!');
    } catch (error) {
      console.error('Error sharing via SMS:', error);
      Alert.alert('Error', 'Failed to share ride via SMS');
    } finally {
      setLoading(false);
    }
  };

  const handleShareViaLink = async () => {
    setLoading(true);
    try {
      // Create shareable ride info
      const rideInfo = {
        rideId,
        from,
        to,
        driverName,
        driverPhone,
        cabNumber,
        estimatedArrival,
        rideStatus,
        shareMessage,
        shareLink: generateShareLink(),
      };

      // Save to database
      const shareId = await sharingService.shareRideViaLink(rideInfo);

      // Share via native share
      await Share.share({
        message: shareMessage,
        title: `RideWise Trip: ${from} → ${to}`,
        url: generateShareLink(),
      });

      // Refresh active shares
      await loadActiveShares();
      
      Alert.alert('Success', 'Ride shared via link successfully!');
    } catch (error) {
      console.error('Error sharing via link:', error);
      Alert.alert('Error', 'Failed to share ride via link');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    const link = generateShareLink();
    // You can implement clipboard functionality here
    Alert.alert('Link Copied', `Share this link: ${link}`);
  };

  const renderShareTypeButton = (type: 'whatsapp' | 'sms' | 'link', title: string, icon: string, color: string, onPress: () => void) => (
    <TouchableOpacity
      style={[
        styles.shareTypeButton,
        { backgroundColor: shareType === type ? color : isDarkMode ? '#2a2a2a' : '#f0f0f0' },
        { borderColor: shareType === type ? color : isDarkMode ? '#444' : '#ddd' }
      ]}
      onPress={() => setShareType(type)}
    >
      <Text style={styles.shareTypeIcon}>{icon}</Text>
      <Text style={[
        styles.shareTypeText,
        { color: shareType === type ? '#ffffff' : isDarkMode ? '#cccccc' : '#666666' }
      ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  const renderActiveShare = ({ item }: { item: any }) => (
    <View style={[styles.shareCard, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
      <View style={styles.shareHeader}>
        <Text style={[styles.shareType, { color: isDarkMode ? '#ffffff' : '#333333' }]}>
          {item.shareType.toUpperCase()}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: item.status === 'active' ? '#4CAF50' : '#FF9800' }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      
      <Text style={[styles.shareDate, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
        Shared: {new Date(item.createdAt).toLocaleString()}
      </Text>
      
      {item.recipients && item.recipients.length > 0 && (
        <Text style={[styles.recipients, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
          To: {item.recipients.join(', ')}
        </Text>
      )}
      
      <View style={styles.shareStats}>
        <Text style={[styles.statText, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
          👁️ {item.analytics.views} views
        </Text>
        <Text style={[styles.statText, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
          🔗 {item.analytics.clicks} clicks
        </Text>
        <Text style={[styles.statText, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
          📤 {item.analytics.shares} shares
        </Text>
      </View>
    </View>
  );

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Share Your Ride</Text>
        <Text style={styles.subtitle}>
          Keep your loved ones updated about your journey
        </Text>

        {/* Share Type Selection */}
        <View style={styles.shareTypeSection}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#ffffff' : '#333333' }]}>
            Choose Sharing Method
          </Text>
          <View style={styles.shareTypeButtons}>
            {renderShareTypeButton('whatsapp', 'WhatsApp', '📱', '#25D366', () => setShareType('whatsapp'))}
            {renderShareTypeButton('sms', 'SMS', '💬', '#FF6B35', () => setShareType('sms'))}
            {renderShareTypeButton('link', 'Link', '🔗', '#2196F3', () => setShareType('link'))}
          </View>
        </View>

        {/* Recipients Input (for WhatsApp/SMS) */}
        {(shareType === 'whatsapp' || shareType === 'sms') && (
          <View style={[styles.inputSection, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
            <Text style={[styles.inputLabel, { color: isDarkMode ? '#ffffff' : '#333333' }]}>
              Recipient Phone Numbers
            </Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: isDarkMode ? '#1e1e1e' : '#f8f9fa',
                color: isDarkMode ? '#ffffff' : '#333333',
                borderColor: isDarkMode ? '#444' : '#ddd'
              }]}
              value={recipients}
              onChangeText={setRecipients}
              placeholder="Enter phone numbers (comma separated)"
              placeholderTextColor={isDarkMode ? '#666' : '#999'}
              keyboardType="phone-pad"
              multiline
            />
            <Text style={[styles.inputHint, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
              Example: +1234567890, +0987654321
            </Text>
          </View>
        )}

        {/* Share Message Preview */}
        <View style={[styles.messageSection, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#ffffff' : '#333333' }]}>
            Share Message Preview
          </Text>
          <TextInput
            style={[styles.messageInput, { 
              backgroundColor: isDarkMode ? '#1e1e1e' : '#f8f9fa',
              color: isDarkMode ? '#ffffff' : '#333333',
              borderColor: isDarkMode ? '#444' : '#ddd'
            }]}
            value={shareMessage}
            onChangeText={setShareMessage}
            placeholder="Customize your share message..."
            placeholderTextColor={isDarkMode ? '#666' : '#999'}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
          />
        </View>

        {/* Share Actions */}
        <View style={styles.actionsSection}>
          {shareType === 'whatsapp' && (
            <TouchableOpacity
              style={[styles.shareButton, { backgroundColor: '#25D366' }]}
              onPress={handleShareViaWhatsApp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.shareButtonText}>📱 Share via WhatsApp</Text>
              )}
            </TouchableOpacity>
          )}

          {shareType === 'sms' && (
            <TouchableOpacity
              style={[styles.shareButton, { backgroundColor: '#FF6B35' }]}
              onPress={handleShareViaSMS}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.shareButtonText}>💬 Share via SMS</Text>
              )}
            </TouchableOpacity>
          )}

          {shareType === 'link' && (
            <TouchableOpacity
              style={[styles.shareButton, { backgroundColor: '#2196F3' }]}
              onPress={handleShareViaLink}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.shareButtonText}>🔗 Share via Link</Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.copyButton, { backgroundColor: isDarkMode ? '#444' : '#f0f0f0' }]}
            onPress={handleCopyLink}
          >
            <Text style={[styles.copyButtonText, { color: isDarkMode ? '#ffffff' : '#333333' }]}>
              📋 Copy Link
            </Text>
          </TouchableOpacity>
        </View>

        {/* Active Shares */}
        <View style={styles.activeSharesSection}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#ffffff' : '#333333' }]}>
            Active Shares ({activeShares.length})
          </Text>
          {activeShares.length > 0 ? (
            <FlatList
              data={activeShares}
              renderItem={renderActiveShare}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={[styles.emptyState, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
              <Text style={styles.emptyIcon}>📤</Text>
              <Text style={[styles.emptyTitle, { color: isDarkMode ? '#ffffff' : '#333333' }]}>
                No Active Shares
              </Text>
              <Text style={[styles.emptySubtitle, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
                Share your ride to see tracking analytics here
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 30,
    opacity: 0.9,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  shareTypeSection: {
    marginBottom: 25,
  },
  shareTypeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  shareTypeButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 5,
    borderWidth: 2,
  },
  shareTypeIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  shareTypeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputSection: {
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    marginBottom: 10,
  },
  inputHint: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  messageSection: {
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  messageInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    minHeight: 120,
  },
  actionsSection: {
    marginBottom: 25,
  },
  shareButton: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  shareButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  copyButton: {
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  copyButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  activeSharesSection: {
    marginBottom: 25,
  },
  shareCard: {
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  shareHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  shareType: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  shareDate: {
    fontSize: 14,
    marginBottom: 8,
  },
  recipients: {
    fontSize: 14,
    marginBottom: 15,
  },
  shareStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statText: {
    fontSize: 12,
  },
  emptyState: {
    padding: 40,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 15,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default RideSharing;
