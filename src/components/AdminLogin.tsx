import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../service/themeContext';
import { signIn } from '../service/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../service/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { isDarkMode } = useTheme();
  const navigation = useNavigation<any>();

  const showAlert = (message: string) => {
    Alert.alert('Admin Access', message);
  };

  const handleAdminLogin = async () => {
    if (!email || !password) {
      showAlert('Please enter both email and password.');
      return;
    }

    setIsLoading(true);

    try {
      // First, authenticate the user
      const userCredential = await signIn(email, password);

      if (!userCredential) {
        showAlert('Invalid email or password.');
        setIsLoading(false);
        return;
      }

      const uid = userCredential.uid;

      // Check if the user exists in the users collection
      const userDoc = await getDoc(doc(db, 'users', uid));
      
      if (!userDoc.exists()) {
        showAlert('User account not found. Please contact system administrator.');
        setIsLoading(false);
        return;
      }

      const userData = userDoc.data();
      
      // Verify if the user has admin role
      if (userData.userType !== 'admin') {
        showAlert('Access denied. This account does not have admin privileges.');
        setIsLoading(false);
        return;
      }

      // Store admin authentication
      await AsyncStorage.setItem('uid', uid);
      await AsyncStorage.setItem('userType', 'admin');
      await AsyncStorage.setItem('isAdmin', 'true');

      showAlert('Admin access granted!');
      
      // Navigate to admin dashboard
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'AdminDashboard' }],
        })
      );

    } catch (error) {
      console.error('Admin login error:', error);
      showAlert('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const styles = createStyles(isDarkMode);

  return (
    <LinearGradient
      colors={isDarkMode ? ['#1e1e1e', '#2d2d2d'] : ['#e0f2ff', '#b9e6ff']}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.title, isDarkMode && styles.darkText]}>👑</Text>
            <Text style={[styles.title, isDarkMode && styles.darkText]}>Admin Access</Text>
            <Text style={[styles.subtitle, isDarkMode && styles.darkText]}>
              Enter your admin credentials to continue
            </Text>
          </View>

          <View style={styles.form}>
            <View style={[styles.inputContainer, isDarkMode && styles.darkInputContainer]}>
              <Text style={[styles.label, isDarkMode && styles.darkText]}>Email</Text>
              <TextInput
                style={[styles.input, isDarkMode && styles.darkInput]}
                placeholder="Enter admin email"
                placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={[styles.inputContainer, isDarkMode && styles.darkInputContainer]}>
              <Text style={[styles.label, isDarkMode && styles.darkText]}>Password</Text>
              <TextInput
                style={[styles.input, isDarkMode && styles.darkInput]}
                placeholder="Enter admin password"
                placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.disabledButton]}
              onPress={handleAdminLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.loginButtonText}>Access Admin Panel</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={[styles.backButtonText, isDarkMode && styles.darkText]}>
                ← Back to Main Menu
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, isDarkMode && styles.darkText]}>
              Only authorized administrators can access this panel
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    keyboardView: {
      flex: 1,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      padding: 20,
    },
    header: {
      alignItems: 'center',
      marginBottom: 40,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      color: '#1f2937',
      marginBottom: 10,
    },
    subtitle: {
      fontSize: 16,
      color: '#6b7280',
      textAlign: 'center',
      marginTop: 10,
    },
    form: {
      marginBottom: 30,
    },
    inputContainer: {
      marginBottom: 20,
    },
    darkInputContainer: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: 10,
      padding: 15,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: '#374151',
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: '#d1d5db',
      borderRadius: 10,
      padding: 15,
      fontSize: 16,
      backgroundColor: 'white',
      color: '#1f2937',
    },
    darkInput: {
      borderColor: '#4b5563',
      backgroundColor: '#374151',
      color: '#f9fafb',
    },
    loginButton: {
      backgroundColor: '#dc2626',
      borderRadius: 10,
      padding: 18,
      alignItems: 'center',
      marginTop: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    disabledButton: {
      opacity: 0.6,
    },
    loginButtonText: {
      color: 'white',
      fontSize: 18,
      fontWeight: 'bold',
    },
    backButton: {
      alignItems: 'center',
      marginTop: 20,
      padding: 15,
    },
    backButtonText: {
      fontSize: 16,
      color: '#6b7280',
      textDecorationLine: 'underline',
    },
    footer: {
      alignItems: 'center',
    },
    footerText: {
      fontSize: 14,
      color: '#9ca3af',
      textAlign: 'center',
      fontStyle: 'italic',
    },
    darkText: {
      color: '#f9fafb',
    },
  });

export default AdminLogin;
