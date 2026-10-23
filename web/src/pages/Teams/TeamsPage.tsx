import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../state/AuthContext';
import { api } from '../../services/api';
import { wsClient } from '../../services/websocket';
import { Team, Channel, Message } from '../../types';
import {
  Users,
  Hash,
  Lock,
  Plus,
  Send,
  UserPlus,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  Copy,
  Check,
  Globe,
  LogIn,
  Paperclip,
  Smile,
  Mic,
  Edit2,
  Trash2,
  X,
  Download,
  FileText,
  Image as ImageIcon
} from 'lucide-react';

interface PersonalCommunity {
  id: string;
  name: string;
  description: string;
  is_private: boolean;
  join_policy: string;
  invite_code: string;
  members_count: number;
  channels: any[];
  user_role: string;
}

const COMMON_EMOJIS = [
  '😀', '😂', '😍', '👍', '👏', '🎉',
  '❤️', '🔥', '🚀', '💡', '✅', '🙌',
  '🤝', '💯', '🤔', '😎', '☕', '💪'
];

export const TeamsPage: React.FC = () => {
  const { user, activeOrganization, activeContext, permissions } = useAuth();

  // Work Teams State
  const [teams, setTeams] = useState<Team[]>([]);
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});
  const [channelsByTeam, setChannelsByTeam] = useState<Record<string, Channel[]>>({});
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [channelMessages, setChannelMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [actionError, setActionError] = useState('');

  // Personal Communities State
  const [communities, setCommunities] = useState<PersonalCommunity[]>([]);
  const [isCreateCommunityOpen, setIsCreateCommunityOpen] = useState(false);
  const [newCommunityName, setNewCommunityName] = useState('');
  const [newCommunityDesc, setNewCommunityDesc] = useState('');
  const [newCommunityPrivate, setNewCommunityPrivate] = useState(false);

  const [isJoinCommunityOpen, setIsJoinCommunityOpen] = useState(false);
  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modals for Work Teams
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [newTeamVisibility, setNewTeamVisibility] = useState<'public' | 'private'>('public');

  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [targetTeamId, setTargetTeamId] = useState<string | null>(null);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'standard' | 'private'>('standard');

  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [selectedTeamForMember, setSelectedTeamForMember] = useState<Team | null>(null);
  const [directoryEmployees, setDirectoryEmployees] = useState<any[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [memberRole, setMemberRole] = useState<'member' | 'owner'>('member');

  // Edit / Delete Modals State
  const [editTeamModal, setEditTeamModal] = useState<Team | null>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamDesc, setEditTeamDesc] = useState('');
  const [deleteTeamModal, setDeleteTeamModal] = useState<Team | null>(null);

  const [editChannelModal, setEditChannelModal] = useState<{ teamId: string; channel: Channel } | null>(null);
  const [editChannelName, setEditChannelName] = useState('');
  const [editChannelDesc, setEditChannelDesc] = useState('');
  const [deleteChannelModal, setDeleteChannelModal] = useState<{ teamId: string; channel: Channel } | null>(null);
  const [managementError, setManagementError] = useState<string | null>(null);

  // Channel Chat File Upload & Voice State
  const [stagedFiles, setStagedFiles] = useState<any[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Permission evaluations for enterprise work teams
  const canCreateTeam = Boolean(permissions?.is_org_admin || permissions?.can_create_teams);

  const canManageTeam = (team: Team) => {
    return Boolean(permissions?.is_org_admin || team.user_role === 'owner');
  };

  const canAddMemberToTeam = (team: Team) => {
    if (permissions?.is_org_admin) return true;
    if (team.user_role === 'owner' && permissions?.team_owner_can_add_users) return true;
    return false;
  };

  const canCreateChannelInTeam = (team: Team) => {
    if (permissions?.is_org_admin) return true;
    if (team.user_role === 'owner' && permissions?.team_owner_can_create_teams_channels) return true;
    if (permissions?.user_can_create_teams_channels && team.allow_member_create_channels) return true;
    return false;
  };

  // ================= LOAD WORK TEAMS =================
  const loadTeams = async () => {
    if (!activeOrganization?.id) return;
    setLoadingTeams(true);
    setActionError('');
    try {
      const resp = await api.get<any>(`/api/v1/teams/?organization_id=${activeOrganization.id}`);
      const list: Team[] = Array.isArray(resp) ? resp : (resp.results || []);
      setTeams(list);

      const newExpanded: Record<string, boolean> = {};
      for (const t of list) {
        newExpanded[t.id] = true;
      }
      setExpandedTeams(newExpanded);

      await Promise.all(list.map((t) => loadChannels(t.id)));
    } catch (err: any) {
      console.error('Failed to load teams', err);
      setActionError(err.message || 'Failed to load teams for active organization.');
    } finally {
      setLoadingTeams(false);
    }
  };

  const loadChannels = async (teamId: string) => {
    try {
      const resp = await api.get<any>(`/api/v1/channels/?team_id=${teamId}`);
      const list: Channel[] = Array.isArray(resp) ? resp : (resp.results || []);
      setChannelsByTeam((prev) => ({ ...prev, [teamId]: list }));
      setActiveChannel((curr) => {
        if (!curr && list.length > 0) {
          return list[0];
        }
        return curr;
      });
    } catch (err: any) {
      console.error('Failed to load channels for team', teamId, err);
    }
  };

  // ================= LOAD PERSONAL COMMUNITIES =================
  const loadCommunities = async () => {
    setLoadingTeams(true);
    setActionError('');
    try {
      const resp = await api.get<any>('/api/v1/communities/');
      const list: PersonalCommunity[] = Array.isArray(resp) ? resp : (resp.results || []);
      setCommunities(list);

      const newExpanded: Record<string, boolean> = {};
      const channelMap: Record<string, Channel[]> = {};

      for (const comm of list) {
        newExpanded[comm.id] = true;
        const commChannels: Channel[] = (comm.channels || []).map((ch: any) => ({
          id: ch.id,
          team: comm.id,
          name: ch.name,
          description: ch.description || '',
          channel_type: ch.is_private ? 'private' : 'standard',
          is_archived: false,
          conversation_id: ch.conversation_id,
          created_at: ch.created_at,
        }));
        channelMap[comm.id] = commChannels;
      }

      setExpandedTeams(newExpanded);
      setChannelsByTeam(channelMap);

      // Auto-select first channel if none selected
      setActiveChannel((curr) => {
        if (!curr) {
          for (const comm of list) {
            const first = channelMap[comm.id]?.[0];
            if (first) return first;
          }
        }
        return curr;
      });
    } catch (err: any) {
      console.error('Failed to load personal communities', err);
      setActionError(err.message || 'Failed to load personal communities.');
    } finally {
      setLoadingTeams(false);
    }
  };

  // Initial loader depending on active context
  useEffect(() => {
    if (activeContext === 'personal') {
      loadCommunities();
    } else if (activeOrganization?.id) {
      loadTeams();
    }
  }, [activeContext, activeOrganization?.id]);

  // Load Channel Messages
  const loadChannelMessages = async (convId: string) => {
    setLoading(true);
    try {
      const resp = await api.get<any>(`/api/v1/messaging/conversations/${convId}/messages/`);
      const list: Message[] = Array.isArray(resp) ? resp : (resp.results || []);
      setChannelMessages(list);
    } catch (err: any) {
      console.error('Failed to load channel messages', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeChannel?.conversation_id) {
      loadChannelMessages(activeChannel.conversation_id);
    }
  }, [activeChannel?.conversation_id]);

  // Real-time WebSocket listener for channel conversation
  useEffect(() => {
    if (!activeChannel?.conversation_id) return;
    const convId = activeChannel.conversation_id;

    wsClient.send('join_conversation', { conversation_id: convId });

    const unbind = wsClient.on('new_message', (data: any) => {
      if (data?.message && data.message.conversation_id === convId) {
        setChannelMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
    });

    return () => {
      wsClient.send('leave_conversation', { conversation_id: convId });
      unbind();
    };
  }, [activeChannel?.conversation_id]);

  const toggleTeamExpand = (id: string) => {
    setExpandedTeams((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Handlers for Work Teams
  const handleOpenCreateTeam = () => {
    if (!canCreateTeam) {
      setActionError('Access Denied: Your organization policy restricts team creation to administrators and authorized owners.');
      return;
    }
    setActionError('');
    setIsCreateTeamOpen(true);
  };

  const handleOpenAddMember = (team: Team) => {
    if (!canAddMemberToTeam(team)) {
      setActionError(`Access Denied: You do not have permission to add members to "${team.name}". Only team owners or administrators are permitted under your organization policy.`);
      return;
    }
    openAddMemberModal(team);
  };

  const handleOpenCreateChannel = (teamId: string, teamName: string, isOwner = true) => {
    if (activeContext === 'work') {
      const team = teams.find((t) => t.id === teamId);
      if (team && !canCreateChannelInTeam(team)) {
        setActionError(`Access Denied: You do not have permission to create channels in "${team.name}".`);
        return;
      }
    }
    setTargetTeamId(teamId);
    setActionError('');
    setIsCreateChannelOpen(true);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) {
      setActionError('Team name is required.');
      return;
    }
    if (!activeOrganization) return;
    setActionError('');

    try {
      await api.post('/api/v1/teams/', {
        organization: activeOrganization.id,
        name: newTeamName.trim(),
        description: newTeamDesc.trim(),
        visibility: newTeamVisibility,
      });

      setIsCreateTeamOpen(false);
      setNewTeamName('');
      setNewTeamDesc('');
      await loadTeams();
    } catch (err: any) {
      setActionError(err.message || 'Permission denied: unable to create team.');
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) {
      setActionError('Channel name is required.');
      return;
    }
    if (!targetTeamId) return;
    setActionError('');

    try {
      if (activeContext === 'personal') {
        await api.post('/api/v1/communities/channels/', {
          community_id: targetTeamId,
          name: newChannelName.trim(),
          channel_type: 'text',
          is_private: newChannelType === 'private',
        });
        setIsCreateChannelOpen(false);
        setNewChannelName('');
        await loadCommunities();
      } else {
        await api.post('/api/v1/channels/', {
          team: targetTeamId,
          name: newChannelName.trim(),
          channel_type: newChannelType,
        });
        setIsCreateChannelOpen(false);
        setNewChannelName('');
        await loadChannels(targetTeamId);
      }
    } catch (err: any) {
      setActionError(err.message || 'Unable to create channel.');
    }
  };

  // Team Edit & Delete Handlers
  const handleOpenEditTeam = (team: Team) => {
    setEditTeamModal(team);
    setEditTeamName(team.name);
    setEditTeamDesc(team.description || '');
    setManagementError(null);
  };

  const handleSaveEditTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTeamModal || !editTeamName.trim()) {
      setManagementError('Team name is required.');
      return;
    }
    try {
      await api.patch(`/api/v1/teams/${editTeamModal.id}/`, {
        name: editTeamName.trim(),
        description: editTeamDesc.trim(),
      });
      setEditTeamModal(null);
      await loadTeams();
    } catch (err: any) {
      setManagementError(err.message || 'Failed to update team.');
    }
  };

  const handleConfirmDeleteTeam = async () => {
    if (!deleteTeamModal) return;
    try {
      await api.delete(`/api/v1/teams/${deleteTeamModal.id}/`);
      setDeleteTeamModal(null);
      await loadTeams();
    } catch (err: any) {
      alert(err.message || 'Failed to delete team.');
    }
  };

  // Channel Edit & Delete Handlers
  const handleOpenEditChannel = (teamId: string, channel: Channel) => {
    setEditChannelModal({ teamId, channel });
    setEditChannelName(channel.name);
    setEditChannelDesc(channel.description || '');
    setManagementError(null);
  };

  const handleSaveEditChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editChannelModal || !editChannelName.trim()) {
      setManagementError('Channel name is required.');
      return;
    }
    try {
      await api.patch(`/api/v1/channels/${editChannelModal.channel.id}/`, {
        name: editChannelName.trim(),
        description: editChannelDesc.trim(),
      });
      const teamId = editChannelModal.teamId;
      setEditChannelModal(null);
      await loadChannels(teamId);
    } catch (err: any) {
      setManagementError(err.message || 'Failed to update channel.');
    }
  };

  const handleConfirmDeleteChannel = async () => {
    if (!deleteChannelModal) return;
    const ch = deleteChannelModal.channel;
    if (ch.name.toLowerCase() === 'general') {
      alert('Cannot delete the default #general channel.');
      return;
    }
    try {
      await api.delete(`/api/v1/channels/${ch.id}/`);
      const teamId = deleteChannelModal.teamId;
      setDeleteChannelModal(null);
      if (activeChannel?.id === ch.id) {
        setActiveChannel(null);
      }
      await loadChannels(teamId);
    } catch (err: any) {
      alert(err.message || 'Failed to delete channel.');
    }
  };

  // File Upload in Channel
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeChannel?.conversation_id) return;

    setIsUploadingFile(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('conversation_id', activeChannel.conversation_id);
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

  // Voice Recording in Channel
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
      console.error('Microphone error', err);
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
    if (!mediaRecorderRef.current || !activeChannel?.conversation_id) return;
    const recorder = mediaRecorderRef.current;

    recorder.onstop = async () => {
      recorder.stream.getTracks().forEach((t) => t.stop());
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });

      try {
        const formData = new FormData();
        formData.append('file', audioFile);
        formData.append('conversation_id', activeChannel.conversation_id);
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
          `/api/v1/messaging/conversations/${activeChannel.conversation_id}/messages/`,
          {
            content: '🎤 Voice message',
            attachments: [voiceAttachment],
          }
        );

        setChannelMessages((prev) => [...prev, resp]);
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

  const handleSendChannelMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!messageInput.trim() && stagedFiles.length === 0) || !activeChannel?.conversation_id) return;

    const text = messageInput.trim();
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

    setMessageInput('');
    setStagedFiles([]);
    setShowEmojiPicker(false);

    try {
      const resp = await api.post<Message>(
        `/api/v1/messaging/conversations/${activeChannel.conversation_id}/messages/`,
        {
          content: text,
          attachments: attachmentsPayload,
        }
      );
      setChannelMessages((prev) => {
        if (prev.some((m) => m.id === resp.id)) return prev;
        return [...prev, resp];
      });
    } catch (err) {
      console.error('Failed to send channel message', err);
    }
  };

  // Handlers for Personal Communities
  const handleCreateCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommunityName.trim()) return;
    setActionError('');

    try {
      await api.post('/api/v1/communities/', {
        name: newCommunityName.trim(),
        description: newCommunityDesc.trim(),
        is_private: newCommunityPrivate,
      });
      setIsCreateCommunityOpen(false);
      setNewCommunityName('');
      setNewCommunityDesc('');
      await loadCommunities();
    } catch (err: any) {
      setActionError(err.message || 'Failed to create community.');
    }
  };

  const handleJoinCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinInviteCode.trim()) return;
    setActionError('');

    try {
      await api.post('/api/v1/communities/join/', {
        invite_code: joinInviteCode.trim(),
      });
      setIsJoinCommunityOpen(false);
      setJoinInviteCode('');
      await loadCommunities();
    } catch (err: any) {
      setActionError(err.message || 'Invalid invite code or community not found.');
    }
  };

  const openAddMemberModal = async (team: Team) => {
    setSelectedTeamForMember(team);
    setActionError('');
    setIsAddMemberOpen(true);
    try {
      const resp = await api.get<any>(`/api/v1/memberships/directory/?organization_id=${activeOrganization?.id}`);
      const list = Array.isArray(resp) ? resp : (resp.results || []);
      setDirectoryEmployees(list);
    } catch (err) {
      console.error('Failed to load directory', err);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamForMember || !selectedEmpId) return;
    setActionError('');

    try {
      await api.post(`/api/v1/teams/${selectedTeamForMember.id}/members/`, {
        employee_id: selectedEmpId,
        role: memberRole,
      });

      setIsAddMemberOpen(false);
      setSelectedEmpId('');
      await loadTeams();
    } catch (err: any) {
      setActionError(err.message || 'Permission denied: you cannot add members to this team.');
    }
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const isPersonal = activeContext === 'personal';

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Left Teams & Channels Tree View */}
      <div style={{
        width: '320px',
        borderRight: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header with Actions */}
        <div style={{
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
              {isPersonal ? 'Communities' : 'Teams'}
            </h2>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {isPersonal ? 'Personal Workspace' : activeOrganization?.display_name || 'Organization'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {isPersonal ? (
              <>
                <button
                  onClick={() => setIsJoinCommunityOpen(true)}
                  className="teams-btn teams-btn-secondary"
                  style={{ padding: '6px 8px', fontSize: '12px' }}
                  title="Join Community with Code"
                >
                  <LogIn size={14} />
                  <span>Join</span>
                </button>
                <button
                  onClick={() => setIsCreateCommunityOpen(true)}
                  className="teams-btn teams-btn-primary"
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                  title="Create Personal Community"
                >
                  <Plus size={14} />
                  <span>Create</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleOpenCreateTeam}
                className="teams-btn teams-btn-primary"
                style={{ padding: '6px 10px', fontSize: '12px' }}
                title={canCreateTeam ? 'Create a new team' : 'Creating teams is restricted by organization policy'}
              >
                <Plus size={16} />
                <span>Create Team</span>
              </button>
            )}
          </div>
        </div>

        {/* Action Error Alert */}
        {actionError && (
          <div style={{
            margin: '8px 12px 0',
            backgroundColor: '#fde7e9',
            color: '#c4314b',
            border: '1px solid #f8d7da',
            padding: '8px 10px',
            borderRadius: '4px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6px',
            lineHeight: '1.4'
          }}>
            <AlertCircle size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>{actionError}</div>
            <button
              onClick={() => setActionError('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c4314b', fontSize: '14px', padding: 0 }}
            >
              &times;
            </button>
          </div>
        )}

        {/* Tree List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
          {loadingTeams ? (
            <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
              {isPersonal ? 'Loading communities...' : 'Loading organization teams...'}
            </div>
          ) : isPersonal ? (
            // Personal Communities
            communities.length === 0 ? (
              <div style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                <Globe size={40} style={{ opacity: 0.4, margin: '0 auto 10px', display: 'block' }} />
                <p style={{ margin: 0, fontWeight: 600 }}>No communities yet</p>
                <p style={{ marginTop: '4px', fontSize: '12px' }}>
                  Create your own community or join one using an invite code.
                </p>
              </div>
            ) : (
              communities.map((comm) => {
                const isExpanded = expandedTeams[comm.id] ?? true;
                const channels = channelsByTeam[comm.id] || [];

                return (
                  <div key={comm.id} style={{ marginBottom: '12px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      fontWeight: 600,
                      fontSize: '14px',
                    }}>
                      <div
                        onClick={() => toggleTeamExpand(comm.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}
                      >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <Users size={16} color="var(--brand-light)" />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {comm.name}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {comm.invite_code && (
                          <button
                            onClick={() => copyInviteCode(comm.invite_code)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: copiedCode === comm.invite_code ? '#237b4b' : 'var(--text-secondary)',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                            title={`Copy Invite Code: ${comm.invite_code}`}
                          >
                            {copiedCode === comm.invite_code ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenCreateChannel(comm.id, comm.name)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '4px',
                          }}
                          title="Add Channel"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                        {channels.map((ch) => {
                          const isSelected = activeChannel?.id === ch.id;
                          return (
                            <div
                              key={ch.id}
                              onClick={() => setActiveChannel(ch)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '6px 10px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                                color: isSelected ? 'var(--brand-light)' : 'var(--text-primary)',
                                fontWeight: isSelected ? 600 : 400,
                                fontSize: '13px',
                              }}
                            >
                              {ch.channel_type === 'private' ? <Lock size={14} /> : <Hash size={14} />}
                              <span>{ch.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )
          ) : (
            // Work Teams
            teams.length === 0 ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                No teams found in this organization. Click "Create Team" to create the first one!
              </div>
            ) : (
              teams.map((team) => {
                const isExpanded = expandedTeams[team.id] ?? true;
                const channels = channelsByTeam[team.id] || [];

                return (
                  <div key={team.id} style={{ marginBottom: '12px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      fontWeight: 600,
                      fontSize: '14px',
                    }}>
                      <div
                        onClick={() => toggleTeamExpand(team.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}
                      >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <Users size={16} color="var(--brand-light)" />
                        <span>{team.name}</span>
                      </div>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        {canManageTeam(team) && (
                          <>
                            <button
                              onClick={() => handleOpenEditTeam(team)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: '4px',
                              }}
                              title="Edit team"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => setDeleteTeamModal(team)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--danger)',
                                cursor: 'pointer',
                                padding: '4px',
                              }}
                              title="Delete team"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleOpenAddMember(team)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '4px',
                          }}
                          title={canAddMemberToTeam(team) ? 'Add member to team' : 'You do not have permission to add members'}
                        >
                          <UserPlus size={14} />
                        </button>
                        <button
                          onClick={() => handleOpenCreateChannel(team.id, team.name)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '4px',
                          }}
                          title={canCreateChannelInTeam(team) ? 'Add channel' : 'You do not have permission to create channels'}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                        {channels.map((ch) => {
                          const isSelected = activeChannel?.id === ch.id;
                          return (
                            <div
                              key={ch.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '6px 10px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                                color: isSelected ? 'var(--brand-light)' : 'var(--text-primary)',
                                fontWeight: isSelected ? 600 : 400,
                                fontSize: '13px',
                              }}
                            >
                              <div
                                onClick={() => setActiveChannel(ch)}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}
                              >
                                {ch.channel_type === 'private' ? <Lock size={14} /> : <Hash size={14} />}
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {ch.name}
                                </span>
                              </div>

                              {canManageTeam(team) && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenEditChannel(team.id, ch);
                                    }}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: 'var(--text-muted)',
                                      cursor: 'pointer',
                                      padding: '2px',
                                    }}
                                    title="Edit channel"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  {ch.name.toLowerCase() !== 'general' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteChannelModal({ teamId: team.id, channel: ch });
                                      }}
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--danger)',
                                        cursor: 'pointer',
                                        padding: '2px',
                                      }}
                                      title="Delete channel"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )
          )}
        </div>
      </div>

      {/* Right Channel Message View */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
        {activeChannel ? (
          <>
            {/* Channel Header */}
            <div style={{
              height: '52px',
              padding: '0 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-secondary)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Hash size={18} color="var(--brand-light)" />
                <span style={{ fontWeight: 600, fontSize: '15px' }}>{activeChannel.name}</span>
                {activeChannel.description && (
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '12px' }}>
                    {activeChannel.description}
                  </span>
                )}
              </div>
            </div>

            {/* Messages Feed */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {channelMessages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', marginTop: '40px' }}>
                  Welcome to the beginning of the #{activeChannel.name} channel! Send a message, voice note, or file to get started.
                </div>
              ) : (
                channelMessages.map((msg) => (
                  <div key={msg.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--brand-primary)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      fontSize: '13px',
                      flexShrink: 0,
                    }}>
                      {(msg.sender_name || 'U').slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>{msg.sender_name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{
                        backgroundColor: 'var(--bg-secondary)',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        fontSize: '14px',
                        lineHeight: '1.4',
                        maxWidth: '85%',
                      }}>
                        {msg.content && <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</div>}

                        {/* Attachments rendering in channel message */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div style={{ marginTop: msg.content ? '8px' : '0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {msg.attachments.map((att: any, idx: number) => {
                              const filename = att.filename || att.name || 'Attachment';
                              const isVoice = att.is_voice || (att.mime_type || '').startsWith('audio/');
                              const isImg = (att.mime_type || att.type || '').startsWith('image/');
                              const dlUrl = att.download_url || att.url || `/api/v1/files/${att.id}/download/`;

                              if (isVoice) {
                                return (
                                  <div
                                    key={idx}
                                    style={{
                                      backgroundColor: 'var(--bg-hover)',
                                      borderRadius: '6px',
                                      padding: '8px 12px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '4px',
                                      minWidth: '240px',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}>
                                      <Mic size={14} color="var(--brand-primary)" />
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
                                    backgroundColor: 'var(--bg-hover)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '6px',
                                    padding: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                  }}
                                >
                                  {isImg ? <ImageIcon size={22} /> : <FileText size={22} />}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {filename}
                                    </div>
                                  </div>
                                  <a
                                    href={dlUrl}
                                    download={filename}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="teams-btn teams-btn-secondary"
                                    style={{ padding: '4px 8px', fontSize: '11px', height: '26px' }}
                                  >
                                    <Download size={13} />
                                    <span>Download</span>
                                  </a>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Channel Composer */}
            <div style={{
              padding: '12px 20px',
              backgroundColor: 'var(--bg-secondary)',
              borderTop: '1px solid var(--border-color)',
              position: 'relative',
            }}>
              {/* Staged files tray */}
              {stagedFiles.length > 0 && (
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                  marginBottom: '8px',
                  padding: '6px 8px',
                  backgroundColor: 'var(--bg-hover)',
                  borderRadius: '4px',
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
                      <FileText size={13} color="var(--brand-primary)" />
                      <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.filename}
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

              {/* Emoji Picker Popover */}
              {showEmojiPicker && (
                <div
                  ref={emojiPickerRef}
                  style={{
                    position: 'absolute',
                    bottom: '60px',
                    left: '60px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    padding: '10px',
                    width: '240px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(6, 1fr)',
                    gap: '4px',
                    zIndex: 100,
                  }}
                >
                  {COMMON_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        setMessageInput((prev) => prev + emoji);
                      }}
                      style={{
                        fontSize: '18px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {/* Voice recording live bar OR input form */}
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
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--danger)', display: 'inline-block' }} />
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
                <form onSubmit={handleSendChannelMessage} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    multiple
                    onChange={handleFileUpload}
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingFile}
                    className="teams-btn teams-btn-secondary"
                    style={{ height: '38px', width: '38px', padding: 0, justifyContent: 'center' }}
                    title="Attach file"
                  >
                    <Paperclip size={17} color="var(--brand-primary)" />
                  </button>

                  <button
                    type="button"
                    onClick={startAudioRecording}
                    disabled={isUploadingFile}
                    className="teams-btn teams-btn-secondary"
                    style={{ height: '38px', width: '38px', padding: 0, justifyContent: 'center' }}
                    title="Record voice message"
                  >
                    <Mic size={17} color="var(--brand-primary)" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="teams-btn teams-btn-secondary"
                    style={{ height: '38px', width: '38px', padding: 0, justifyContent: 'center' }}
                    title="Insert emoji"
                  >
                    <Smile size={17} color="var(--brand-primary)" />
                  </button>

                  <input
                    type="text"
                    placeholder={`Message #${activeChannel.name}`}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    className="teams-input"
                    style={{ flex: 1, height: '38px' }}
                  />

                  <button
                    type="submit"
                    disabled={(!messageInput.trim() && stagedFiles.length === 0) || isUploadingFile}
                    className="teams-btn teams-btn-primary"
                    style={{ height: '38px', padding: '0 16px', gap: '6px' }}
                  >
                    <Send size={15} />
                    <span>Send</span>
                  </button>
                </form>
              )}
            </div>
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
            <Users size={48} style={{ opacity: 0.4, marginBottom: '16px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>
              {isPersonal ? 'Select a community channel' : 'Select a team channel'}
            </h3>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>Choose a channel on the left to start collaborating</p>
          </div>
        )}
      </div>

      {/* Modal: Create Team (Work) */}
      {isCreateTeamOpen && (
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
            width: '420px',
            padding: '24px',
            border: '1px solid var(--border-color)',
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '14px' }}>Create a Team</h3>
            <form onSubmit={handleCreateTeam} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Team Name *</label>
                <input
                  type="text"
                  required
                  className="teams-input"
                  placeholder="e.g. Engineering, Sales, Marketing"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Description</label>
                <input
                  type="text"
                  className="teams-input"
                  placeholder="What is this team about?"
                  value={newTeamDesc}
                  onChange={(e) => setNewTeamDesc(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Visibility</label>
                <select
                  className="teams-input"
                  value={newTeamVisibility}
                  onChange={(e) => setNewTeamVisibility(e.target.value as any)}
                >
                  <option value="public">Public (Anyone in organization can view and join)</option>
                  <option value="private">Private (Only invited members can access)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateTeamOpen(false)}
                  className="teams-btn teams-btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="teams-btn teams-btn-primary">
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Personal Community */}
      {isCreateCommunityOpen && (
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
            width: '420px',
            padding: '24px',
            border: '1px solid var(--border-color)',
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '14px' }}>Create Community</h3>
            <form onSubmit={handleCreateCommunity} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Community Name *</label>
                <input
                  type="text"
                  required
                  className="teams-input"
                  placeholder="e.g. Study Group, Book Club, Gamers"
                  value={newCommunityName}
                  onChange={(e) => setNewCommunityName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Description</label>
                <input
                  type="text"
                  className="teams-input"
                  placeholder="What is this community for?"
                  value={newCommunityDesc}
                  onChange={(e) => setNewCommunityDesc(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="commPrivate"
                  checked={newCommunityPrivate}
                  onChange={(e) => setNewCommunityPrivate(e.target.checked)}
                />
                <label htmlFor="commPrivate" style={{ fontSize: '13px', cursor: 'pointer' }}>
                  Private Community (Invite-only via invite code)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateCommunityOpen(false)}
                  className="teams-btn teams-btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="teams-btn teams-btn-primary">
                  Create Community
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Join Community with Invite Code */}
      {isJoinCommunityOpen && (
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
            width: '400px',
            padding: '24px',
            border: '1px solid var(--border-color)',
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '14px' }}>Join Community</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Enter the 16-character invite code provided by the community owner.
            </p>
            <form onSubmit={handleJoinCommunity} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Invite Code *</label>
                <input
                  type="text"
                  required
                  className="teams-input"
                  placeholder="e.g. 4a8b9f12c3e56789"
                  value={joinInviteCode}
                  onChange={(e) => setJoinInviteCode(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsJoinCommunityOpen(false)}
                  className="teams-btn teams-btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="teams-btn teams-btn-primary">
                  Join
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Channel (Work or Personal) */}
      {isCreateChannelOpen && (
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
            width: '400px',
            padding: '24px',
            border: '1px solid var(--border-color)',
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '14px' }}>Create Channel</h3>
            <form onSubmit={handleCreateChannel} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Channel Name *</label>
                <input
                  type="text"
                  required
                  className="teams-input"
                  placeholder="e.g. general, announcements, random"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Privacy Type</label>
                <select
                  className="teams-input"
                  value={newChannelType}
                  onChange={(e) => setNewChannelType(e.target.value as any)}
                >
                  <option value="standard">Standard (Accessible to all members)</option>
                  <option value="private">Private (Only specific members)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateChannelOpen(false)}
                  className="teams-btn teams-btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="teams-btn teams-btn-primary">
                  Create Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Member to Team (Work) */}
      {isAddMemberOpen && selectedTeamForMember && (
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
            width: '440px',
            padding: '24px',
            border: '1px solid var(--border-color)',
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>
              Add member to {selectedTeamForMember.name}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Select an authorized organization colleague from your corporate directory.
            </p>

            <form onSubmit={handleAddMember} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Employee *</label>
                <select
                  required
                  className="teams-input"
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                >
                  <option value="">-- Select an employee --</option>
                  {directoryEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.email}) - {emp.job_title || 'Employee'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Team Role</label>
                <select
                  className="teams-input"
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value as any)}
                >
                  <option value="member">Member</option>
                  <option value="owner">Team Owner</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="teams-btn teams-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedEmpId}
                  className="teams-btn teams-btn-primary"
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Team */}
      {editTeamModal && (
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
            width: '420px',
            padding: '24px',
            border: '1px solid var(--border-color)',
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '14px' }}>Edit Team: {editTeamModal.name}</h3>
            {managementError && (
              <div style={{ color: 'var(--danger)', fontSize: '12px', marginBottom: '10px' }}>
                {managementError}
              </div>
            )}
            <form onSubmit={handleSaveEditTeam} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Team Name *</label>
                <input
                  type="text"
                  required
                  className="teams-input"
                  value={editTeamName}
                  onChange={(e) => setEditTeamName(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Description</label>
                <input
                  type="text"
                  className="teams-input"
                  value={editTeamDesc}
                  onChange={(e) => setEditTeamDesc(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditTeamModal(null)}
                  className="teams-btn teams-btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="teams-btn teams-btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Team Confirmation */}
      {deleteTeamModal && (
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
            width: '420px',
            padding: '24px',
            border: '1px solid var(--border-color)',
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>Delete Team</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '18px' }}>
              Are you sure you want to delete the team <strong>"{deleteTeamModal.name}"</strong>? All channels and files in this team will be archived.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeleteTeamModal(null)}
                className="teams-btn teams-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTeam}
                className="teams-btn teams-btn-primary"
                style={{ backgroundColor: 'var(--danger)', borderColor: 'var(--danger)' }}
              >
                Delete Team
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Channel */}
      {editChannelModal && (
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
            width: '400px',
            padding: '24px',
            border: '1px solid var(--border-color)',
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '14px' }}>Edit Channel: #{editChannelModal.channel.name}</h3>
            {managementError && (
              <div style={{ color: 'var(--danger)', fontSize: '12px', marginBottom: '10px' }}>
                {managementError}
              </div>
            )}
            <form onSubmit={handleSaveEditChannel} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Channel Name *</label>
                <input
                  type="text"
                  required
                  className="teams-input"
                  value={editChannelName}
                  onChange={(e) => setEditChannelName(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Description</label>
                <input
                  type="text"
                  className="teams-input"
                  value={editChannelDesc}
                  onChange={(e) => setEditChannelDesc(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditChannelModal(null)}
                  className="teams-btn teams-btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="teams-btn teams-btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Channel Confirmation */}
      {deleteChannelModal && (
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
            width: '400px',
            padding: '24px',
            border: '1px solid var(--border-color)',
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>Delete Channel</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '18px' }}>
              Are you sure you want to delete the channel <strong>#{deleteChannelModal.channel.name}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeleteChannelModal(null)}
                className="teams-btn teams-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteChannel}
                className="teams-btn teams-btn-primary"
                style={{ backgroundColor: 'var(--danger)', borderColor: 'var(--danger)' }}
              >
                Delete Channel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
