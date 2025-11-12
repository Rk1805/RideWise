import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../service/themeContext';
import { rideNotificationService, CompanionRideShare } from '../service/rideNotificationService';
import { useNavigation, useRoute } from '@react-navigation/native';
import { auth } from '../service/firebase';

const RideSharingScreen = () => {
  const { isDarkMode } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { rideId } = route.params;

  const [loading, setLoading] = useState(false);
  const [rideDetails, setRideDetails] = useState({
    driverName: '',
    driverPhone: '',
    cabNumber: '',
    from: '',
    to: '',
    estimatedArrival: '',
  });
  const [companionId, setCompanionId] = useState('');
  const [activeShares, setActiveShares] = useState<CompanionRideShare[]>([]);
  const [sharingHistory, setSharingHistory] = useState<CompanionRideShare[]>([]);

  useEffect(() => {
    loadRideDetails();
    loadActiveShares();
    loadSharingHistory();
  }, []);

  const loadRideDetails = async () => {
    // In a real app, you'd fetch this from your ride service
    // For now, using placeholder data
    setRideDetails({
      driverName: 'John Driver',
      driverPhone: '+1234567890',
      cabNumber: 'ABC-123',
      from: 'Current Location',
      to: 'Destination',
      estimatedArrival: '15 minutes',
    });
  };

  const loadActiveShares = async () => {
    try {
      const shares = rideNotificationService.getActiveRideShares();
      setActiveShares(shares);
    } catch (error) {
      console.error('Error loading active shares:', error);
    }
  };

  const loadSharingHistory = async () => {
    try {
      const history = await rideNotificationService.getRideSharingHistory();
      setSharingHistory(history);
    } catch (error) {
      console.error('Error loading sharing history:', error);
    }
  };

  const handleShareRide = async () => {
    if (!companionId.trim()) {
      Alert.alert('Error', 'Please enter a companion ID');
      return;
    }

    if (!rideDetails.driverName || !rideDetails.driverPhone || !rideDetails.cabNumber) {
      Alert.alert('Error', 'Please fill in all driver details');
      return;
    }

    try {
      setLoading(true);

      const shareId = await rideNotificationService.shareRideWithCompanion(
        rideId,
        companionId.trim(),
        {
          driverName: rideDetails.driverName,
          driverPhone: rideDetails.driverPhone,
          cabNumber: rideDetails.cabNumber,
          from: rideDetails.from,
          to: rideDetails.to,
          status: 'started',
          estimatedArrival: parseInt(rideDetails.estimatedArrival) || 15,
          travelerId: auth.currentUser?.uid || 'unknown',
        }
      );

      Alert.alert(
        'Ride Shared Successfully!',
        `Your ride has been shared with companion ${companionId}`,
        [
          {
            text: 'Share via WhatsApp',
            onPress: () => shareViaWhatsApp(rideId, companionId),
          },
          {
            text: 'Share via SMS',
            onPress: () => shareViaSMS(rideId, companionId),
          },
          {
            text: 'OK',
            style: 'cancel',
          },
        ]
      );

      // Clear companion ID and reload shares
      setCompanionId('');
      await loadActiveShares();

    } catch (error) {
      console.error('Error sharing ride:', error);
      Alert.alert('Error', 'Failed to share ride. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const shareViaWhatsApp = (rideId: string, companionId: string) => {
    const message = `🚗 RideWise Ride Update!\n\n` +
      `Trip ID: ${rideId}\n` +
      `Driver: ${rideDetails.driverName}\n` +
      `Phone: ${rideDetails.driverPhone}\n` +
      `Cab: ${rideDetails.cabNumber}\n` +
      `From: ${rideDetails.from}\n` +
      `To: ${rideDetails.to}\n` +
      `ETA: ${rideDetails.estimatedArrival}\n\n` +
      `Track this ride: ridewise://track/${rideId}/${companionId}`;

    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
    
    Linking.canOpenURL(whatsappUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(whatsappUrl);
        } else {
          // Fallback to general sharing
          Share.share({
            message,
            title: 'RideWise Ride Update',
          });
        }
      })
      .catch((error) => {
        console.error('Error opening WhatsApp:', error);
        // Fallback to general sharing
        Share.share({
          message,
          title: 'RideWise Ride Update',
        });
      });
  };

  const shareViaSMS = (rideId: string, companionId: string) => {
    const message = `🚗 RideWise Ride Update!\n\n` +
      `Trip ID: ${rideId}\n` +
      `Driver: ${rideDetails.driverName}\n` +
      `Phone: ${rideDetails.driverPhone}\n` +
      `Cab: ${rideDetails.cabNumber}\n` +
      `From: ${rideDetails.from}\n` +
      `To: ${rideDetails.to}\n` +
      `ETA: ${rideDetails.estimatedArrival}\n\n` +
      `Track this ride: ridewise://track/${rideId}/${companionId}`;

    const smsUrl = `sms:?body=${encodeURIComponent(message)}`;
    
    Linking.canOpenURL(smsUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(smsUrl);
        } else {
          // Fallback to general sharing
          Share.share({
            message,
            title: 'RideWise Ride Update',
          });
        }
      })
      .catch((error) => {
        console.error('Error opening SMS:', error);
        // Fallback to general sharing
        Share.share({
          message,
          title: 'RideWise Ride Update',
        });
      });
  };

  const handleExpireShare = async (shareId: string) => {
    Alert.alert(
      'Expire Share',
      'Are you sure you want to expire this ride share?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Expire',
          style: 'destructive',
          onPress: async () => {
            try {
              await rideNotificationService.expireRideShare(shareId);
              await loadActiveShares();
              Alert.alert('Success', 'Ride share expired successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to expire ride share');
            }
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatExpiry = (expiresAt: number) => {
    const now = Date.now();
    const diff = expiresAt - now;
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m remaining`;
  };

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Share Ride with Companion</Text>
          <Text style={styles.headerSubtitle}>Keep your loved ones informed about your journey</Text>
        </View>

        {/* Ride Details Form */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>🚗 Ride Information</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Driver Name:</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}
              value={rideDetails.driverName}
              onChangeText={(text) => setRideDetails(prev => ({ ...prev, driverName: text }))}
              placeholder="Enter driver name"
              placeholderTextColor={isDarkMode ? '#cccccc' : '#666666'}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Driver Phone:</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}
              value={rideDetails.driverPhone}
              onChangeText={(text) => setRideDetails(prev => ({ ...prev, driverPhone: text }))}
              placeholder="Enter driver phone number"
              placeholderTextColor={isDarkMode ? '#cccccc' : '#666666'}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Cab Number:</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}
              value={rideDetails.cabNumber}
              onChangeText={(text) => setRideDetails(prev => ({ ...prev, cabNumber: text }))}
              placeholder="Enter cab number"
              placeholderTextColor={isDarkMode ? '#cccccc' : '#666666'}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>From:</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}
              value={rideDetails.from}
              onChangeText={(text) => setRideDetails(prev => ({ ...prev, from: text }))}
              placeholder="Enter pickup location"
              placeholderTextColor={isDarkMode ? '#cccccc' : '#666666'}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>To:</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}
              value={rideDetails.to}
              onChangeText={(text) => setRideDetails(prev => ({ ...prev, to: text }))}
              placeholder="Enter destination"
              placeholderTextColor={isDarkMode ? '#cccccc' : '#666666'}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>ETA:</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}
              value={rideDetails.estimatedArrival}
              onChangeText={(text) => setRideDetails(prev => ({ ...prev, estimatedArrival: text }))}
              placeholder="e.g., 15 minutes"
              placeholderTextColor={isDarkMode ? '#cccccc' : '#666666'}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Companion ID:</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}
              value={companionId}
              onChangeText={setCompanionId}
              placeholder="Enter companion user ID"
              placeholderTextColor={isDarkMode ? '#cccccc' : '#666666'}
            />
          </View>

          <TouchableOpacity 
            style={[styles.shareButton, loading && styles.shareButtonDisabled]} 
            onPress={handleShareRide}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.shareButtonText}>🔗 Share Ride with Companion</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Active Shares */}
        {activeShares.length > 0 && (
          <View style={styles.sharesSection}>
            <Text style={styles.sectionTitle}>📤 Active Shares</Text>
            
            {Array.from(activeShares.entries()).map(([shareId, share]) => (
              <View key={shareId} style={[styles.shareCard, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
                <View style={styles.shareHeader}>
                  <Text style={[styles.shareTitle, { color: isDarkMode ? '#ffffff' : '#333333' }]}>
                    Shared with: {share.companionId}
                  </Text>
                  <TouchableOpacity
                    style={styles.expireButton}
                    onPress={() => handleExpireShare(shareId.toString())}
                  >
                    <Text style={styles.expireButtonText}>⏰ Expire</Text>
                  </TouchableOpacity>
                </View>
                
                <Text style={[styles.shareDetails, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
                  Driver: {share.rideDetails.driverName} | Cab: {share.rideDetails.cabNumber}
                </Text>
                <Text style={[styles.shareDetails, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
                  From: {share.rideDetails.from} → To: {share.rideDetails.to}
                </Text>
                <Text style={[styles.shareDetails, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
                  Shared: {formatDate(share.createdAt)}
                </Text>
                <Text style={[styles.shareDetails, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
                  Expires: {formatExpiry(share.expiresAt)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Sharing History */}
        {sharingHistory.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>📊 Sharing History</Text>
            
            {sharingHistory.slice(0, 5).map((share) => (
              <View key={share.rideId} style={[styles.historyCard, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
                <Text style={[styles.historyTitle, { color: isDarkMode ? '#ffffff' : '#333333' }]}>
                  Shared with: {share.companionId}
                </Text>
                <Text style={[styles.historyDetails, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
                  Driver: {share.rideDetails.driverName} | Cab: {share.rideDetails.cabNumber}
                </Text>
                <Text style={[styles.historyDetails, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
                  From: {share.rideDetails.from} → To: {share.rideDetails.to}
                </Text>
                <Text style={[styles.historyDetails, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
                  Shared: {formatDate(share.createdAt)}
                </Text>
                <Text style={[styles.historyDetails, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
                  Status: {share.expiresAt > Date.now() ? 'Active' : 'Expired'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Back Button */}
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>🔙 Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    opacity: 0.9,
  },
  formSection: {
    marginBottom: 25,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333333',
  },
  shareButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  shareButtonDisabled: {
    backgroundColor: '#666666',
  },
  shareButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sharesSection: {
    marginBottom: 25,
    paddingHorizontal: 20,
  },
  shareCard: {
    padding: 15,
    borderRadius: 12,
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
  shareTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  expireButton: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  expireButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  shareDetails: {
    fontSize: 14,
    marginBottom: 4,
  },
  historySection: {
    marginBottom: 25,
    paddingHorizontal: 20,
  },
  historyCard: {
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  historyDetails: {
    fontSize: 14,
    marginBottom: 4,
  },
  backButton: {
    backgroundColor: '#6b7280',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 40,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RideSharingScreen;
