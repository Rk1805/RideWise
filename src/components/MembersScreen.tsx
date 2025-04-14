import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, FlatList, Alert, StyleSheet } from 'react-native';
import { getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useRoute } from '@react-navigation/native';

const MembersScreen = () => {
  const { groupId } = useRoute().params;
  const db = getFirestore();
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState('');

  useEffect(() => {
    fetchGroupMembers();
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

  const handleAddMember = async () => {
    if (!email.trim()) return;

    try {
      const q = query(collection(db, 'users'), where('username', '==', email.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        Alert.alert('No user found with that email');
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const userId = userDoc.id;
      const userData = userDoc.data();

      // Add groupId to user's groupIds
      const updatedGroupIds = [...(userData.groupIds || []), groupId];
      await updateDoc(doc(db, 'users', userId), {
        groupIds: updatedGroupIds,
      });

      // Add userId to group's members
      const groupRef = doc(db, 'groups', groupId);
      const groupDoc = await getDoc(groupRef);
      const currentMembers = groupDoc.data()?.members || [];
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

  const handleBookRide = () => {
    Alert.alert('Booking ride...', 'This can navigate to ride booking screen.');
    // navigation.navigate('RideBookingScreen', { groupId });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Group Members</Text>
      <FlatList
        data={members}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <Text style={styles.memberItem}>{item}</Text>
        )}
      />

      <TextInput
        placeholder="Enter user name to add"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />
      <Button title="Add Member" onPress={handleAddMember} />

      <View style={{ marginTop: 20 }}>
        <Button title="Book Ride" onPress={handleBookRide} />
      </View>
    </View>
  );
};

export default MembersScreen;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, marginBottom: 10, fontWeight: 'bold' },
  memberItem: { padding: 10, borderBottomWidth: 1, borderColor: '#ccc' },
  input: {
    borderWidth: 1, borderColor: '#ccc',
    padding: 10, marginVertical: 10, borderRadius: 8,
  },
});
