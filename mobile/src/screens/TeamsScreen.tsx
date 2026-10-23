import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { mobileApi } from '../services/api';

export const TeamsScreen = () => {
  const [teams, setTeams] = useState<any[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');

  const loadTeams = () => {
    mobileApi.get<any>('/api/v1/teams/')
      .then((resp) => setTeams(resp.results || resp))
      .catch((e) => console.warn(e));
  };

  useEffect(() => {
    loadTeams();
  }, []);

  const handleCreateTeam = async () => {
    // Enforce non-empty team name validation
    if (!newTeamName.trim()) {
      Alert.alert('Validation Error', 'Team name cannot be empty.');
      return;
    }

    try {
      await mobileApi.post('/api/v1/teams/', {
        name: newTeamName.trim(),
        description: newTeamDesc.trim(),
      });
      setIsCreateOpen(false);
      setNewTeamName('');
      setNewTeamDesc('');
      loadTeams();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create team.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Teams & Channels</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setIsCreateOpen(true)}>
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
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

      {/* Create Team Modal */}
      {isCreateOpen && (
        <Modal visible={true} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Create New Team</Text>
              <TextInput
                style={styles.input}
                placeholder="Team name (required)"
                placeholderTextColor="#8a8a8a"
                value={newTeamName}
                onChangeText={setNewTeamName}
              />
              <TextInput
                style={styles.input}
                placeholder="Description (optional)"
                placeholderTextColor="#8a8a8a"
                value={newTeamDesc}
                onChangeText={setNewTeamDesc}
              />
              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsCreateOpen(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleCreateTeam}>
                  <Text style={styles.saveText}>Create Team</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1f1f1f' },
  header: { height: 48, backgroundColor: '#2b2b2b', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  headerTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  addBtn: { backgroundColor: '#5b5fc7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  list: { flex: 1, padding: 12 },
  teamCard: { backgroundColor: '#2b2b2b', borderRadius: 8, padding: 14, marginBottom: 12 },
  teamName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  teamDesc: { color: '#adadad', fontSize: 12, marginTop: 4 },
  badge: { color: '#7f85f5', fontSize: 11, fontWeight: '600', marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', maxWidth: 340, backgroundColor: '#2b2b2b', borderRadius: 10, padding: 20 },
  modalTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 14 },
  input: { backgroundColor: '#1f1f1f', color: '#fff', borderRadius: 6, paddingHorizontal: 12, height: 40, marginBottom: 12 },
  btnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6 },
  cancelText: { color: '#adadad', fontWeight: '600', fontSize: 13 },
  saveBtn: { backgroundColor: '#5b5fc7', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
