import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { mobileApi } from '../services/api';

export const MeetingScreen = () => {
  const [meetings, setMeetings] = useState<any[]>([]);

  useEffect(() => {
    mobileApi.get<any>('/api/v1/meetings/')
      .then((resp) => setMeetings(resp.results || resp))
      .catch((e) => console.warn(e));
  }, []);

  const joinMeeting = async (roomName: string) => {
    try {
      const resp = await mobileApi.post<any>('/api/v1/meetings/join/', {
        meeting_id: roomName,
      });
      Alert.alert('LiveKit Room Token Ready', `Scoped Token Issued for room: ${resp.room_name}`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Unable to join meeting.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Meetings & Calls</Text>
      </View>
      <FlatList
        data={meetings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.meetingCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>Room: {item.room_name}</Text>
            </View>
            <TouchableOpacity style={styles.joinBtn} onPress={() => joinMeeting(item.room_name)}>
              <Text style={styles.joinText}>Join</Text>
            </TouchableOpacity>
          </View>
        )}
        style={styles.list}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1f1f1f' },
  header: { height: 48, backgroundColor: '#2b2b2b', justifyContent: 'center', paddingHorizontal: 16 },
  headerTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  list: { flex: 1, padding: 12 },
  meetingCard: { backgroundColor: '#2b2b2b', borderRadius: 8, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  title: { color: '#fff', fontSize: 14, fontWeight: '700' },
  subtitle: { color: '#adadad', fontSize: 12, marginTop: 2 },
  joinBtn: { backgroundColor: '#5b5fc7', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
  joinText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
