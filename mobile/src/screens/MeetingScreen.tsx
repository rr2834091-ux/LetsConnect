import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, Alert, Dimensions } from 'react-native';
import { mobileApi } from '../services/api';

export const MeetingScreen = () => {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [activeCallRoom, setActiveCallRoom] = useState<any | null>(null);

  const loadMeetings = () => {
    mobileApi.get<any>('/api/v1/meetings/')
      .then((resp) => setMeetings(resp.results || resp))
      .catch((e) => console.warn(e));
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  const joinMeeting = async (roomName: string, title?: string) => {
    try {
      const resp = await mobileApi.post<any>('/api/v1/meetings/join/', {
        meeting_id: roomName,
      });
      setActiveCallRoom({
        roomName: resp.room_name || roomName,
        title: resp.title || title || 'Call Room',
        token: resp.token,
      });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Unable to join meeting.');
    }
  };

  const endCall = () => {
    setActiveCallRoom(null);
    loadMeetings();
  };

  if (activeCallRoom) {
    return (
      <SafeAreaView style={styles.activeCallContainer}>
        <View style={styles.callHeader}>
          <Text style={styles.callHeaderTitle}>{activeCallRoom.title}</Text>
          <Text style={styles.callHeaderSubtitle}>Room: {activeCallRoom.roomName}</Text>
        </View>

        {/* Responsive mobile video view fitting device screen */}
        <View style={styles.videoGrid}>
          {/* Remote video tile */}
          <View style={styles.videoTile}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>RP</Text>
            </View>
            <Text style={styles.participantName}>Remote Colleague</Text>
          </View>

          {/* Local video tile */}
          <View style={[styles.videoTile, styles.localTile]}>
            <View style={[styles.avatarCircle, { backgroundColor: '#237b4b' }]}>
              <Text style={styles.avatarText}>ME</Text>
            </View>
            <Text style={styles.participantName}>You</Text>
          </View>
        </View>

        {/* Call control action bar returning to calls list on end */}
        <View style={styles.callControls}>
          <TouchableOpacity style={styles.endCallBtn} onPress={endCall}>
            <Text style={styles.endCallText}>End Call</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
            <TouchableOpacity style={styles.joinBtn} onPress={() => joinMeeting(item.room_name, item.title)}>
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

  // Responsive active call layout
  activeCallContainer: { flex: 1, backgroundColor: '#141414', justifyContent: 'space-between' },
  callHeader: { padding: 16, backgroundColor: '#1f1f1f', alignItems: 'center' },
  callHeaderTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  callHeaderSubtitle: { color: '#adadad', fontSize: 12, marginTop: 2 },
  videoGrid: { flex: 1, padding: 12, justifyContent: 'center', gap: 12 },
  videoTile: { flex: 1, width: '100%', backgroundColor: '#262626', borderRadius: 10, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  localTile: { flex: 0.8 },
  avatarCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#5b5fc7', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  participantName: { position: 'absolute', bottom: 10, left: 12, color: '#fff', fontSize: 12, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  callControls: { height: 72, backgroundColor: '#1f1f1f', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  endCallBtn: { backgroundColor: '#c4314b', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 24 },
  endCallText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
