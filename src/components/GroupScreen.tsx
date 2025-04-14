import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Button, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { getFirestore, doc, getDoc, collection, getDocs, addDoc, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { TouchableOpacity } from 'react-native-gesture-handler';

const GroupScreen = () => {
  const navigation = useNavigation();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const db = getFirestore();
  const auth = getAuth();
  const user = auth.currentUser;

  useEffect(() => {
    if (user) fetchUserGroups();
  }, [user]);

  const fetchUserGroups = async () => {
    try {
        const uid= await AsyncStorage.getItem('uid');
      const userDoc = await getDoc(doc(db, 'users', uid));
      const groupIds = userDoc.data()?.groupId || [];

      if (groupIds.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }

      const groupPromises = groupIds.map((groupId:string) => getDoc(doc(db, 'groups', groupId)));
      const groupDocs = await Promise.all(groupPromises);

      const fetchedGroups = groupDocs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setGroups(fetchedGroups);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) return;

    try {
      const uid= await AsyncStorage.getItem('uid');
      const groupRef = await addDoc(collection(db, 'groups'), {
        name: newGroupName.trim(),
        members: [uid],
        createdAt: new Date(),
        createdBy: uid,
      });

      await updateDoc(doc(db, 'users', uid), {
        groupId: [...(groups.map((g) => g.id)), groupRef.id]
      });

      setNewGroupName('');
      fetchUserGroups();
    } catch (error) {
      console.error('Error adding group:', error);
    }
  };

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 40 }} size="large" />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Carpool Groups</Text>
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
            <TouchableOpacity
            onPress={() => navigation.navigate('MembersScreen', { groupId: item.id })}
            >
            <View style={styles.groupCard}>
                <Text style={styles.groupName}>{item.name}</Text>
                <Text style={styles.groupMembers}>Members: {item.members?.length || 0}</Text>
            </View>
            </TouchableOpacity>
        )}
        />

      <View style={styles.addGroupContainer}>
        <TextInput
          placeholder="Enter new group name"
          value={newGroupName}
          onChangeText={setNewGroupName}
          style={styles.input}
        />
        <Button title="Add Group" onPress={handleAddGroup} />
      </View>
    </View>
  );
};

export default GroupScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    marginBottom: 10,
    fontWeight: 'bold',
  },
  groupCard: {
    padding: 15,
    backgroundColor: '#f0f4f7',
    borderRadius: 10,
    marginBottom: 10,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
  },
  groupMembers: {
    fontSize: 14,
    color: '#555',
  },
  addGroupContainer: {
    marginTop: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
});
