import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../service/themeContext';
import { auth } from '../service/firebase';
import { companionService } from '../service/companionService';
import { companionTrackingService } from '../service/companionTrackingService';

const TestCompanionNotification = () => {
  const { isDarkMode } = useTheme();
  const [testResults, setTestResults] = useState<string[]>([]);

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const testCompanionService = async () => {
    try {
      addTestResult('Testing companion service initialization...');
      await companionService.initializeForUser();
      addTestResult('✅ Companion service initialized successfully');
      
      const stats = await companionService.getCompanionStats();
      addTestResult(`📊 Companion stats: ${JSON.stringify(stats)}`);
      
    } catch (error) {
      addTestResult(`❌ Companion service error: ${error}`);
    }
  };

  const testTrackingService = async () => {
    try {
      addTestResult('Testing tracking service initialization...');
      await companionTrackingService.initializeForUser();
      addTestResult('✅ Tracking service initialized successfully');
      
      const activeTracking = companionTrackingService.getActiveTracking();
      addTestResult(`📍 Active tracking sessions: ${activeTracking.length}`);
      
    } catch (error) {
      addTestResult(`❌ Tracking service error: ${error}`);
    }
  };

  const testUserInfo = () => {
    const user = auth.currentUser;
    if (user) {
      addTestResult(`👤 Current user: ${user.email}`);
      addTestResult(`🆔 User ID: ${user.uid}`);
      addTestResult(`📝 Display name: ${user.displayName || 'Not set'}`);
    } else {
      addTestResult('❌ No user logged in');
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const styles = getStyles(isDarkMode);

  return (
    <LinearGradient
      colors={isDarkMode ? ['#121212', '#1e1e1e'] : ['#e0f2ff', '#b9e6ff']}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={[styles.title, { color: isDarkMode ? '#ffffff' : '#1f2937' }]}>
          Companion Tracking Test
        </Text>
        
        <Text style={[styles.subtitle, { color: isDarkMode ? '#d1d5db' : '#6b7280' }]}>
          Test the companion tracking system functionality
        </Text>

        <View style={[styles.buttonContainer, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
          <TouchableOpacity style={styles.testButton} onPress={testUserInfo}>
            <Text style={styles.buttonText}>👤 Test User Info</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.testButton} onPress={testCompanionService}>
            <Text style={styles.buttonText}>🔗 Test Companion Service</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.testButton} onPress={testTrackingService}>
            <Text style={styles.buttonText}>📍 Test Tracking Service</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.clearButton} onPress={clearResults}>
            <Text style={styles.clearButtonText}>🗑️ Clear Results</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.resultsContainer, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
          <Text style={[styles.resultsTitle, { color: isDarkMode ? '#f3f4f6' : '#374151' }]}>
            Test Results:
          </Text>
          
          {testResults.length === 0 ? (
            <Text style={[styles.noResults, { color: isDarkMode ? '#9ca3af' : '#6b7280' }]}>
              No test results yet. Run some tests above.
            </Text>
          ) : (
            testResults.map((result, index) => (
              <Text key={index} style={[styles.resultText, { color: isDarkMode ? '#d1d5db' : '#6b7280' }]}>
                {result}
              </Text>
            ))
          )}
        </View>

        <View style={[styles.helpContainer, { backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff' }]}>
          <Text style={[styles.helpTitle, { color: isDarkMode ? '#f3f4f6' : '#374151' }]}>
            💡 How to Use Companion Tracking:
          </Text>
          
          <Text style={[styles.helpText, { color: isDarkMode ? '#d1d5db' : '#6b7280' }]}>
            1. Create a companion account (Companion → Register)
          </Text>
          <Text style={[styles.helpText, { color: isDarkMode ? '#d1d5db' : '#6b7280' }]}>
            2. Get your User ID from Profile screen
          </Text>
          <Text style={[styles.helpText, { color: isDarkMode ? '#d1d5db' : '#6b7280' }]}>
            3. Share your User ID with the companion
          </Text>
          <Text style={[styles.helpText, { color: isDarkMode ? '#d1d5db' : '#6b7280' }]}>
            4. Companion uses "Link to Traveler" with your ID
          </Text>
          <Text style={[styles.helpText, { color: isDarkMode ? '#d1d5db' : '#6b7280' }]}>
            5. Start a ride to test tracking
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const getStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContainer: {
      flexGrow: 1,
      padding: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 10,
    },
    subtitle: {
      fontSize: 16,
      textAlign: 'center',
      marginBottom: 30,
    },
    buttonContainer: {
      borderRadius: 15,
      padding: 20,
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 4,
    },
    testButton: {
      backgroundColor: '#3b82f6',
      padding: 15,
      borderRadius: 8,
      marginBottom: 10,
      alignItems: 'center',
    },
    buttonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
    clearButton: {
      backgroundColor: '#ef4444',
      padding: 15,
      borderRadius: 8,
      alignItems: 'center',
    },
    clearButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
    resultsContainer: {
      borderRadius: 15,
      padding: 20,
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 4,
      minHeight: 200,
    },
    resultsTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 15,
    },
    noResults: {
      fontSize: 14,
      fontStyle: 'italic',
      textAlign: 'center',
      marginTop: 20,
    },
    resultText: {
      fontSize: 12,
      marginBottom: 5,
      fontFamily: 'monospace',
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
    },
    helpText: {
      fontSize: 14,
      marginBottom: 8,
      lineHeight: 20,
    },
  });

export default TestCompanionNotification;
