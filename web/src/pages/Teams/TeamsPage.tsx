import React, { useState, useEffect } from 'react';
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
  LogIn
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

  // Permission evaluations for enterprise work teams
  const canCreateTeam = Boolean(permissions?.is_org_admin || permissions?.can_create_teams);

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
    if (!newTeamName.trim() || !activeOrganization) return;
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
    if (!newChannelName.trim() || !targetTeamId) return;
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

  const handleSendChannelMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeChannel?.conversation_id) return;

    const text = messageInput.trim();
    setMessageInput('');

    try {
      const resp = await api.post<Message>(
        `/api/v1/messaging/conversations/${activeChannel.conversation_id}/messages/`,
        { content: text }
      );
      setChannelMessages((prev) => {
        if (prev.some((m) => m.id === resp.id)) return prev;
        return [...prev, resp];
      });
    } catch (err) {
      console.error('Failed to send channel message', err);
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
                  Welcome to the beginning of the #{activeChannel.name} channel!
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
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>{msg.sender_name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{
                        backgroundColor: 'var(--bg-secondary)',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '14px',
                        lineHeight: '1.4',
                        maxWidth: '85%',
                      }}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Channel Composer */}
            <form onSubmit={handleSendChannelMessage} style={{
              padding: '16px 20px',
              backgroundColor: 'var(--bg-secondary)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              gap: '12px',
            }}>
              <input
                type="text"
                placeholder={`Message #${activeChannel.name}`}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                className="teams-input"
                style={{ flex: 1, height: '40px' }}
              />
              <button
                type="submit"
                disabled={!messageInput.trim()}
                className="teams-btn teams-btn-primary"
                style={{ height: '40px', padding: '0 16px' }}
              >
                <Send size={16} />
                <span>Send</span>
              </button>
            </form>
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
    </div>
  );
};
