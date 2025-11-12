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
import { rideSharingService, RideShareLink } from '../service/rideSharingService';
import { useNavigation, useRoute } from '@react-navigation/native';
import MapView, { Marker, Polyline } from 'react-native-maps';

const RideShareViewerScreen = () => {
  const { isDarkMode } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { shareCode } = route.params || {};

  const [loading, setLoading] = useState(false);
  const [rideShare, setRideShare] = useState<RideShareLink | null>(null);
  const [shareCodeInput, setShareCodeInput] = useState(shareCode || '');
  const [viewerName, setViewerName] = useState('');
  const [viewerPhone, setViewerPhone] = useState('');
  const [relationship, setRelationship] = useState('family');
  const [isViewerAdded, setIsViewerAdded] = useState(false);

  useEffect(() => {
    if (shareCode) {
      loadRideShare(shareCode);
    }
  }, [shareCode]);

  const loadRideShare = async (code: string) => {
    if (!code.trim()) return;

    try {
      setLoading(true);
      const share = await rideSharingService.getRideShareByCode(code.trim());
      
      if (share) {
        setRideShare(share);
        console.log('Ride share loaded:', share);
      } else {
        Alert.alert('Not Found', 'Invalid or expired share code. Please check the code and try again.');
        setRideShare(null);
      }
    } catch (error) {
      console.error('Error loading ride share:', error);
      Alert.alert('Error', 'Failed to load ride share. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddViewer = async () => {
    if (!viewerName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    if (!rideShare) {
      Alert.alert('Error', 'No ride share to add viewer to');
      return;
    }

    try {
      setLoading(true);
      const success = await rideSharingService.addRideShareViewer(
        rideShare.shareCode,
        {
          viewerName: viewerName.trim(),
          viewerPhone: viewerPhone.trim() || undefined,
          relationship,
        }
      );

      if (success) {
        setIsViewerAdded(true);
        Alert.alert(
          'Success!',
          `You've been added as a viewer for this ride. You'll receive updates about the ride status.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Failed to add viewer. Please try again.');
      }
    } catch (error) {
      console.error('Error adding viewer:', error);
      Alert.alert('Error', 'Failed to add viewer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const shareRideLink = () => {
    if (!rideShare) return;

    const message = `🚗 RideWise Ride Update!\n\n` +
      `Driver: ${rideShare.driverName}\n` +
      `Cab: ${rideShare.cabNumber}\n` +
      `From: ${rideShare.from}\n` +
      `To: ${rideShare.to}\n` +
      `Status: ${rideShare.status}\n` +
      `Share Code: ${rideShare.shareCode}\n\n` +
      `Track this ride: ridewise://share/${rideShare.shareCode}`;

    Share.share({
      message,
      title: 'RideWise Ride Update',
    });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatTimeRemaining = (minutes: number) => {
    if (!minutes) return 'Calculating...';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m remaining`;
    }
    return `${mins}m remaining`;
  };

  const formatDistance = (km: number) => {
    if (!km) return 'Calculating...';
    if (km < 1) {
      return `${Math.round(km * 1000)}m remaining`;
    }
    return `${km.toFixed(1)}km remaining`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return '#3b82f6';
      case 'started': return '#10b981';
      case 'in_progress': return '#f59e0b';
      case 'completed': return '#059669';
      case 'cancelled': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted': return '✅';
      case 'started': return '🚗';
      case 'in_progress': return '📍';
      case 'completed': return '🎉';
      case 'cancelled': return '❌';
      default: return '⏳';
    }
  };

  const renderRideStatus = () => {
    if (!rideShare) return null;

    return (
      <View style={styles.statusSection}>
        <Text style={styles.sectionTitle}>🚗 Ride Status</Text>
        
        <View style={[styles.statusCard, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusIcon}>{getStatusIcon(rideShare.status)}</Text>
            <Text style={[styles.statusText, { color: getStatusColor(rideShare.status) }]}>
              {rideShare.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
          
          <Text style={[styles.rideDetails, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
            Driver: {rideShare.driverName}
          </Text>
          <Text style={[styles.rideDetails, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
            Cab: {rideShare.cabNumber}
          </Text>
          <Text style={[styles.rideDetails, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
            From: {rideShare.from}
          </Text>
          <Text style={[styles.rideDetails, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
            To: {rideShare.to}
          </Text>
        </View>
      </View>
    );
  };

  const renderProgressInfo = () => {
    if (!rideShare) return null;

    return (
      <View style={styles.progressSection}>
        <Text style={styles.sectionTitle}>📊 Progress Information</Text>
        
        <View style={[styles.progressCard, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
          {rideShare.timeRemaining && (
            <View style={styles.progressItem}>
              <Text style={styles.progressLabel}>⏰ Time Remaining:</Text>
              <Text style={[styles.progressValue, { color: isDarkMode ? '#ffffff' : '#333333' }]}>
                {formatTimeRemaining(rideShare.timeRemaining)}
              </Text>
            </View>
          )}
          
          {rideShare.distanceRemaining && (
            <View style={styles.progressItem}>
              <Text style={styles.progressLabel}>📏 Distance Remaining:</Text>
              <Text style={[styles.progressValue, { color: isDarkMode ? '#ffffff' : '#333333' }]}>
                {formatDistance(rideShare.distanceRemaining)}
              </Text>
            </View>
          )}
          
          {rideShare.estimatedArrival && (
            <View style={styles.progressItem}>
              <Text style={styles.progressLabel}>🎯 Estimated Arrival:</Text>
              <Text style={[styles.progressValue, { color: isDarkMode ? '#ffffff' : '#333333' }]}>
                {formatTimeRemaining(rideShare.estimatedArrival)}
              </Text>
            </View>
          )}
          
          <View style={styles.progressItem}>
            <Text style={styles.progressLabel}>🕐 Last Updated:</Text>
            <Text style={[styles.progressValue, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
              {rideShare.createdAt ? formatTime(rideShare.createdAt) : 'Just now'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderMap = () => {
    if (!rideShare?.currentLocation) return null;

    return (
      <View style={styles.mapSection}>
        <Text style={styles.sectionTitle}>🗺️ Current Location</Text>
        
        <View style={[styles.mapContainer, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: rideShare.currentLocation.latitude,
              longitude: rideShare.currentLocation.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
          >
            <Marker
              coordinate={{
                latitude: rideShare.currentLocation.latitude,
                longitude: rideShare.currentLocation.longitude,
              }}
              title="Driver Location"
              description={`Last updated: ${formatTime(rideShare.currentLocation.timestamp)}`}
            />
          </MapView>
        </View>
      </View>
    );
  };

  const renderAddViewer = () => {
    if (!rideShare || isViewerAdded) return null;

    return (
      <View style={styles.viewerSection}>
        <Text style={styles.sectionTitle}>👥 Add Yourself as Viewer</Text>
        
        <View style={[styles.viewerCard, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
          <TextInput
            style={[styles.textInput, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5' }]}
            value={viewerName}
            onChangeText={setViewerName}
            placeholder="Your Name"
            placeholderTextColor={isDarkMode ? '#cccccc' : '#666666'}
          />
          
          <TextInput
            style={[styles.textInput, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5' }]}
            value={viewerPhone}
            onChangeText={setViewerPhone}
            placeholder="Your Phone (Optional)"
            placeholderTextColor={isDarkMode ? '#cccccc' : '#666666'}
            keyboardType="phone-pad"
          />
          
          <View style={styles.relationshipContainer}>
            <Text style={[styles.relationshipLabel, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
              Relationship:
            </Text>
            <View style={styles.relationshipButtons}>
              {['family', 'friend', 'colleague', 'other'].map((rel) => (
                <TouchableOpacity
                  key={rel}
                  style={[
                    styles.relationshipButton,
                    relationship === rel && { backgroundColor: '#3b82f6' }
                  ]}
                  onPress={() => setRelationship(rel)}
                >
                  <Text style={[
                    styles.relationshipButtonText,
                    relationship === rel && { color: '#ffffff' }
                  ]}>
                    {rel.charAt(0).toUpperCase() + rel.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          <TouchableOpacity
            style={[styles.addViewerButton, loading && styles.addViewerButtonDisabled]}
            onPress={handleAddViewer}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.addViewerButtonText}>➕ Add Me as Viewer</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🚗 Ride Share Viewer</Text>
          <Text style={styles.headerSubtitle}>
            Track ride progress in real-time
          </Text>
        </View>

        {/* Share Code Input */}
        {!rideShare && (
          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>🔑 Enter Share Code</Text>
            
            <View style={[styles.inputCard, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
              <TextInput
                style={[styles.textInput, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5' }]}
                value={shareCodeInput}
                onChangeText={setShareCodeInput}
                placeholder="Enter 6-character share code"
                placeholderTextColor={isDarkMode ? '#cccccc' : '#666666'}
                autoCapitalize="characters"
                maxLength={6}
              />
              
              <TouchableOpacity
                style={[styles.loadButton, loading && styles.loadButtonDisabled]}
                onPress={() => loadRideShare(shareCodeInput)}
                disabled={loading || !shareCodeInput.trim()}
              >
                {loading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.loadButtonText}>🔍 Load Ride</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Ride Status */}
        {renderRideStatus()}

        {/* Progress Information */}
        {renderProgressInfo()}

        {/* Map */}
        {renderMap()}

        {/* Add Viewer */}
        {renderAddViewer()}

        {/* Share Button */}
        {rideShare && (
          <View style={styles.shareSection}>
            <TouchableOpacity style={styles.shareButton} onPress={shareRideLink}>
              <Text style={styles.shareButtonText}>📤 Share Ride Update</Text>
            </TouchableOpacity>
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
  inputSection: {
    marginBottom: 25,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
  },
  inputCard: {
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  textInput: {
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333333',
    marginBottom: 15,
  },
  loadButton: {
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  loadButtonDisabled: {
    backgroundColor: '#6b7280',
  },
  loadButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusSection: {
    marginBottom: 25,
    paddingHorizontal: 20,
  },
  statusCard: {
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  statusIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  rideDetails: {
    fontSize: 16,
    marginBottom: 8,
  },
  progressSection: {
    marginBottom: 25,
    paddingHorizontal: 20,
  },
  progressCard: {
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 16,
    color: '#666666',
    flex: 1,
  },
  progressValue: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
  },
  mapSection: {
    marginBottom: 25,
    paddingHorizontal: 20,
  },
  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  map: {
    height: 200,
    width: '100%',
  },
  viewerSection: {
    marginBottom: 25,
    paddingHorizontal: 20,
  },
  viewerCard: {
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  relationshipContainer: {
    marginBottom: 20,
  },
  relationshipLabel: {
    fontSize: 16,
    marginBottom: 10,
  },
  relationshipButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  relationshipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
  },
  relationshipButtonText: {
    fontSize: 14,
    color: '#374151',
  },
  addViewerButton: {
    backgroundColor: '#10b981',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  addViewerButtonDisabled: {
    backgroundColor: '#6b7280',
  },
  addViewerButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  shareSection: {
    marginBottom: 25,
    paddingHorizontal: 20,
  },
  shareButton: {
    backgroundColor: '#8b5cf6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
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

export default RideShareViewerScreen;
