import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Pressable } from 'react-native';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { auth } from '../service/firebase';

const DashboardTemplate = ({ children }: { children: React.ReactNode }) => {
   const navigation = useNavigation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const slideAnim = new Animated.Value(menuOpen ? 0 : -250);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
    Animated.timing(slideAnim, {
      toValue: menuOpen ? -250 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const handleLogout = async () => {
    await auth.signOut(); // Sign out user
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Login' }], // Navigate back to Login screen
      })
    );
  };

  return (
    <View style={styles.container}> 
      {/* Sidebar */}
      <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
        <Pressable onPress={toggleMenu} style={styles.closeButton}>
          <Text style={styles.icon}>&#x2715;</Text>
        </Pressable>
        <TouchableOpacity onPress={() => {
          navigation.dispatch(
            CommonActions.reset({
            index: 0,
            routes: [{ name: 'Dashboard' }],
          })
          );
        }}>
        <Text style={styles.menuItem} >Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.menuItem}>Analytics</Text>
        <Text style={styles.menuItem}>Settings</Text>
      </Animated.View>

      {/* Top Bar */}
      <View style={styles.topBar}> 
        <Pressable onPress={toggleMenu}>
          <Text style={styles.icon}>&#9776;</Text>
        </Pressable>
        <Text style={styles.topBarText}>RideWise</Text>
        <Pressable onPress={() => setProfileOpen(!profileOpen)}>
          <Text style={styles.icon}>&#128100;</Text>
        </Pressable>
      </View>

      {/* Profile Dropdown */}
      {profileOpen && (
        <View style={styles.profileDropdown}> 
          <Text style={styles.profileText}>User Analysis</Text>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Main Content */}
      <View style={styles.mainContent}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    width: 250,
    backgroundColor: 'white',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 15,
    zIndex: 1,
  },
  closeButton: {
    marginBottom: 16,
  },
  icon: {
    fontSize: 24,
    color: 'black',
  },
  menuItem: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#3b82f6',
  },
  topBarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  profileDropdown: {
    position: 'absolute',
    right: 16,
    top: 64,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 15,
    zIndex: 1,
  },
  profileText: {
    fontSize: 18,
    fontWeight: '600',
  },
  logoutText: {
    fontSize: 16,
    color: 'red',
    marginTop: 8,
  },
  mainContent: {
    flex: 1,
    padding: 16,
  },
});

export default DashboardTemplate;