import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  Alert,
  Modal
} from 'react-native';
import { mobileApi } from '../services/api';

export const ChatScreen = () => {
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConv, setActiveConv] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);

  const loadConversations = async () => {
    try {
      const resp = await mobileApi.get<any>('/api/v1/messaging/conversations/');
      const list = resp.results || resp;
      setConversations(list);
      if (list.length > 0 && !activeConv) {
        setActiveConv(list[0]);
      }
    } catch (e) {
      console.warn('Failed to load convos', e);
    }
  };

  const loadMessages = async (id: string) => {
    try {
      const resp = await mobileApi.get<any>(`/api/v1/messaging/conversations/${id}/messages/`);
      setMessages(resp.results || resp);
    } catch (e) {
      console.warn('Failed to load messages', e);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (activeConv) {
      loadMessages(activeConv.id);
    }
  }, [activeConv]);

  const sendMessage = async () => {
    if (!inputText.trim() || !activeConv) return;
    const text = inputText.trim();
    setInputText('');

    try {
      const resp = await mobileApi.post<any>(
        `/api/v1/messaging/conversations/${activeConv.id}/messages/`,
        { content: text }
      );
      setMessages((prev) => [...prev, resp]);
    } catch (e) {
      console.warn('Failed to send msg', e);
    }
  };

  const handleMessageReaction = (msgId: string, emoji: string) => {
    mobileApi.post(`/api/v1/messaging/messages/${msgId}/reactions/`, { emoji })
      .then(() => {
        if (activeConv) loadMessages(activeConv.id);
      })
      .catch((e) => console.warn('Failed reaction', e));
  };

  const openReactionSheet = (msg: any) => {
    Alert.alert(
      'React to Message',
      'Select a reaction:',
      [
        { text: '👍', onPress: () => handleMessageReaction(msg.id, '👍') },
        { text: '❤️', onPress: () => handleMessageReaction(msg.id, '❤️') },
        { text: '🎉', onPress: () => handleMessageReaction(msg.id, '🎉') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const hideConversation = (convId: string) => {
    Alert.alert(
      'Hide Chat',
      'Are you sure you want to hide this conversation? Message history will be retained.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Hide',
          style: 'destructive',
          onPress: async () => {
            try {
              await mobileApi.post(`/api/v1/messaging/conversations/${convId}/remove-for-user/`, {});
              const remaining = conversations.filter((c) => c.id !== convId);
              setConversations(remaining);
              if (remaining.length > 0) setActiveConv(remaining[0]);
              else setActiveConv(null);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to hide chat');
            }
          }
        }
      ]
    );
  };

  const viewMemberProfile = async (userId: string | number) => {
    try {
      const profile = await mobileApi.get<any>(`/api/v1/memberships/profile/${userId}/`);
      setSelectedProfile(profile);
    } catch (e) {
      Alert.alert('Profile', 'Member profile details could not be loaded.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View style={[styles.statusDot, { backgroundColor: activeConv?.presence === 'busy' ? '#c4314b' : activeConv?.presence === 'away' ? '#f5a623' : '#237b4b' }]} />
          <Text style={styles.headerTitle}>{activeConv?.title || 'Chat'}</Text>
        </View>
        {activeConv && (
          <TouchableOpacity onPress={() => hideConversation(activeConv.id)}>
            <Text style={styles.hideBtn}>Hide</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.msgCard}
            onLongPress={() => openReactionSheet(item)}
            activeOpacity={0.8}
          >
            <TouchableOpacity onPress={() => item.sender_id && viewMemberProfile(item.sender_id)}>
              <Text style={styles.senderName}>{item.sender_name}</Text>
            </TouchableOpacity>
            <Text style={styles.msgContent}>{item.content}</Text>
            {item.reactions && item.reactions.length > 0 && (
              <View style={styles.reactionsRow}>
                {item.reactions.map((r: any, idx: number) => (
                  <Text key={idx} style={styles.reactionPill}>{r.emoji} {r.count}</Text>
                ))}
              </View>
            )}
          </TouchableOpacity>
        )}
        style={styles.list}
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#8a8a8a"
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>

      {/* Member Profile Modal */}
      {selectedProfile && (
        <Modal visible={true} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.profileModal}>
              <Text style={styles.profileName}>{selectedProfile.full_name || selectedProfile.username}</Text>
              <Text style={styles.profileEmail}>{selectedProfile.email}</Text>
              {selectedProfile.department && (
                <Text style={styles.profileDetail}>Department: {selectedProfile.department}</Text>
              )}
              {selectedProfile.job_title && (
                <Text style={styles.profileDetail}>Role: {selectedProfile.job_title}</Text>
              )}
              {selectedProfile.corporate_id && (
                <Text style={styles.profileDetail}>Corp ID: {selectedProfile.corporate_id}</Text>
              )}
              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setSelectedProfile(null)}
              >
                <Text style={styles.closeModalText}>Close</Text>
              </TouchableOpacity>
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
  headerTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700', marginLeft: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  hideBtn: { color: '#ff6b6b', fontSize: 12, fontWeight: '600' },
  list: { flex: 1, padding: 12 },
  msgCard: { backgroundColor: '#2b2b2b', borderRadius: 8, padding: 10, marginBottom: 10 },
  senderName: { color: '#7f85f5', fontSize: 12, fontWeight: '600', marginBottom: 2 },
  msgContent: { color: '#ffffff', fontSize: 14 },
  reactionsRow: { flexDirection: 'row', gap: 4, marginTop: 6 },
  reactionPill: { backgroundColor: '#383838', color: '#fff', fontSize: 11, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  inputBar: { flexDirection: 'row', padding: 8, backgroundColor: '#2b2b2b' },
  input: { flex: 1, backgroundColor: '#1f1f1f', color: '#fff', borderRadius: 6, paddingHorizontal: 12, height: 38 },
  sendBtn: { backgroundColor: '#5b5fc7', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, marginLeft: 8, borderRadius: 6 },
  sendText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  profileModal: { width: '100%', maxWidth: 340, backgroundColor: '#2b2b2b', borderRadius: 10, padding: 20 },
  profileName: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  profileEmail: { color: '#7f85f5', fontSize: 13, marginBottom: 12 },
  profileDetail: { color: '#adadad', fontSize: 13, marginBottom: 6 },
  closeModalBtn: { backgroundColor: '#5b5fc7', paddingVertical: 10, borderRadius: 6, alignItems: 'center', marginTop: 14 },
  closeModalText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
