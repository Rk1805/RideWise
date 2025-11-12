import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../service/themeContext';
import { companionService } from '../service/companionService';

const LinkToTraveler = () => {
  const { isDarkMode } = useTheme();
  const navigation = useNavigation();
  
  const [searchMethod, setSearchMethod] = useState<'id' | 'username' | 'phone'>('id');
  const [searchValue, setSearchValue] = useState('');
  const [travelerName, setTravelerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleLinkToTraveler = async () => {
    if (!searchValue.trim() || !travelerName.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      const linkId = await companionService.linkToTraveler(
        searchValue.trim(),
        travelerName.trim()
      );

      Alert.alert(
        'Success!',
        `Successfully linked with ${travelerName}. You can now track their rides.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('CompanionDashboard'),
          },
        ]
      );
    } catch (error: any) {
      console.error('Link error:', error);
      Alert.alert('Error', 'Failed to link with traveler. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getSearchMethodLabel = () => {
    switch (searchMethod) {
      case 'id': return 'Traveler ID';
      case 'username': return 'Username';
      case 'phone': return 'Phone Number';
      default: return 'Traveler ID';
    }
  };

  const getSearchMethodPlaceholder = () => {
    switch (searchMethod) {
      case 'id': return 'Enter traveler\'s unique ID';
      case 'username': return 'Enter traveler\'s username';
      case 'phone': return 'Enter traveler\'s phone number';
      default: return 'Enter traveler\'s unique ID';
    }
  };

  const getSearchMethodDescription = () => {
    switch (searchMethod) {
      case 'id': return 'The unique identifier for the traveler (usually shared by them)';
      case 'username': return 'The traveler\'s chosen username in the app';
      case 'phone': return 'The traveler\'s registered phone number';
      default: return 'The unique identifier for the traveler';
    }
  };

  return (
    <LinearGradient
      colors={isDarkMode ? ['#121212', '#1e1e1e'] : ['#e0f2ff', '#b9e6ff']}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: isDarkMode ? '#ffffff' : '#1f2937' }]}>
            Link with Traveler
          </Text>
          <Text style={[styles.subtitle, { color: isDarkMode ? '#d1d5db' : '#6b7280' }]}>
            Connect with a family member or friend to track their rides
          </Text>
        </View>

        <View style={[styles.formContainer, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
          {/* Search Method Selection */}
          <View style={styles.searchMethodSection}>
            <Text style={[styles.sectionTitle, { color: isDarkMode ? '#f3f4f6' : '#374151' }]}>
              How to Find Traveler
            </Text>
            
            <View style={styles.methodButtons}>
              <TouchableOpacity
                style={[
                  styles.methodButton,
                  searchMethod === 'id' && { backgroundColor: '#3b82f6' }
                ]}
                onPress={() => setSearchMethod('id')}
              >
                <Text style={[
                  styles.methodButtonText,
                  searchMethod === 'id' && { color: '#ffffff' }
                ]}>
                  🔑 ID
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.methodButton,
                  searchMethod === 'username' && { backgroundColor: '#3b82f6' }
                ]}
                onPress={() => setSearchMethod('username')}
              >
                <Text style={[
                  styles.methodButtonText,
                  searchMethod === 'username' && { color: '#ffffff' }
                ]}>
                  👤 Username
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.methodButton,
                  searchMethod === 'phone' && { backgroundColor: '#3b82f6' }
                ]}
                onPress={() => setSearchMethod('phone')}
              >
                <Text style={[
                  styles.methodButtonText,
                  searchMethod === 'phone' && { color: '#ffffff' }
                ]}>
                  📱 Phone
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: isDarkMode ? '#f3f4f6' : '#374151' }]}>
              {getSearchMethodLabel()}
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDarkMode ? '#404040' : '#f9fafb',
                  color: isDarkMode ? '#ffffff' : '#1f2937',
                  borderColor: isDarkMode ? '#555555' : '#d1d5db',
                },
              ]}
              placeholder={getSearchMethodPlaceholder()}
              placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
              value={searchValue}
              onChangeText={setSearchValue}
              autoCapitalize="none"
              keyboardType={searchMethod === 'phone' ? 'phone-pad' : 'default'}
            />
            <Text style={[styles.helpText, { color: isDarkMode ? '#9ca3af' : '#6b7280' }]}>
              {getSearchMethodDescription()}
            </Text>
          </View>

          {/* Traveler Name */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: isDarkMode ? '#f3f4f6' : '#374151' }]}>
              Traveler Name
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDarkMode ? '#404040' : '#f9fafb',
                  color: isDarkMode ? '#ffffff' : '#1f2937',
                  borderColor: isDarkMode ? '#555555' : '#d1d5db',
                },
              ]}
              placeholder="Enter traveler's full name"
              placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
              value={travelerName}
              onChangeText={setTravelerName}
              autoCapitalize="words"
            />
          </View>

          {/* Advanced Options */}
          <TouchableOpacity
            style={styles.advancedToggle}
            onPress={() => setShowAdvanced(!showAdvanced)}
          >
            <Text style={[styles.advancedToggleText, { color: isDarkMode ? '#9ca3af' : '#6b7280' }]}>
              {showAdvanced ? '▼' : '▶'} Advanced Options
            </Text>
          </TouchableOpacity>

          {showAdvanced && (
            <View style={[styles.advancedSection, { backgroundColor: isDarkMode ? '#404040' : '#f9fafb' }]}>
              <Text style={[styles.advancedTitle, { color: isDarkMode ? '#f3f4f6' : '#374151' }]}>
                Link Settings
              </Text>
              <Text style={[styles.advancedDescription, { color: isDarkMode ? '#9ca3af' : '#6b7280' }]}>
                These settings can be changed later in the companion dashboard.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#3b82f6' }]}
            onPress={handleLinkToTraveler}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Link with Traveler</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.cancelButtonText, { color: isDarkMode ? '#9ca3af' : '#6b7280' }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>

        {/* Help Section */}
        <View style={[styles.helpContainer, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
          <Text style={[styles.helpTitle, { color: isDarkMode ? '#f3f4f6' : '#374151' }]}>
            💡 How to Get Traveler ID
          </Text>
          
          <View style={styles.helpItem}>
            <Text style={styles.helpIcon}>1️⃣</Text>
            <Text style={[styles.helpItemText, { color: isDarkMode ? '#d1d5db' : '#6b7280' }]}>
              Ask the traveler to open their RideWise app
            </Text>
          </View>
          
          <View style={styles.helpItem}>
            <Text style={styles.helpIcon}>2️⃣</Text>
            <Text style={[styles.helpItemText, { color: isDarkMode ? '#d1d5db' : '#6b7280' }]}>
              Go to Profile → Settings → Account Info
            </Text>
          </View>
          
          <View style={styles.helpItem}>
            <Text style={styles.helpIcon}>3️⃣</Text>
            <Text style={[styles.helpItemText, { color: isDarkMode ? '#d1d5db' : '#6b7280' }]}>
              Copy their User ID or Username
            </Text>
          </View>
          
          <View style={styles.helpItem}>
            <Text style={styles.helpIcon}>4️⃣</Text>
            <Text style={[styles.helpItemText, { color: isDarkMode ? '#d1d5db' : '#6b7280' }]}>
              Enter it here to create the link
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
  formContainer: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  searchMethodSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  methodButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  methodButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
    backgroundColor: '#f3f4f6',
  },
  methodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  helpText: {
    fontSize: 12,
    marginTop: 5,
    fontStyle: 'italic',
  },
  advancedToggle: {
    alignItems: 'center',
    padding: 10,
    marginBottom: 15,
  },
  advancedToggleText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  advancedSection: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  advancedTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  advancedDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  button: {
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    alignItems: 'center',
    padding: 10,
  },
  cancelButtonText: {
    fontSize: 16,
  },
  helpContainer: {
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  helpIcon: {
    fontSize: 16,
    marginRight: 10,
    width: 25,
  },
  helpItemText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
});

export default LinkToTraveler;
