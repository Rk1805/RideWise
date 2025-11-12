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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from '../service/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { useTheme } from '../service/themeContext';
import { companionService } from '../service/companionService';
import { notificationService } from '../service/notificationService';

const CompanionUserRegistration = () => {
  const { isDarkMode } = useTheme();
  const navigation = useNavigation();
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegistration = async () => {
    // Validation
    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    if (username.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters long');
      return;
    }

    setLoading(true);

    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update profile with username
      await updateProfile(user, {
        displayName: username,
      });

      // Create companion user document
      const companionData = {
        uid: auth.currentUser.uid,
        username: username.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        profileImage: '',
        isActive: true,
        preferences: {
          notifications: true,
          trackingDistance: 500,
          autoTracking: true,
        },
      };

      const companionId = await companionService.createCompanionUser(companionData);

      // Register for push notifications
      await notificationService.registerForPushNotifications();

      Alert.alert(
        'Success!',
        'Companion account created successfully. You can now link with travelers and track their rides.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('CompanionDashboard'),
          },
        ]
      );
    } catch (error: any) {
      // Registration error
      
      let errorMessage = 'Registration failed. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Please use a different email.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      }

      Alert.alert('Registration Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const styles = getStyles(isDarkMode);

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Join as Companion</Text>
        <Text style={styles.subtitle}>
          Track your loved ones' rides and stay connected during their journeys
        </Text>

        <View style={styles.formContainer}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Choose a unique username"
            placeholderTextColor={isDarkMode ? '#666' : '#999'}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            placeholderTextColor={isDarkMode ? '#666' : '#999'}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Phone (Optional)</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Enter your phone number"
            placeholderTextColor={isDarkMode ? '#666' : '#999'}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Create a password"
            placeholderTextColor={isDarkMode ? '#666' : '#999'}
            secureTextEntry
          />

          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm your password"
            placeholderTextColor={isDarkMode ? '#666' : '#999'}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.registerButton}
            onPress={handleRegistration}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.registerButtonText}>Create Companion Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginLinkText}>
              Already have an account? Sign in
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>What you can do as a Companion:</Text>
          
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>📍</Text>
            <Text style={styles.featureText}>Track linked travelers in real-time</Text>
          </View>
          
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🔔</Text>
            <Text style={styles.featureText}>Get notifications when trips start/end</Text>
          </View>
          
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🎯</Text>
            <Text style={styles.featureText}>Receive alerts when approaching destinations</Text>
          </View>
          
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>⭐</Text>
            <Text style={styles.featureText}>Share feedback about ride experiences</Text>
          </View>
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
    formContainer: {
      backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
      borderRadius: 20,
      padding: 25,
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: isDarkMode ? '#ffffff' : '#333333',
      marginBottom: 8,
      marginTop: 15,
    },
    input: {
      borderWidth: 1,
      borderColor: isDarkMode ? '#333333' : '#dddddd',
      borderRadius: 12,
      padding: 15,
      fontSize: 16,
      backgroundColor: isDarkMode ? '#2a2a2a' : '#f8f9fa',
      color: isDarkMode ? '#ffffff' : '#333333',
    },
    registerButton: {
      backgroundColor: '#4CAF50',
      borderRadius: 12,
      padding: 18,
      alignItems: 'center',
      marginTop: 25,
      shadowColor: '#4CAF50',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    registerButtonText: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: 'bold',
    },
    loginLink: {
      alignItems: 'center',
      marginTop: 20,
    },
    loginLinkText: {
      color: isDarkMode ? '#90caf9' : '#2196F3',
      fontSize: 16,
      textDecorationLine: 'underline',
    },
    featuresContainer: {
      backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
      borderRadius: 20,
      padding: 25,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    featuresTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: isDarkMode ? '#ffffff' : '#333333',
      marginBottom: 20,
      textAlign: 'center',
    },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 15,
    },
    featureIcon: {
      fontSize: 24,
      marginRight: 15,
      width: 30,
      textAlign: 'center',
    },
    featureText: {
      fontSize: 16,
      color: isDarkMode ? '#cccccc' : '#666666',
      flex: 1,
      lineHeight: 22,
    },
  });

export default CompanionUserRegistration;
