import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ColorValue } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../service/firebase';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../service/themeContext';
import { LinearGradient } from 'expo-linear-gradient';

const DriverUsername = () => {
  const { isDarkMode } = useTheme();
  const [username, setUsername] = useState('');
  const navigation = useNavigation();
  const route = useRoute();
  const { uid } = route.params;

  const handleSaveUsername = async () => {
    console.log('Uid', uid);
    if (!username.trim()) {
      Alert.alert('Validation', 'Please enter a username.');
      return;
    }

    try {
        await updateDoc(doc(db, 'drivers', uid), {
        username: username.trim(),
        createdAt: new Date(),
        });

      Alert.alert('Success', 'Username saved!');
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'DriverDashboard' }],
        })
      );
    } catch (error) {
      console.error('Error saving username:', error);
      Alert.alert('Error', 'Failed to save username.');
    }
  };

  const gradientColors: [ColorValue, ColorValue, ...ColorValue[]] = isDarkMode
    ? ['#1a1c2e', '#111827']
    : ['#4776E6', '#8E54E9'];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardAvoid}
    >
      <LinearGradient colors={gradientColors} style={styles.container}>
        <View style={styles.card}>
          <Text style={[styles.heading, { color: isDarkMode ? '#f9fafb' : '#333' }]}>
            Welcome!
          </Text>
          <Text style={[styles.subheading, { color: isDarkMode ? '#d1d5db' : '#666' }]}>
            Choose a username to get started
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              placeholder="Enter username"
              placeholderTextColor={isDarkMode ? '#9ca3af' : '#999'}
              style={[
                styles.input,
                {
                  backgroundColor: isDarkMode ? '#1f2937' : '#fff',
                  color: isDarkMode ? '#f3f4f6' : '#333',
                  borderColor: isDarkMode ? '#4b5563' : '#e5e7eb',
                },
              ]}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            onPress={handleSaveUsername}
            style={[styles.button, { opacity: username.trim() ? 1 : 0.7 }]}
          >
            <LinearGradient
              colors={['#FF8008', '#FFA72F']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>Continue</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: 30,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  heading: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subheading: {
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 30,
  },
  input: {
    borderWidth: 1,
    padding: 16,
    borderRadius: 16,
    fontSize: 18,
    fontWeight: '500',
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#FF8008',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  buttonGradient: {
    padding: 18,
    alignItems: 'center',
    borderRadius: 16,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 18,
    letterSpacing: 0.5,
  },
});

export default DriverUsername;