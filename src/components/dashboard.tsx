import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet,Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import DashboardTemplate from './dashboardTemplate';

const Dashboard = () => {
  const navigation = useNavigation();

  const cardData = [
    {
      title: 'Book a Ride',
      description: 'Find and book rides instantly.',
      icon: 'car',
      route: 'RideBooking',
      source:require('../assets/download.jpg')
    },
    {
      title: 'Carpooling',
      description: 'Share rides and save costs.',
      icon: 'account-group',
      route: 'Dashboard',
      source:require('../assets/download-1.jpg')
    },
    {
      title: 'My Rides',
      description: 'View your upcoming and past rides.',
      icon: 'history',
      route: 'Dashboard',
      source:require('../assets/images.jpg')
    },
  ];

  return (
    <DashboardTemplate>
      <View style={styles.container}>
        {cardData.map((card, index) => (
          <TouchableOpacity 
            key={index} 
            style={styles.card} 
            onPress={() => navigation.navigate(card.route as never)}
          >
            <Image source={card.source} style={{ width: 40, height: 40 }} />

            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardDescription}>{card.description}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </DashboardTemplate>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  card: {
    width: '100%',
    backgroundColor: 'white',
    paddingVertical: 30,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 0,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
    color: '#3b82f6',
  },
  cardDescription: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 5,
    color: '#6b7280',
  },
});

export default Dashboard;
