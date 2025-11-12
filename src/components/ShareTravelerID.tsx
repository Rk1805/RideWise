import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Share,
  Clipboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../service/themeContext';
import { auth } from '../service/firebase';

const ShareTravelerID = () => {
  const { isDarkMode } = useTheme();
  const [userId, setUserId] = useState<string>('');
  const [username, setUsername] = useState<string>('');

  useEffect(() => {
    if (auth.currentUser) {
      setUserId(auth.currentUser.uid);
      setUsername(auth.currentUser.displayName || 'Unknown User');
    }
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    Clipboard.setString(text);
    Alert.alert('Copied!', `${label} copied to clipboard`);
  };

  const shareViaSystem = async (text: string, label: string) => {
    try {
      await Share.share({
        message: `My RideWise ${label}: ${text}\n\nUse this to link with me in the companion app.`,
        title: `RideWise ${label}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert('Error', 'Failed to share. Please try copying instead.');
    }
  };

  const generateQRCode = () => {
    // TODO: Implement QR code generation
    Alert.alert('Coming Soon', 'QR code generation will be available in the next update');
  };

  if (!userId) {
    return (
      <LinearGradient
        colors={isDarkMode ? ['#121212', '#1e1e1e'] : ['#e0f2ff', '#b9e6ff']}
        style={styles.container}
      >
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: isDarkMode ? '#cccccc' : '#666666' }]}>
            Loading user information...
          </Text>
        </View>
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
            Share Your ID
          </Text>
          <Text style={[styles.subtitle, { color: isDarkMode ? '#d1d5db' : '#6b7280' }]}>
            Share this information with companions who want to track your rides
          </Text>
        </View>

        {/* User ID Section */}
        <View style={[styles.infoCard, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
          <Text style={[styles.cardTitle, { color: isDarkMode ? '#f3f4f6' : '#374151' }]}>
            🔑 User ID
          </Text>
          <Text style={[styles.idText, { color: isDarkMode ? '#ffffff' : '#1f2937' }]}>
            {userId}
          </Text>
          <Text style={[styles.description, { color: isDarkMode ? '#9ca3af' : '#6b7280' }]}>
            This is your unique identifier. Companions need this to link with you.
          </Text>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#3b82f6' }]}
              onPress={() => copyToClipboard(userId, 'User ID')}
            >
              <Text style={styles.actionButtonText}>📋 Copy</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#10b981' }]}
              onPress={() => shareViaSystem(userId, 'User ID')}
            >
              <Text style={styles.actionButtonText}>📤 Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Username Section */}
        <View style={[styles.infoCard, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
          <Text style={[styles.cardTitle, { color: isDarkMode ? '#f3f4f6' : '#374151' }]}>
            👤 Username
          </Text>
          <Text style={[styles.idText, { color: isDarkMode ? '#ffffff' : '#1f2937' }]}>
            {username}
          </Text>
          <Text style={[styles.description, { color: isDarkMode ? '#9ca3af' : '#6b7280' }]}>
            Your chosen username. Companions can also use this to find you.
          </Text>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#3b82f6' }]}
              onPress={() => copyToClipboard(username, 'Username')}
            >
              <Text style={styles.actionButtonText}>📋 Copy</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#10b981' }]}
              onPress={() => shareViaSystem(username, 'Username')}
            >
              <Text style={styles.actionButtonText}>📤 Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Share Section */}
        <View style={[styles.infoCard, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
          <Text style={[styles.cardTitle, { color: isDarkMode ? '#f3f4f6' : '#374151' }]}>
            🚀 Quick Share
          </Text>
          <Text style={[styles.description, { color: isDarkMode ? '#9ca3af' : '#6b7280' }]}>
            Share all your information at once with companions.
          </Text>
          
          <TouchableOpacity
            style={[styles.quickShareButton, { backgroundColor: '#8b5cf6' }]}
            onPress={() => shareViaSystem(`${username} (${userId})`, 'Traveler Information')}
          >
            <Text style={styles.quickShareButtonText}>📤 Share All Info</Text>
          </TouchableOpacity>
        </View>

        {/* QR Code Section */}
        <View style={[styles.infoCard, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
          <Text style={[styles.cardTitle, { color: isDarkMode ? '#f3f4f6' : '#374151' }]}>
            📱 QR Code
          </Text>
          <Text style={[styles.description, { color: isDarkMode ? '#9ca3af' : '#6b7280' }]}>
            Generate a QR code that companions can scan to quickly link with you.
          </Text>
          
          <TouchableOpacity
            style={[styles.qrButton, { backgroundColor: '#f59e0b' }]}
            onPress={generateQRCode}
          >
            <Text style={styles.qrButtonText}>🔲 Generate QR Code</Text>
          </TouchableOpacity>
        </View>

        {/* Instructions Section */}
        <View style={[styles.instructionsCard, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
          <Text style={[styles.instructionsTitle, { color: isDarkMode ? '#f3f4f6' : '#374151' }]}>
            📋 Instructions for Companions
          </Text>
          
          <View style={styles.instructionItem}>
            <Text style={styles.instructionNumber}>1</Text>
            <Text style={[styles.instructionText, { color: isDarkMode ? '#d1d5db' : '#6b7280' }]}>
              Share your User ID or Username with the companion
            </Text>
          </View>
          
          <View style={styles.instructionItem}>
            <Text style={styles.instructionNumber}>2</Text>
            <Text style={[styles.instructionText, { color: isDarkMode ? '#d1d5db' : '#6b7280' }]}>
              The companion will use the "Link to Traveler" feature in their app
            </Text>
          </View>
          
          <View style={styles.instructionItem}>
            <Text style={styles.instructionNumber}>3</Text>
            <Text style={[styles.instructionText, { color: isDarkMode ? '#d1d5db' : '#6b7280' }]}>
              Once linked, they can track your rides in real-time
            </Text>
          </View>
          
          <View style={styles.instructionItem}>
            <Text style={styles.instructionNumber}>4</Text>
            <Text style={[styles.instructionText, { color: isDarkMode ? '#d1d5db' : '#6b7280' }]}>
              You'll receive a notification when someone wants to link with you
            </Text>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
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
  infoCard: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 15,
  },
  idText: {
    fontSize: 18,
    fontFamily: 'monospace',
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 15,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  quickShareButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickShareButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  qrButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  qrButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  instructionsCard: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  instructionsTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  instructionNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginRight: 15,
    width: 25,
    textAlign: 'center',
  },
  instructionText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
});

export default ShareTravelerID;
