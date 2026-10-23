import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../state/AuthContext';
import { api } from '../../services/api';
import { wsClient } from '../../services/websocket';
import { Conversation, Message, User } from '../../types';
import { MemberProfileModal } from '../../components/common/MemberProfileModal';
import {
  MessageSquare,
  Users,
  Send,
  Paperclip,
  Smile,
  Search,
  Check,
  Video,
  Phone,
  FileText,
  Download,
  Image as ImageIcon,
  X,
  Bell,
  CheckSquare,
  Square,
  Clock,
  ExternalLink,
  ChevronRight,
  Mic,
  Trash2,
  MoreVertical,
  AlertCircle
} from 'lucide-react';

interface StagedFile {
  id: string;
  filename: string;
  file_size: number;
  mime_type: string;
  download_url: string;
}

interface ToastNotification {
  id: string;
  senderName: string;
  text: string;
  conversationId: string;
  title?: string;
}

const COMMON_EMOJIS = [
  '😀', '😂', '😍', '👍', '👏', '🎉',
  '❤️', '🔥', '🚀', '💡', '✅', '🙌',
  '🤝', '💯', '🤔', '😎', '☕', '💪',
  '🎯', '⭐', '👀', '✨', '👋', '🙏'
];

export const ChatPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, activeContext, activeOrganization } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState<string | null>(null);

  // Tabs: Messages or Media
  const [activeTab, setActiveTab] = useState<'messages' | 'media'>('messages');
  const [conversationMedia, setConversationMedia] = useState<any[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);

  // Presence State
  const [presenceMap, setPresenceMap] = useState<Record<string, string>>({});

  // Member Profile Modal State
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | number | null>(null);

  // Conversation Context Menu / Remove Conversation State
  const [convMenuOpenId, setConvMenuOpenId] = useState<string | null>(null);
  const [convToRemove, setConvToRemove] = useState<Conversation | null>(null);

  // New Group Modal State & Validation
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupError, setGroupError] = useState<string | null>(null);
  const [directorySearch, setDirectorySearch] = useState('');
  const [colleagues, setColleagues] = useState<any[]>([]);
  const [selectedColleagueIds, setSelectedColleagueIds] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Voice Message Recording State
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  // File Upload State
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Emoji Picker State
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // @Mentions State
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Bottom-Right Toast Notifications
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getPresenceColor = (status?: string): string => {
    switch (status) {
      case 'available':
        return '#237b4b'; // Green
      case 'busy':
      case 'dnd':
        return '#c4314b'; // Red
      case 'away':
      case 'be_right_back':
        return '#f38518'; // Orange
      case 'offline':
      default:
        return '#8a8886'; // Gray
    }
  };

  // Load presence map
  const loadPresence = async () => {
    try {
      const orgParam = activeOrganization ? `?organization_id=${activeOrganization.id}` : '';
      const resp = await api.get<any>(`/api/v1/presence/${orgParam}`);
      const list = resp.results || resp;
      if (Array.isArray(list)) {
        const map: Record<string, string> = {};
        list.forEach((p: any) => {
          if (p.user) {
            if (p.user.id) map[String(p.user.id)] = p.status;
            if (p.user.email) map[p.user.email.toLowerCase()] = p.status;
          }
        });
        setPresenceMap(prev => ({ ...prev, ...map }));
      }
    } catch {
      // presence load is non-blocking
    }
  };

  // Load conversations
  const loadConversations = async () => {
    try {
      const orgParam = activeContext === 'work' && activeOrganization ? `?organization_id=${activeOrganization.id}` : '';
      const resp = await api.get<any>(`/api/v1/messaging/conversations/${orgParam}`);
      const list = resp.results || resp;
      setConversations(list);
      if (list.length > 0 && !activeConv) {
        setActiveConv(list[0]);
      }
    } catch (err) {
      console.error('Failed to load conversations', err);
    }
  };

  // Load messages for active conversation
  const loadMessages = async (convId: string) => {
    setLoading(true);
    try {
      const resp = await api.get<any>(`/api/v1/messaging/conversations/${convId}/messages/`);
      const list = resp.results || resp;
      setMessages(list);
      setTimeout(scrollToBottom, 50);
    } catch (err) {
      console.error('Failed to load messages', err);
    } finally {
      setLoading(false);
    }
  };

  // Load media & files for active conversation
  const loadMedia = async (convId: string) => {
    setLoadingMedia(true);
    try {
      const resp = await api.get<any>(`/api/v1/messaging/conversations/${convId}/media/`);
      setConversationMedia(resp.results || []);
    } catch (err) {
      console.error('Failed to load media', err);
    } finally {
      setLoadingMedia(false);
    }
  };

  useEffect(() => {
    loadConversations();
    loadPresence();
    const presenceTimer = setInterval(loadPresence, 30000);
    return () => clearInterval(presenceTimer);
  }, [activeContext, activeOrganization]);

  useEffect(() => {
    if (activeConv) {
      loadMessages(activeConv.id);
      loadMedia(activeConv.id);
      setActiveTab('messages');
      wsClient.send('join_conversation', { conversation_id: activeConv.id });

      return () => {
        wsClient.send('leave_conversation', { conversation_id: activeConv.id });
      };
    }
  }, [activeConv]);

  // Real-Time WebSocket event listeners
  useEffect(() => {
    const unsubMessage = wsClient.on('new_message', (data: any) => {
      const newMsg = data.message;
      if (!newMsg) return;

      if (activeConv && newMsg.conversation_id === activeConv.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(scrollToBottom, 50);
        // Refresh media if message contains attachments
        if (newMsg.attachments && newMsg.attachments.length > 0) {
          loadMedia(activeConv.id);
        }
      } else if (newMsg.sender?.id !== user?.id) {
        // Trigger bottom-right toast notification for incoming message
        const convTitle = data.conversation_title || 'New Message';
        const newToast: ToastNotification = {
          id: String(Date.now() + Math.random()),
          senderName: newMsg.sender_name || 'Colleague',
          text: newMsg.content || (newMsg.attachments?.length ? 'Sent an attachment' : 'New message'),
          conversationId: newMsg.conversation_id,
          title: convTitle,
        };
        setToasts((prev) => [...prev, newToast]);

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
        }, 5000);
      }
      loadConversations();
    });

    const unsubTyping = wsClient.on('typing_indicator', (data: any) => {
      if (activeConv && data.conversation_id === activeConv.id && data.user_id !== user?.id) {
        if (data.is_typing) {
          setIsTyping(`${data.user_name} is typing...`);
        } else {
          setIsTyping(null);
        }
      }
    });

    const unsubReaction = wsClient.on('reaction_update', (data: any) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.message_id ? { ...msg, reactions: data.reactions } : msg
        )
      );
    });

    const unsubPresence = wsClient.on('presence_update', (data: any) => {
      if (data && data.user_id && data.status) {
        setPresenceMap((prev) => ({
          ...prev,
          [String(data.user_id)]: data.status,
        }));
      }
    });

    return () => {
      unsubMessage();
      unsubTyping();
      unsubReaction();
      unsubPresence();
    };
  }, [activeConv, user]);

  // Close emoji picker on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  // Send message handler with attachments & text
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && stagedFiles.length === 0) || !activeConv) return;

    const text = inputText.trim();
    const attachmentsPayload = stagedFiles.map((f) => ({
      id: f.id,
      name: f.filename,
      filename: f.filename,
      url: f.download_url,
      download_url: f.download_url,
      size: f.file_size,
      file_size: f.file_size,
      type: f.mime_type,
      mime_type: f.mime_type,
    }));

    setInputText('');
    setStagedFiles([]);
    setShowEmojiPicker(false);
    setMentionQuery(null);

    try {
      const resp = await api.post<Message>(
        `/api/v1/messaging/conversations/${activeConv.id}/messages/`,
        {
          content: text,
          attachments: attachmentsPayload,
        }
      );
      setMessages((prev) => [...prev, resp]);
      setTimeout(scrollToBottom, 50);
      loadConversations();
      if (attachmentsPayload.length > 0) {
        loadMedia(activeConv.id);
      }
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  // Handle typing & @mention detection
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    // Detect @mention
    const cursor = e.target.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursor);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex !== -1 && (atIndex === 0 || textBeforeCursor[atIndex - 1] === ' ')) {
      const query = textBeforeCursor.slice(atIndex + 1);
      if (!query.includes(' ')) {
        setMentionQuery(query);
        setMentionIndex(atIndex);
      } else {
        setMentionQuery(null);
      }
    } else {
      setMentionQuery(null);
    }

    if (!activeConv) return;

    wsClient.send('typing', { conversation_id: activeConv.id, is_typing: true });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      wsClient.send('typing', { conversation_id: activeConv.id, is_typing: false });
    }, 2000);
  };

  // Insert mention into input
  const insertMention = (name: string) => {
    if (mentionIndex === -1) return;
    const beforeAt = inputText.slice(0, mentionIndex);
    const afterQuery = inputText.slice(mentionIndex + 1 + (mentionQuery?.length || 0));
    const newText = `${beforeAt}@${name} ${afterQuery}`;
    setInputText(newText);
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeConv) return;

    setIsUploadingFile(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('conversation_id', activeConv.id);
        if (activeOrganization) {
          formData.append('organization_id', activeOrganization.id);
        }

        const resp = await api.post<any>('/api/v1/files/upload/', formData);
        setStagedFiles((prev) => [
          ...prev,
          {
            id: resp.id,
            filename: resp.filename || file.name,
            file_size: resp.file_size || file.size,
            mime_type: resp.mime_type || file.type,
            download_url: resp.download_url || `/api/v1/files/${resp.id}/download/`,
          },
        ]);
      }
    } catch (err) {
      console.error('File upload failed', err);
      alert('File upload failed. Please try again.');
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeStagedFile = (id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleToggleReaction = async (msgId: string, emoji: string) => {
    try {
      const resp = await api.post<any>(`/api/v1/messaging/messages/${msgId}/reactions/`, { emoji });
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, reactions: resp.reactions } : m))
      );
    } catch (err) {
      console.error('Failed to react', err);
    }
  };

  // Open "New Group" modal
  const openNewGroupModal = async () => {
    setIsNewGroupModalOpen(true);
    setGroupTitle('');
    setGroupError(null);
    setSelectedColleagueIds([]);
    setDirectorySearch('');
    if (activeOrganization) {
      try {
        const resp = await api.get<any>(`/api/v1/memberships/directory/?organization_id=${activeOrganization.id}`);
        setColleagues(resp.results || resp || []);
      } catch (err) {
        console.error('Failed to load colleagues', err);
      }
    }
  };

  const toggleColleagueSelection = (id: string) => {
    setSelectedColleagueIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Create Group or Direct Chat with validation
  const handleCreateGroup = async () => {
    setGroupError(null);
    if (selectedColleagueIds.length === 0) {
      setGroupError('Please select at least one member.');
      return;
    }

    // Validation: Require group name when creating a group
    const isGroup = selectedColleagueIds.length > 1;
    if (isGroup && !groupTitle.trim()) {
      setGroupError('Group name is required.');
      return;
    }

    setCreatingGroup(true);
    try {
      if (selectedColleagueIds.length === 1 && !groupTitle.trim()) {
        // Direct conversation fallback
        const resp = await api.post<Conversation>('/api/v1/messaging/conversations/', {
          conversation_type: 'direct',
          recipient_id: selectedColleagueIds[0],
          organization_id: activeOrganization?.id,
        });
        setIsNewGroupModalOpen(false);
        await loadConversations();
        setActiveConv(resp);
      } else {
        // Group conversation
        const title = groupTitle.trim();
        const resp = await api.post<Conversation>('/api/v1/messaging/conversations/', {
          conversation_type: 'group',
          title,
          participant_ids: selectedColleagueIds,
          organization_id: activeOrganization?.id,
        });
        setIsNewGroupModalOpen(false);
        await loadConversations();
        setActiveConv(resp);
      }
    } catch (err: any) {
      console.error('Failed to create group chat', err);
      setGroupError(err.message || 'Failed to create group');
    } finally {
      setCreatingGroup(false);
    }
  };

  // Remove / Hide Conversation handler
  const handleConfirmRemoveConversation = async () => {
    if (!convToRemove) return;
    try {
      await api.post(`/api/v1/messaging/conversations/${convToRemove.id}/remove-for-user/`);
      const updated = conversations.filter((c) => c.id !== convToRemove.id);
      setConversations(updated);
      if (activeConv?.id === convToRemove.id) {
        setActiveConv(updated.length > 0 ? updated[0] : null);
      }
      setConvToRemove(null);
      setConvMenuOpenId(null);
    } catch (err: any) {
      console.error('Failed to remove conversation', err);
      alert(err.message || 'Failed to remove conversation');
    }
  };

  // Voice Message Recording Methods
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start();
      setIsRecordingAudio(true);
      setAudioDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setAudioDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access error', err);
      alert('Could not access microphone. Please grant audio permissions.');
    }
  };

  const cancelAudioRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    audioChunksRef.current = [];
    setIsRecordingAudio(false);
    setAudioDuration(0);
  };

  const sendAudioRecording = async () => {
    if (!mediaRecorderRef.current || !activeConv) return;
    const recorder = mediaRecorderRef.current;

    recorder.onstop = async () => {
      recorder.stream.getTracks().forEach((t) => t.stop());
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });

      try {
        const formData = new FormData();
        formData.append('file', audioFile);
        formData.append('conversation_id', activeConv.id);
        if (activeOrganization) {
          formData.append('organization_id', activeOrganization.id);
        }

        const uploadResp = await api.post<any>('/api/v1/files/upload/', formData);

        const voiceAttachment = {
          id: uploadResp.id,
          name: uploadResp.filename || audioFile.name,
          filename: uploadResp.filename || audioFile.name,
          url: uploadResp.download_url,
          download_url: uploadResp.download_url || `/api/v1/files/${uploadResp.id}/download/`,
          size: uploadResp.file_size || audioBlob.size,
          file_size: uploadResp.file_size || audioBlob.size,
          type: 'audio/webm',
          mime_type: 'audio/webm',
          is_voice: true,
        };

        const resp = await api.post<Message>(
          `/api/v1/messaging/conversations/${activeConv.id}/messages/`,
          {
            content: '🎤 Voice message',
            attachments: [voiceAttachment],
          }
        );

        setMessages((prev) => [...prev, resp]);
        setTimeout(scrollToBottom, 50);
        loadConversations();
      } catch (err) {
        console.error('Failed to send voice message', err);
        alert('Failed to send voice message. Please try again.');
      } finally {
        setIsRecordingAudio(false);
        setAudioDuration(0);
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
      }
    };

    recorder.stop();
  };

  const formatAudioTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Meeting Call handlers
  const handleStartCall = async (callType: 'video' | 'audio') => {
    if (!activeConv) return;
    try {
      const callTitle = `${callType === 'video' ? 'Video' : 'Audio'} Call: ${activeConv.title || 'Meeting'}`;
      const payload: any = {
        title: callTitle,
        is_instant: true,
        allow_guest: true,
      };
      if (activeOrganization) {
        payload.organization = activeOrganization.id;
      }
      const meetingResp = await api.post<any>('/api/v1/meetings/', payload);

      // Post invitation into chat
      await api.post(`/api/v1/messaging/conversations/${activeConv.id}/messages/`, {
        content: `📞 Started a ${callType} call. [Join Meeting Room: ${meetingResp.room_name}]`,
      });

      // Join the meeting
      const joinResp = await api.post<any>('/api/v1/meetings/join/', {
        meeting_id: meetingResp.id,
      });

      navigate('/call-room', {
        state: {
          meetingId: meetingResp.id,
          meetingToken: joinResp.token,
          livekitUrl: joinResp.livekit_url,
          roomName: joinResp.room_name,
          title: joinResp.title,
          displayName: joinResp.display_name,
          isHost: true,
          initialVideo: callType === 'video',
        },
      });
    } catch (err) {
      console.error('Failed to start call', err);
    }
  };

  const handleJoinMeetingRoom = async (roomNameOrId: string) => {
    try {
      const joinResp = await api.post<any>('/api/v1/meetings/join/', {
        meeting_id: roomNameOrId,
      });
      navigate('/call-room', {
        state: {
          meetingId: joinResp.meeting_id,
          meetingToken: joinResp.token,
          livekitUrl: joinResp.livekit_url,
          roomName: joinResp.room_name,
          title: joinResp.title,
          displayName: joinResp.display_name,
          isHost: joinResp.is_host ?? false,
          initialVideo: true,
        },
      });
    } catch (err) {
      console.error('Failed to join meeting room', err);
    }
  };

  // Helper to get other participant for direct conversations
  const getOtherParticipant = (conv?: Conversation | null) => {
    if (!conv || conv.conversation_type !== 'direct' || !conv.participants) return null;
    const otherPart = conv.participants.find((p) => p.user?.id !== user?.id);
    return otherPart?.user || null;
  };

  // Helper to get conversation presence
  const getConversationPresence = (conv: Conversation): string => {
    if (conv.conversation_type === 'direct' && conv.participants) {
      const otherPart = conv.participants.find((p) => p.user?.id !== user?.id);
      if (otherPart && otherPart.user) {
        const status =
          presenceMap[String(otherPart.user.id)] ||
          presenceMap[otherPart.user.email?.toLowerCase()] ||
          'offline';
        return status;
      }
    }
    return '';
  };

  // Filter colleagues in modal
  const filteredColleagues = colleagues.filter((c) => {
    const q = directorySearch.toLowerCase();
    const name = (c.full_name || `${c.first_name || ''} ${c.last_name || ''}`).toLowerCase();
    const email = (c.email || '').toLowerCase();
    const title = (c.job_title || '').toLowerCase();
    return name.includes(q) || email.includes(q) || title.includes(q);
  });

  // Filter mention candidates
  const mentionCandidates = colleagues.filter((c) => {
    if (!mentionQuery) return true;
    const q = mentionQuery.toLowerCase();
    const name = (c.full_name || `${c.first_name || ''} ${c.last_name || ''}`).toLowerCase();
    return name.includes(q);
  }).slice(0, 5);

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* Left Chat Pane: Conversations List */}
      <div style={{
        width: '320px',
        borderRight: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Pane Header */}
        <div style={{
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Chat</h2>
          <button
            onClick={openNewGroupModal}
            className="teams-btn teams-btn-primary"
            style={{ padding: '6px 12px', fontSize: '12px', gap: '6px' }}
            title="Create a new group discussion"
          >
            <Users size={15} />
            <span>New Group</span>
          </button>
        </div>

        {/* Conversation List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {conversations.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
              No conversations yet. Create a New Group to begin collaborating!
            </div>
          ) : (
            conversations.map((conv) => {
              const isSelected = activeConv?.id === conv.id;
              const presenceStatus = getConversationPresence(conv);
              return (
                <div
                  key={conv.id}
                  onClick={() => setActiveConv(conv)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--brand-primary)' : '3px solid transparent',
                    transition: 'background-color 0.15s',
                    position: 'relative',
                  }}
                >
                  {/* Avatar with Presence Indicator */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      backgroundColor: conv.conversation_type === 'group' ? 'var(--brand-secondary)' : 'var(--brand-primary)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      fontSize: '13px',
                    }}>
                      {conv.conversation_type === 'group' ? (
                        <Users size={18} />
                      ) : conv.title ? (
                        conv.title.slice(0, 2).toUpperCase()
                      ) : (
                        'CH'
                      )}
                    </div>

                    {presenceStatus && (
                      <span
                        title={`Status: ${presenceStatus}`}
                        style={{
                          position: 'absolute',
                          bottom: '-1px',
                          right: '-1px',
                          width: '11px',
                          height: '11px',
                          borderRadius: '50%',
                          backgroundColor: getPresenceColor(presenceStatus),
                          border: '2px solid var(--bg-secondary)',
                        }}
                      />
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: isSelected ? 600 : 500, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {conv.title || 'Conversation'}
                      </span>
                      {conv.last_message && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {new Date(conv.last_message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                      {conv.last_message ? `${conv.last_message.sender_name}: ${conv.last_message.content}` : 'No messages yet'}
                    </div>
                  </div>

                  {Boolean(conv.unread_count && conv.unread_count > 0) && (
                    <span style={{
                      backgroundColor: 'var(--brand-primary)',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 700,
                      borderRadius: '10px',
                      padding: '2px 6px',
                    }}>
                      {conv.unread_count}
                    </span>
                  )}

                  {/* 3-dots action menu for removing conversation */}
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConvMenuOpenId(convMenuOpenId === conv.id ? null : conv.id);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="More options"
                    >
                      <MoreVertical size={14} />
                    </button>
                    {convMenuOpenId === conv.id && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          right: 0,
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          boxShadow: '0 8px 18px rgba(0,0,0,0.3)',
                          zIndex: 50,
                          minWidth: '150px',
                          padding: '4px 0',
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConvToRemove(conv);
                            setConvMenuOpenId(null);
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--danger)',
                            fontSize: '12px',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <Trash2 size={13} />
                          <span>Remove chat</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Chat Pane: Message Stream */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
        {activeConv ? (
          <>
            {/* Header with Presence & Call Buttons */}
            <div style={{
              height: '56px',
              padding: '0 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-secondary)',
            }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: activeConv.conversation_type === 'direct' ? 'pointer' : 'default',
                }}
                onClick={() => {
                  const other = getOtherParticipant(activeConv);
                  if (other) {
                    setSelectedProfileId(other.id);
                    setProfileModalOpen(true);
                  }
                }}
                title={activeConv.conversation_type === 'direct' ? 'View Profile' : undefined}
              >
                <div style={{ position: 'relative' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: activeConv.conversation_type === 'group' ? 'var(--brand-secondary)' : 'var(--brand-primary)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    fontSize: '12px',
                  }}>
                    {activeConv.conversation_type === 'group' ? <Users size={16} /> : activeConv.title?.slice(0, 2).toUpperCase() || 'CH'}
                  </div>
                  {getConversationPresence(activeConv) && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '-1px',
                        right: '-1px',
                        width: '9px',
                        height: '9px',
                        borderRadius: '50%',
                        backgroundColor: getPresenceColor(getConversationPresence(activeConv)),
                        border: '2px solid var(--bg-secondary)',
                      }}
                    />
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '15px' }}>{activeConv.title || 'Conversation'}</span>
                    <span style={{
                      fontSize: '11px',
                      backgroundColor: 'var(--bg-hover)',
                      color: 'var(--text-secondary)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      textTransform: 'capitalize',
                    }}>
                      {activeConv.conversation_type}
                    </span>
                    {activeConv.conversation_type === 'direct' && (
                      <span style={{ fontSize: '11px', color: 'var(--brand-light)' }}>
                        (Click for profile)
                      </span>
                    )}
                  </div>
                  {getConversationPresence(activeConv) && (
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                      Status: {getConversationPresence(activeConv)}
                    </div>
                  )}
                </div>
              </div>

              {/* Header Right: Call Actions and Tabs */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Tabs: Messages vs Media */}
                <div style={{
                  display: 'flex',
                  backgroundColor: 'var(--bg-hover)',
                  borderRadius: '6px',
                  padding: '2px',
                }}>
                  <button
                    onClick={() => setActiveTab('messages')}
                    style={{
                      border: 'none',
                      backgroundColor: activeTab === 'messages' ? 'var(--brand-primary)' : 'transparent',
                      color: activeTab === 'messages' ? '#fff' : 'var(--text-secondary)',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Messages
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('media');
                      loadMedia(activeConv.id);
                    }}
                    style={{
                      border: 'none',
                      backgroundColor: activeTab === 'media' ? 'var(--brand-primary)' : 'transparent',
                      color: activeTab === 'media' ? '#fff' : 'var(--text-secondary)',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Media ({conversationMedia.length})
                  </button>
                </div>

                {/* Call Action Buttons */}
                <button
                  onClick={() => handleStartCall('video')}
                  className="teams-btn teams-btn-secondary"
                  style={{ height: '32px', padding: '0 10px', fontSize: '12px' }}
                  title="Start Video Call"
                >
                  <Video size={15} color="var(--brand-primary)" />
                  <span>Video Call</span>
                </button>
                <button
                  onClick={() => handleStartCall('audio')}
                  className="teams-btn teams-btn-secondary"
                  style={{ height: '32px', padding: '0 10px', fontSize: '12px' }}
                  title="Start Audio Call"
                >
                  <Phone size={15} color="#237b4b" />
                  <span>Audio Call</span>
                </button>
              </div>
            </div>

            {/* Main Content Area: Messages OR Media Tab */}
            {activeTab === 'messages' ? (
              <>
                {/* Messages Feed */}
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}>
                  {loading && messages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Loading messages...</div>
                  ) : messages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', marginTop: '40px' }}>
                      No messages in this conversation yet. Send the first message or share a file!
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.sender?.id === user?.id;
                      return (
                        <div
                          key={msg.id}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: isMe ? 'flex-end' : 'flex-start',
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: '8px',
                            marginBottom: '4px',
                            fontSize: '12px',
                            color: 'var(--text-secondary)',
                          }}>
                            <span
                              onClick={() => {
                                if (msg.sender?.id) {
                                  setSelectedProfileId(msg.sender.id);
                                  setProfileModalOpen(true);
                                }
                              }}
                              style={{
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                cursor: msg.sender?.id ? 'pointer' : 'default',
                              }}
                              title={msg.sender?.id ? 'Click to view profile' : undefined}
                            >
                              {msg.sender_name}
                            </span>
                            <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>

                          <div style={{
                            maxWidth: '75%',
                            backgroundColor: isMe ? 'var(--brand-primary)' : 'var(--bg-secondary)',
                            color: isMe ? '#ffffff' : 'var(--text-primary)',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            fontSize: '14px',
                            lineHeight: '1.4',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            position: 'relative',
                          }}>
                            {/* Message Text with @mention highlighting */}
                            {msg.content && (
                              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {msg.content.includes('[Join Meeting Room:') ? (
                                  <div>
                                    <div>{msg.content.replace(/\[Join Meeting Room:[^\]]+\]/, '').trim()}</div>
                                    <button
                                      onClick={() => {
                                        const match = msg.content.match(/\[Join Meeting Room:\s*([a-zA-Z0-9_-]+)\]/);
                                        if (match && match[1]) {
                                          handleJoinMeetingRoom(match[1]);
                                        }
                                      }}
                                      className="teams-btn teams-btn-primary"
                                      style={{ marginTop: '8px', fontSize: '12px', padding: '4px 12px' }}
                                    >
                                      <Video size={14} />
                                      <span>Join Call</span>
                                    </button>
                                  </div>
                                ) : (
                                  // Highlight @mentions in text
                                  msg.content.split(/(@[A-Za-z0-9_.\s]+?)(?=\s|$)/g).map((chunk, i) => {
                                    if (chunk.startsWith('@')) {
                                      return (
                                        <span
                                          key={i}
                                          style={{
                                            backgroundColor: isMe ? 'rgba(255,255,255,0.25)' : 'rgba(43,87,154,0.15)',
                                            color: isMe ? '#ffffff' : 'var(--brand-primary)',
                                            padding: '1px 6px',
                                            borderRadius: '4px',
                                            fontWeight: 600,
                                            display: 'inline-block',
                                            marginRight: '2px',
                                          }}
                                        >
                                          {chunk}
                                        </span>
                                      );
                                    }
                                    return chunk;
                                  })
                                )}
                              </div>
                            )}

                            {/* Render Attachments in message card */}
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div style={{ marginTop: msg.content ? '8px' : '0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {msg.attachments.map((att: any, idx: number) => {
                                  const filename = att.filename || att.name || 'Attachment';
                                  const size = att.file_size || att.size || 0;
                                  const isVoice = att.is_voice || (att.mime_type || '').startsWith('audio/');
                                  const isImg = (att.mime_type || att.type || '').startsWith('image/');
                                  const dlUrl = att.download_url || att.url || `/api/v1/files/${att.id}/download/`;

                                  if (isVoice) {
                                    return (
                                      <div
                                        key={idx}
                                        style={{
                                          backgroundColor: isMe ? 'rgba(0,0,0,0.2)' : 'var(--bg-hover)',
                                          borderRadius: '6px',
                                          padding: '8px 12px',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: '6px',
                                          minWidth: '240px',
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}>
                                          <Mic size={14} color={isMe ? '#fff' : 'var(--brand-primary)'} />
                                          <span>Voice Message</span>
                                        </div>
                                        <audio controls src={dlUrl} style={{ width: '100%', height: '36px' }} />
                                      </div>
                                    );
                                  }

                                  return (
                                    <div
                                      key={idx}
                                      style={{
                                        backgroundColor: isMe ? 'rgba(0,0,0,0.15)' : 'var(--bg-hover)',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        borderRadius: '6px',
                                        padding: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                      }}
                                    >
                                      {isImg ? (
                                        <ImageIcon size={24} style={{ flexShrink: 0 }} />
                                      ) : (
                                        <FileText size={24} style={{ flexShrink: 0 }} />
                                      )}
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {filename}
                                        </div>
                                        <div style={{ fontSize: '11px', opacity: 0.8 }}>
                                          {formatFileSize(size)}
                                        </div>
                                      </div>
                                      <a
                                        href={dlUrl}
                                        download={filename}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="teams-btn teams-btn-secondary"
                                        style={{
                                          padding: '4px 8px',
                                          fontSize: '11px',
                                          height: '28px',
                                          color: isMe ? '#fff' : 'var(--text-primary)',
                                          backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : undefined,
                                        }}
                                        title="Download attachment"
                                      >
                                        <Download size={14} />
                                        <span>Download</span>
                                      </a>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Reactions bar */}
                            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                              <div style={{
                                display: 'flex',
                                gap: '4px',
                                marginTop: '6px',
                                flexWrap: 'wrap',
                              }}>
                                {Object.entries(msg.reactions).map(([emoji, userIds]) => (
                                  <button
                                    key={emoji}
                                    onClick={() => handleToggleReaction(msg.id, emoji)}
                                    style={{
                                      backgroundColor: 'rgba(0,0,0,0.2)',
                                      border: 'none',
                                      borderRadius: '12px',
                                      padding: '2px 6px',
                                      fontSize: '12px',
                                      cursor: 'pointer',
                                      color: '#fff',
                                    }}
                                  >
                                    {emoji} {(userIds as any[]).length}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Quick Reaction Tray on hover */}
                          <div style={{ display: 'flex', gap: '4px', marginTop: '2px', opacity: 0.7 }}>
                            {['👍', '❤️', '👏', '🎉', '😂', '💡'].map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => handleToggleReaction(msg.id, emoji)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  padding: '2px',
                                }}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                  {isTyping && (
                    <div style={{ fontSize: '12px', color: 'var(--brand-light)', fontStyle: 'italic' }}>
                      {isTyping}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Composer Area */}
                <div style={{
                  padding: '12px 20px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderTop: '1px solid var(--border-color)',
                  position: 'relative',
                }}>
                  {/* Mention suggestions popover */}
                  {mentionQuery !== null && mentionCandidates.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '20px',
                      width: '260px',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                      overflow: 'hidden',
                      marginBottom: '8px',
                      zIndex: 100,
                    }}>
                      <div style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                        Mention Colleague
                      </div>
                      {mentionCandidates.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => insertMention(c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email)}
                          style={{
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                          }}
                          className="teams-list-item"
                        >
                          <div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--brand-primary)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 600,
                          }}>
                            {(c.first_name || c.full_name || 'U').slice(0, 1)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500 }}>{c.full_name || `${c.first_name || ''} ${c.last_name || ''}`}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{c.email}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Staged attachments preview tray */}
                  {stagedFiles.length > 0 && (
                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      flexWrap: 'wrap',
                      marginBottom: '8px',
                      padding: '8px',
                      backgroundColor: 'var(--bg-hover)',
                      borderRadius: '6px',
                    }}>
                      {stagedFiles.map((f) => (
                        <div
                          key={f.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '12px',
                          }}
                        >
                          <FileText size={14} color="var(--brand-primary)" />
                          <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.filename}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            ({formatFileSize(f.file_size)})
                          </span>
                          <button
                            type="button"
                            onClick={() => removeStagedFile(f.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-muted)' }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Emoji picker popup */}
                  {showEmojiPicker && (
                    <div
                      ref={emojiPickerRef}
                      style={{
                        position: 'absolute',
                        bottom: '60px',
                        right: '70px',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                        padding: '12px',
                        width: '240px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(6, 1fr)',
                        gap: '6px',
                        zIndex: 100,
                      }}
                    >
                      {COMMON_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setInputText((prev) => prev + emoji);
                            inputRef.current?.focus();
                          }}
                          style={{
                            fontSize: '18px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                          }}
                          className="teams-emoji-btn"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Composer input & action buttons */}
                  {isRecordingAudio ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      backgroundColor: 'var(--bg-hover)',
                      borderRadius: '6px',
                      padding: '8px 14px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)', fontWeight: 600, fontSize: '13px' }}>
                        <span style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--danger)',
                          display: 'inline-block',
                        }} />
                        <span>Recording voice message... ({formatAudioTime(audioDuration)})</span>
                      </div>
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={cancelAudioRecording}
                          className="teams-btn teams-btn-secondary"
                          style={{ height: '34px', padding: '0 10px', fontSize: '12px', color: 'var(--danger)' }}
                        >
                          <Trash2 size={14} />
                          <span>Cancel</span>
                        </button>
                        <button
                          type="button"
                          onClick={sendAudioRecording}
                          className="teams-btn teams-btn-primary"
                          style={{ height: '34px', padding: '0 12px', fontSize: '12px', gap: '6px' }}
                        >
                          <Send size={14} />
                          <span>Send Voice</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSendMessage} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* Hidden file input */}
                      <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        multiple
                        onChange={handleFileUpload}
                      />

                      {/* Paperclip file attach button */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingFile}
                        className="teams-btn teams-btn-secondary"
                        style={{ height: '38px', width: '38px', padding: 0, justifyContent: 'center' }}
                        title="Attach file"
                      >
                        <Paperclip size={18} color="var(--brand-primary)" />
                      </button>

                      {/* Voice recording button */}
                      <button
                        type="button"
                        onClick={startAudioRecording}
                        disabled={isUploadingFile}
                        className="teams-btn teams-btn-secondary"
                        style={{ height: '38px', width: '38px', padding: 0, justifyContent: 'center' }}
                        title="Record voice message"
                      >
                        <Mic size={18} color="var(--brand-primary)" />
                      </button>

                      {/* Emoji toggle button */}
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="teams-btn teams-btn-secondary"
                        style={{ height: '38px', width: '38px', padding: 0, justifyContent: 'center' }}
                        title="Insert emoji"
                      >
                        <Smile size={18} color="var(--brand-primary)" />
                      </button>

                      {/* Text input */}
                      <input
                        ref={inputRef}
                        type="text"
                        placeholder="Type a message or @ to mention colleagues (Enter to send)"
                        value={inputText}
                        onChange={handleInputChange}
                        className="teams-input"
                        style={{ flex: 1, height: '38px' }}
                      />

                      {/* Send button */}
                      <button
                        type="submit"
                        disabled={(!inputText.trim() && stagedFiles.length === 0) || isUploadingFile}
                        className="teams-btn teams-btn-primary"
                        style={{ height: '38px', padding: '0 16px', gap: '6px' }}
                      >
                        <Send size={15} />
                        <span>Send</span>
                      </button>
                    </form>
                  )}
                  {isUploadingFile && (
                    <div style={{ fontSize: '11px', color: 'var(--brand-primary)', marginTop: '4px' }}>
                      Uploading file attachment...
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Media & Files Tab Content */
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Media & Files shared in this conversation</h3>
                  <button
                    onClick={() => loadMedia(activeConv.id)}
                    className="teams-btn teams-btn-secondary"
                    style={{ fontSize: '12px', padding: '4px 10px' }}
                  >
                    Refresh
                  </button>
                </div>

                {loadingMedia ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>Loading media files...</div>
                ) : conversationMedia.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '60px 20px' }}>
                    <FileText size={40} style={{ opacity: 0.4, marginBottom: '12px' }} />
                    <p style={{ fontSize: '14px', fontWeight: 500 }}>No media or files shared yet</p>
                    <p style={{ fontSize: '12px', marginTop: '4px' }}>Files and images sent in this conversation will appear here.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    {conversationMedia.map((item) => {
                      const isImg = (item.mime_type || '').startsWith('image/');
                      return (
                        <div
                          key={item.id}
                          style={{
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '6px',
                              backgroundColor: isImg ? 'rgba(70,120,250,0.1)' : 'rgba(250,150,50,0.1)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}>
                              {isImg ? <ImageIcon size={22} color="var(--brand-primary)" /> : <FileText size={22} color="#f38518" />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.filename}>
                                {item.filename}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                {formatFileSize(item.file_size)} • {item.uploader_name || 'Member'}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                            <a
                              href={item.download_url}
                              download={item.filename}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="teams-btn teams-btn-primary"
                              style={{ padding: '6px 12px', fontSize: '12px', gap: '6px' }}
                            >
                              <Download size={14} />
                              <span>Download</span>
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
          }}>
            <MessageSquare size={48} style={{ opacity: 0.4, marginBottom: '16px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Select a chat to begin messaging</h3>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>Real-time team chat, direct messages, and group discussions</p>
          </div>
        )}
      </div>

      {/* New Group Modal */}
      {isNewGroupModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            borderRadius: '8px',
            width: '460px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '24px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={20} color="var(--brand-primary)" />
                <h3 style={{ fontSize: '17px', fontWeight: 600 }}>Create New Group</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewGroupModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Group Name input */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>
                Group Name
              </label>
              <input
                type="text"
                placeholder="e.g. Engineering Project Sync"
                className="teams-input"
                value={groupTitle}
                onChange={(e) => {
                  setGroupTitle(e.target.value);
                  if (groupError) setGroupError(null);
                }}
              />
            </div>

            {/* Validation Error Banner */}
            {groupError && (
              <div style={{
                padding: '8px 12px',
                backgroundColor: 'rgba(219,53,69,0.1)',
                border: '1px solid var(--danger)',
                borderRadius: '4px',
                color: 'var(--danger)',
                fontSize: '12px',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <AlertCircle size={14} />
                <span>{groupError}</span>
              </div>
            )}

            {/* Colleague Search Filter */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>
                Select Members ({selectedColleagueIds.length} selected)
              </label>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '11px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search colleagues by name or email..."
                  className="teams-input"
                  style={{ paddingLeft: '34px' }}
                  value={directorySearch}
                  onChange={(e) => setDirectorySearch(e.target.value)}
                />
              </div>
            </div>

            {/* Directory List with Presence and Checkboxes */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              maxHeight: '260px',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              backgroundColor: 'var(--bg-primary)',
              marginBottom: '20px',
            }}>
              {filteredColleagues.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No colleagues found matching search.
                </div>
              ) : (
                filteredColleagues.map((colleague) => {
                  const isChecked = selectedColleagueIds.includes(colleague.id);
                  const pStatus =
                    presenceMap[String(colleague.id)] ||
                    presenceMap[colleague.email?.toLowerCase()] ||
                    'offline';

                  return (
                    <div
                      key={colleague.id}
                      onClick={() => toggleColleagueSelection(colleague.id)}
                      style={{
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: isChecked ? 'var(--bg-hover)' : 'transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* Avatar with presence dot */}
                        <div style={{ position: 'relative' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--brand-primary)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 600,
                            fontSize: '12px',
                          }}>
                            {(colleague.first_name || colleague.full_name || 'U').slice(0, 2).toUpperCase()}
                          </div>
                          <span
                            title={`Status: ${pStatus}`}
                            style={{
                              position: 'absolute',
                              bottom: '-1px',
                              right: '-1px',
                              width: '9px',
                              height: '9px',
                              borderRadius: '50%',
                              backgroundColor: getPresenceColor(pStatus),
                              border: '2px solid var(--bg-primary)',
                            }}
                          />
                        </div>

                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>
                            {colleague.full_name || `${colleague.first_name || ''} ${colleague.last_name || ''}`.trim() || colleague.email}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {colleague.job_title ? `${colleague.job_title} • ` : ''}{colleague.email}
                          </div>
                        </div>
                      </div>

                      <div>
                        {isChecked ? (
                          <CheckSquare size={18} color="var(--brand-primary)" />
                        ) : (
                          <Square size={18} color="var(--text-muted)" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsNewGroupModalOpen(false)}
                className="teams-btn teams-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={selectedColleagueIds.length === 0 || creatingGroup}
                onClick={handleCreateGroup}
                className="teams-btn teams-btn-primary"
              >
                {creatingGroup ? 'Creating...' : selectedColleagueIds.length > 1 ? 'Create Group' : 'Start Chat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom-Right Toast Notifications */}
      {toasts.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          zIndex: 9999,
          maxWidth: '340px',
        }}>
          {toasts.map((toast) => (
            <div
              key={toast.id}
              onClick={() => {
                const target = conversations.find((c) => c.id === toast.conversationId);
                if (target) setActiveConv(target);
                setToasts((prev) => prev.filter((t) => t.id !== toast.id));
              }}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderLeft: '4px solid var(--brand-primary)',
                borderTop: '1px solid var(--border-color)',
                borderRight: '1px solid var(--border-color)',
                borderBottom: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '12px 16px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                animation: 'fadeIn 0.2s ease-in',
              }}
            >
              <Bell size={18} color="var(--brand-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{toast.senderName}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                  {toast.text}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setToasts((prev) => prev.filter((t) => t.id !== toast.id));
                }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Remove Conversation Confirmation Modal */}
      {convToRemove && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '440px',
            width: '90%',
            boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
          }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 600 }}>Remove Chat</h3>
            <p style={{ margin: '0 0 18px 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Are you sure you want to remove <strong>"{convToRemove.title || 'this conversation'}"</strong> from your chat list?
              <br /><br />
              Your message history will be preserved, and the conversation will reappear if someone sends a new message.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setConvToRemove(null)}
                className="teams-btn teams-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveConversation}
                className="teams-btn teams-btn-primary"
                style={{ backgroundColor: 'var(--danger)', borderColor: 'var(--danger)' }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Profile Modal */}
      <MemberProfileModal
        isOpen={profileModalOpen}
        onClose={() => {
          setProfileModalOpen(false);
          setSelectedProfileId(null);
        }}
        memberId={selectedProfileId}
      />
    </div>
  );
};
