import { View, Text, TouchableOpacity, StyleSheet, Image, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DashboardTemplate from './dashboardTemplate';
import { useTheme } from '../service/themeContext';
import { useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../service/firebase';

const Dashboard = () => {
  const {isDarkMode}=useTheme();
  const navigation = useNavigation();

  useEffect(() => {
    if (!auth.currentUser) return;
    
    // Listen for rides that were recently accepted
    const q = query(
      collection(db, 'history'),
      where('userId', '==', auth.currentUser.uid),
      where('status', '==', 'accepted')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || 
           (change.type === 'modified' && change.doc.data().status === 'accepted')) {
          // Show notification for newly accepted ride
          const ride = change.doc.data();
          Alert.alert(
            'Ride Accepted!',
            `A driver has accepted your ride from ${ride.from} to ${ride.to}`,
            [{ text: 'View Details', onPress: () => navigation.navigate('RideHistory') }]
          );
        }
      });
    });
    
    return () => unsubscribe();
  }, []);

  const cardData = [
    {
      title: 'Book a Ride',
      description: 'Find and book rides instantly.',
      icon: 'car',
      route: 'RideBooking',
      source: require('../assets/bookRide.png'),
      iconStyle: { width: 80, height: 60 }
    },
    {
      title: 'Carpooling',
      description: 'Share rides and save costs.',
      icon: 'account-group',
      route: 'GroupScreen',
      source: require('../assets/carpoolicon.png'),
      iconStyle: { width: 80, height: 60 }
    },
    {
      title: 'My Rides',
      description: 'View your upcoming and past rides.',
      icon: 'history',
      route: 'RideHistory',
      source: require('../assets/x.png'),
      iconStyle: { width: 80, height: 60 }
    },
  ];

  const styles=getStyles(isDarkMode)

  return (
    <DashboardTemplate>
      <View style={styles.container}>
        {cardData.map((card, index) => (
          <TouchableOpacity
            key={index}
            style={styles.card}
            onPress={() => navigation.navigate(card.route as never)}
          >
            <Image source={card.source} style={[{ marginBottom: 8 }, card.iconStyle]} />


            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardDescription}>{card.description}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </DashboardTemplate>
  );
};

const getStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: isDarkMode ? '#121212' : '#f9f9f9',
  },
  card: {
    width: '100%',
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
    backgroundColor: isDarkMode ? '#1f1f1f' : '#f8f9fa',
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
