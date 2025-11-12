import React from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet , ScrollView} from 'react-native';
import { useTheme } from '../service/themeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

const Settings = () => {
    const navigation = useNavigation();
  const { isDarkMode, toggleDarkMode } = useTheme();

  return (
    <ScrollView style={[styles.container, isDarkMode && styles.darkBackground]}>
      <Text style={[styles.title, isDarkMode && styles.darkText]}>Settings</Text>

      {/* Dark Mode */}
      <View style={styles.settingItem}>
        <Text style={[styles.settingText, isDarkMode && styles.darkText]}>Dark Mode</Text>
        <Switch value={isDarkMode} onValueChange={toggleDarkMode} />
      </View>
      <View style={{flexDirection: 'row', alignItems: 'center'}}>
        <View style={{flex: 1, height: 1, backgroundColor: 'black'}} />
      </View>
      {/* Update Profile */}
      <TouchableOpacity
        style={styles.settingItem}
        onPress={async () => {
            const uid=await AsyncStorage.getItem('uid');
            // Navigate to the Update Profile screen
            navigation.navigate('UpdateProfile',{uid});
        }}>
        <Text style={[styles.settingText, isDarkMode && styles.darkText]}>Update Profile</Text>
      </TouchableOpacity>

      <View style={{flexDirection: 'row', alignItems: 'center'}}>
        <View style={{flex: 1, height: 1, backgroundColor: 'black'}} />
      </View>
      {/* Reset Password */}
      <TouchableOpacity
        style={styles.settingItem}
        onPress={() => navigation.navigate('ResetPassword')}>
        <Text style={[styles.settingText, isDarkMode && styles.darkText]}>Change Password</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "white",
  },
  darkBackground: {
    backgroundColor: "black",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "black",
  },
  darkText: {
    color: "white",
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 10,
  },
  settingText: {
    fontSize: 18,
    color: "black",
  },
  button: {
    padding: 10,
    backgroundColor: "blue",
    borderRadius: 5,
    alignItems: "center",
    marginTop: 20,
  },
  darkButton: {
    backgroundColor: "gray",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
  },
});

export default Settings;