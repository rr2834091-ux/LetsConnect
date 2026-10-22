import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView } from 'react-native';
import { mobileApi } from '../services/api';

export const TeamsScreen = () => {
  const [teams, setTeams] = useState<any[]>([]);

  useEffect(() => {
    mobileApi.get<any>('/api/v1/teams/')
      .then((resp) => setTeams(resp.results || resp))
      .catch((e) => console.warn(e));
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Teams & Channels</Text>
      </View>
      <FlatList
        data={teams}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.teamCard}>
            <Text style={styles.teamName}>{item.name}</Text>
            <Text style={styles.teamDesc}>{item.description || 'Public organization team'}</Text>
            <Text style={styles.badge}>{item.channels_count || 1} Channels • {item.member_count || 1} Members</Text>
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
  teamCard: { backgroundColor: '#2b2b2b', borderRadius: 8, padding: 14, marginBottom: 12 },
  teamName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  teamDesc: { color: '#adadad', fontSize: 12, marginTop: 4 },
  badge: { color: '#7f85f5', fontSize: 11, fontWeight: '600', marginTop: 8 },
});
