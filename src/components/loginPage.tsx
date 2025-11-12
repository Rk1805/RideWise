import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ToastAndroid,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { signUp, signIn } from '../service/auth';
import { CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { db } from '../service/firebase';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { doc, getDoc } from 'firebase/firestore';
import { RootStackParamList } from '../App';
import { useTheme } from '../service/themeContext';

const Login = () => {
  const { isDarkMode } = useTheme();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
  const navigation = useNavigation<NavigationProp>();

  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('Notification', message);
    }
  };

  const handleAuthAction = async () => {
    if (isLogin) {
      // 🔑 Login flow
      const resp = await signIn(email, password);

      if (resp) {
        console.log('Authenticated User:', resp);
        showToast('Logged in successfully!');
        const uid: string = resp.uid;

        // Save UID + user type
        await AsyncStorage.setItem('uid', uid);
        await AsyncStorage.setItem('userType', 'user');

        // Check if username exists in Firestore
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (!userDoc.exists()) {
          navigation.navigate('UsernameScreen', { uid });
        } else {
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Dashboard' }],
            })
          );
        }
      } else {
        showToast('Login Failed: Invalid email or password.');
      }
    } else {
      // 🔑 Signup flow
      if (password === confirmPassword) {
        const rep = await signUp(email, password);

        if (rep) {
          console.log('New User Created:', rep);
          showToast('Account created successfully!');
          navigation.navigate('UsernameScreen', { uid: rep.uid });
        } else {
          showToast('Signup Failed: Something went wrong!');
        }
      } else {
        showToast('Signup Failed: Passwords do not match!');
      }
    }
  };

  const styles = createStyles(isDarkMode);

  return (
    <LinearGradient colors={['lightblue', 'aquamarine']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>RideWise</Text>
        <View style={styles.card}>
          <Text style={styles.subtitle}>{isLogin ? 'Login' : 'Sign Up'}</Text>

          <TextInput
            placeholder="Email"
            placeholderTextColor="#888"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            placeholder="Password"
            placeholderTextColor="#888"
            style={styles.input}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {!isLogin && (
            <TextInput
              placeholder="Confirm Password"
              placeholderTextColor="#888"
              style={styles.input}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          )}

          <TouchableOpacity onPress={handleAuthAction} style={styles.buttonContainer}>
            <LinearGradient colors={['#4c669f', '#3b5998', '#192f6a']} style={styles.button}>
              <Text style={styles.buttonText}>{isLogin ? 'Login' : 'Sign Up'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.switchText}>
            {isLogin ? "Don't have an account?" : 'Already have an account?'}
          </Text>
          <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
            <Text style={styles.bottomtext}>{isLogin ? 'signup' : 'login'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#121212' : 'transparent',
    },
    scrollContainer: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    card: {
      width: '90%',
      padding: 20,
      backgroundColor: isDark ? '#1e1e1e' : '#fff',
      borderRadius: 15,
      alignItems: 'center',
      shadowColor: isDark ? '#000' : '#ccc',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
      elevation: 5,
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      color: isDark ? '#ffffff' : '#192f6a',
      marginBottom: 20,
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 5,
    },
    subtitle: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 20,
      color: isDark ? '#fff' : '#333',
    },
    input: {
      width: '90%',
      padding: 10,
      borderWidth: 1,
      borderColor: isDark ? '#333' : '#ddd',
      borderRadius: 25,
      marginBottom: 15,
      backgroundColor: isDark ? '#2a2a2a' : '#f9f9f9',
      color: isDark ? '#fff' : '#000',
    },
    buttonContainer: {
      width: '90%',
      borderRadius: 25,
      overflow: 'hidden',
      marginBottom: 15,
    },
    button: {
      paddingVertical: 12,
      alignItems: 'center',
    },
    buttonText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 16,
    },
    switchText: {
      color: '#1e90ff',
      marginTop: 10,
    },
    bottomtext: {
      color: '#1e90ff',
      marginTop: 10,
      textAlign: 'center',
    },
  });

export default Login;
