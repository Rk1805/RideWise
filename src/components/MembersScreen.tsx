import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  ScrollView,
  Alert,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getAuth } from 'firebase/auth';
import { 
  realtimeDb 
} from '../service/firebase'; // Adjust this path if needed
import { 
  ref as rtdbRef, 
  query as rtdbQuery, 
  orderByChild, 
  equalTo, 
  get, 
  limitToLast 
} from "firebase/database";

const MembersScreen = () => {
  const navigation = useNavigation();
  const { groupId } = useRoute().params;
  const db = getFirestore();
  const auth = getAuth();

  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false); // For loading state

  useEffect(() => {
    fetchGroupMembers();
    fetchMessages();
  }, []);

  const fetchGroupMembers = async () => {
    try {
      const groupDoc = await getDoc(doc(db, 'groups', groupId));
      const memberIds = groupDoc.data()?.members || [];

      const memberPromises = memberIds.map(uid => getDoc(doc(db, 'users', uid)));
      const memberDocs = await Promise.all(memberPromises);

      const memberEmails = memberDocs.map(doc => doc.data()?.username || 'Unknown User');
      setMembers(memberEmails);
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      const groupDoc = await getDoc(doc(db, 'groups', groupId));
      const messagesArray = groupDoc.data()?.messages || [];

      const enrichedMessages = await Promise.all(
        messagesArray.map(async (msg) => {
          let senderName = 'Unknown';
          if (msg.senderId) {
            const senderDoc = await getDoc(doc(db, 'users', msg.senderId));
            if (senderDoc.exists()) {
              senderName = senderDoc.data().username || 'Unknown';
            }
          }
          return { ...msg, senderName };
        })
      );

      setMessages(enrichedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleAddMember = async () => {
    if (!email.trim()) return;

    try {
      const q = query(collection(db, 'users'), where('username', '==', email.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        Alert.alert('No user found with that username');
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const userId = userDoc.id;
      const userData = userDoc.data();

      const updatedGroupIds = [...(userData.groupIds || []), groupId];
      await updateDoc(doc(db, 'users', userId), {
        groupId: updatedGroupIds,
      });

      const groupRef = doc(db, 'groups', groupId);
      const groupDocSnap = await getDoc(groupRef);
      const currentMembers = groupDocSnap.data()?.members || [];

      if (!currentMembers.includes(userId)) {
        await updateDoc(groupRef, {
          members: [...currentMembers, userId],
        });
      }

      setEmail('');
      fetchGroupMembers();
    } catch (error) {
      console.error('Error adding member:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert("You must be logged in to send a message.");
        return;
      }

      const groupRef = doc(db, 'groups', groupId);
      const groupDocSnap = await getDoc(groupRef);
      const currentMessages = groupDocSnap.data()?.messages || [];

      const newMsgObj = {
        text: newMessage.trim(),
        senderId: user.uid,
        timestamp: Date.now(),
      };

      await updateDoc(groupRef, {
        messages: [...currentMessages, newMsgObj],
      });

      setNewMessage('');
      fetchMessages();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleBookRide = () => {
    navigation.navigate('CarpoolBooking', { groupId: groupId });
  };

  const handleViewActiveRide = async () => {
    setIsLoading(true);
    try {
      // Query 'rideRequests' node where 'groupId' matches this screen's groupId
      const rideRequestRef = rtdbRef(realtimeDb, 'rideRequests');
      const rideQuery = rtdbQuery(
        rideRequestRef,
        orderByChild('groupId'),
        equalTo(groupId),
        limitToLast(10) // Check the last 10 rides for this group
      );

      const snapshot = await get(rideQuery);

      if (!snapshot.exists()) {
        Alert.alert('No Rides Found', 'There are no active carpool rides for this group.');
        setIsLoading(false);
        return;
      }

      let activeRide = null;
      let activeRideId = null;

      // Loop through the results to find one that is active
      snapshot.forEach((childSnapshot) => {
        const ride = childSnapshot.val();
        const status = ride.status;
        
        // Define what "active" means
        if (status === 'requested' || status === 'accepted' || status === 'ongoing') {
          activeRide = ride;
          activeRideId = childSnapshot.key;
        }
      });

      if (activeRide) {
        // Found an active ride, navigate to the waiting screen
        navigation.navigate('CarpoolWaiting', { origin: { latitude: activeRide.startLat, longitude: activeRide.startLong }, destination: { latitude: activeRide.endLat, longitude: activeRide.endLong }, realtimeId: activeRideId});
      } else {
        Alert.alert('No Rides Found', 'There are no active carpool rides for this group.');
      }

    } catch (error) {
      console.error("Error finding active ride:", error);
      Alert.alert('Error', 'Could not search for active rides.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.wrapper}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.section}>
          <Text style={styles.title}>Members</Text>
          {members.map((member, index) => (
            <Text key={index} style={styles.memberItem}>{member}</Text>
          ))}
        </View>

        <TextInput
          placeholder="Enter username to add"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />
        <TouchableOpacity style={styles.button} onPress={handleAddMember}>
          <Text style={styles.buttonText}>Add Member</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.title}>Messages</Text>
          {messages.length === 0 ? (
            <Text style={styles.noContent}>No messages yet.</Text>
          ) : (
            messages.map((msg, idx) => (
              <View key={idx} style={styles.messageItem}>
                <Text style={styles.sender}>{msg.senderName}:</Text>
                <Text style={styles.messageText}>{msg.text}</Text>
              </View>
            ))
          )}
          <TextInput
            placeholder="Type your message..."
            value={newMessage}
            onChangeText={setNewMessage}
            style={styles.input}
          />
          <TouchableOpacity style={styles.button} onPress={handleSendMessage}>
            <Text style={styles.buttonText}>Send Message</Text>
          </TouchableOpacity>
        </View>



        <TouchableOpacity 
          style={styles.viewRideButton} 
          onPress={handleViewActiveRide}
          disabled={isLoading}
        >
          <Text style={styles.rideButtonText}>
            {isLoading ? 'Searching...' : 'View Active Carpool'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.rideButton} 
          onPress={handleBookRide}
        >
          <Text style={styles.rideButtonText}>Book New Carpool</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default MembersScreen;

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  container: {
    padding: 20,
  },
  title: {
    fontSize: 20,
    marginBottom: 10,
    fontWeight: 'bold',
  },
  viewRideButton: {
    marginTop: 10,
    backgroundColor: '#ffc107', // A different color (e.g., yellow)
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  rideButton: {
    marginTop: 10, // Changed from 40
    backgroundColor: '#28a745',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },

  input: {
    borderWidth: 1,
    borderColor: '#bbb',
    padding: 10,
    marginBottom: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#4e8cff',
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  section: {
    marginTop: 30,
  },
  messageItem: {
    backgroundColor: '#e0e0e0',
    padding: 12,
    marginBottom: 8,
    borderRadius: 10,
  },
  sender: {
    fontWeight: 'bold',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 15,
  },
  noContent: {
    fontStyle: 'italic',
    color: '#555',
  },
  memberItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#ccc',
    fontSize: 16,
  },
  rideButton: {
    marginTop: 40,
    backgroundColor: '#28a745',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  rideButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
