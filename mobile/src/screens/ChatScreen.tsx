import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView
} from 'react-native';
import { mobileApi } from '../services/api';

export const ChatScreen = () => {
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConv, setActiveConv] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{activeConv?.title || 'Chat'}</Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.msgCard}>
            <Text style={styles.senderName}>{item.sender_name}</Text>
            <Text style={styles.msgContent}>{item.content}</Text>
          </View>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1f1f1f' },
  header: { height: 48, backgroundColor: '#2b2b2b', justifyContent: 'center', paddingHorizontal: 16 },
  headerTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  list: { flex: 1, padding: 12 },
  msgCard: { backgroundColor: '#2b2b2b', borderRadius: 8, padding: 10, marginBottom: 10 },
  senderName: { color: '#7f85f5', fontSize: 12, fontWeight: '600', marginBottom: 2 },
  msgContent: { color: '#ffffff', fontSize: 14 },
  inputBar: { flexDirection: 'row', padding: 8, backgroundColor: '#2b2b2b' },
  input: { flex: 1, backgroundColor: '#1f1f1f', color: '#fff', borderRadius: 6, paddingHorizontal: 12, height: 38 },
  sendBtn: { backgroundColor: '#5b5fc7', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, marginLeft: 8, borderRadius: 6 },
  sendText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
