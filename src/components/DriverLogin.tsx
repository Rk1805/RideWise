import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { signUp, signIn } from '../service/auth';
import { CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from '../service/firebase';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { RootStackParamList } from '../App';
import { useTheme } from '../service/themeContext';

const DriverLogin = () => {
  const { isDarkMode } = useTheme();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
  const navigation = useNavigation<NavigationProp>();

  const showAlert = (message: string) => {
    Alert.alert('Notification', message);
  };
  

  const handleAuthAction = async () => {
    if (isLogin) {
      const resp = await signIn(email, password);

      if (resp) {
        console.log("Authenticated Driver:", resp);
        const user = auth.currentUser;
        
        if (!user) {
          showAlert('Authentication failed. Please try again.');
          return;
        }

        // Check if the user is registered as a driver
        const userDoc = await getDoc(doc(db, 'drivers', user.uid));
        
        if (!userDoc.exists()) {
          showAlert('This account is not registered as a driver.');
          return;
        }

        const uid = user.uid;
        
        await AsyncStorage.setItem('uid', uid);
        await AsyncStorage.setItem('userType', 'driver');

        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'DriverDashboard' }],
          })
        );
      } else {
        showAlert('Login Failed: Invalid email or password.');
      }
    } else {
      if (password !== confirmPassword) {
        showAlert('Passwords do not match.');
        return;
      }
      
      const rep = await signUp(email, password);

      if (rep) {
        console.log("New Driver Created:", rep);
        showAlert('Account created successfully!');
        
        // Create a driver document
        await setDoc(doc(db, 'drivers', rep.uid), {
          email: email,
          createdAt: new Date(),
          isVerified: false, // Initially set to false
          status: 'unavailable',
        });
        
        // Navigate directly to username setup without email verification
        navigation.navigate('DriverUsername', { uid: rep.uid });
      } else {
        showAlert('Signup Failed: Something went wrong!');
      }
    }
  };

  const styles = createStyles(isDarkMode);

  return (
    <LinearGradient colors={['#4c669f', '#3b5998']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>RideWise Driver</Text>
        <View style={styles.card}>
          <Text style={styles.subtitle}>{isLogin ? 'Driver Login' : 'Driver Sign Up'}</Text>

          <TextInput
            placeholder="Email"
            placeholderTextColor="#888"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
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
            <LinearGradient
              colors={['#FF8008', '#FFA72F']}
              style={styles.button}
            >
              <Text style={styles.buttonText}>{isLogin ? 'Login' : 'Sign Up'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.switchText}>
            {isLogin ? "Don't have a driver account?" : 'Already have a driver account?'}
          </Text>
          <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
            <Text style={styles.bottomtext}>
              {isLogin ? 'Sign Up' : 'Login'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const createStyles = (isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
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
    padding: 12,
    borderWidth: 1,
    borderColor: isDark ? '#333' : '#ddd',
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: isDark ? '#2a2a2a' : '#f9f9f9',
    color: isDark ? '#fff' : '#000',
  },
  buttonContainer: {
    width: '90%',
    borderRadius: 8,
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
    color: isDark ? '#90cdf4' : '#3b82f6',
    marginTop: 10,
  },
  bottomtext: {
    color: isDark ? '#90cdf4' : '#3b82f6',
    marginTop: 10,
    fontWeight: 'bold',
  },
  backText: {
    color: '#888',
    marginTop: 20,
  }
});



export default DriverLogin;
