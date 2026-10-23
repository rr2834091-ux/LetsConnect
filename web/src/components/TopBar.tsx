import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';
import { api } from '../services/api';
import { MemberProfileModal } from './common/MemberProfileModal';
import {
  Search,
  ChevronDown,
  Building,
  User as UserIcon,
  LogOut,
  Moon,
  Sun,
  Check,
  Video,
  MessageSquare,
  Hash,
  Calendar,
  Sparkles,
  Edit3,
  X,
  Loader2
} from 'lucide-react';
import { useTheme } from '../state/ThemeContext';

export const TopBar: React.FC = () => {
  const {
    user,
    activeContext,
    activeOrganization,
    organizations,
    presenceStatus,
    customStatus,
    updatePresence,
    switchContext,
    switchOrganization,
    logout,
  } = useAuth();

  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [isPresenceOpen, setIsPresenceOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    people: any[];
    messages: any[];
    channels: any[];
    meetings: any[];
  }>({
    people: [],
    messages: [],
    channels: [],
    meetings: [],
  });

  // Profile Modal State
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | number | null>(null);

  // Custom Status Modal / Popover State
  const [isCustomStatusOpen, setIsCustomStatusOpen] = useState(false);
  const [customStatusInput, setCustomStatusInput] = useState('');

  const orgRef = useRef<HTMLDivElement>(null);
  const presenceRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (orgRef.current && !orgRef.current.contains(e.target as Node)) {
        setIsOrgDropdownOpen(false);
      }
      if (presenceRef.current && !presenceRef.current.contains(e.target as Node)) {
        setIsPresenceOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync custom status input when auth context changes
  useEffect(() => {
    setCustomStatusInput(customStatus || '');
  }, [customStatus]);

  // Debounced search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ people: [], messages: [], channels: [], meetings: [] });
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const orgId = activeOrganization?.id || '';
        const res = await api.get<{ results: any }>(
          `/api/v1/search/?q=${encodeURIComponent(searchQuery.trim())}&organization_id=${orgId}`
        );
        setSearchResults(res.results || { people: [], messages: [], channels: [], meetings: [] });
        setIsSearchOpen(true);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery, activeOrganization?.id]);

  // Requirement: Remove "Be right back" from presence statuses
  const presenceOptions = [
    { key: 'available', label: 'Available', color: '#237b4b' },
    { key: 'busy', label: 'Busy', color: '#c4314b' },
    { key: 'dnd', label: 'Do not disturb', color: '#c4314b' },
    { key: 'away', label: 'Away', color: '#f2994a' },
    { key: 'offline', label: 'Appear offline', color: '#8a8a8a' },
  ];

  const currentPresence = presenceOptions.find((p) => p.key === presenceStatus) || presenceOptions[0];

  const getInitials = (name?: string) => {
    if (!name) return 'LC';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  };

  const handleSaveCustomStatus = async () => {
    await updatePresence(presenceStatus, customStatusInput.trim());
    setIsCustomStatusOpen(false);
  };

  const handleClearCustomStatus = async () => {
    setCustomStatusInput('');
    await updatePresence(presenceStatus, '');
    setIsCustomStatusOpen(false);
  };

  const totalResultsCount =
    searchResults.people.length +
    searchResults.messages.length +
    searchResults.channels.length +
    searchResults.meetings.length;

  return (
    <header style={{
      height: 'var(--topbar-height)',
      backgroundColor: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      userSelect: 'none',
      zIndex: 20,
    }}>
      {/* Brand & Organization */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            backgroundColor: 'var(--brand-primary)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: '14px',
          }}>
            LC
          </div>
          <span style={{ fontWeight: 600, fontSize: '15px', letterSpacing: '-0.2px' }}>
            LetsConnect
          </span>
        </div>

        {/* Dynamic Organization Switcher */}
        {activeContext === 'work' && (
          <div ref={orgRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
              className="teams-btn teams-btn-secondary"
              style={{
                padding: '4px 10px',
                fontSize: '13px',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
              }}
            >
              <Building size={14} />
              <span>{activeOrganization?.display_name || 'Select Organization'}</span>
              <ChevronDown size={14} />
            </button>

            {isOrgDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
                width: '260px',
                padding: '6px 0',
                zIndex: 100,
              }}>
                <div style={{ padding: '6px 12px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  YOUR ORGANIZATIONS ({organizations.length})
                </div>
                {organizations.map((org) => {
                  const isSelected = activeOrganization?.id === org.id;
                  return (
                    <div
                      key={org.id}
                      onClick={() => {
                        switchOrganization(org.id);
                        setIsOrgDropdownOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                        fontSize: '13px',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: isSelected ? 600 : 400 }}>{org.display_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{org.company_domain || org.legal_name}</div>
                      </div>
                      {isSelected && <Check size={14} color="var(--brand-light)" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeContext === 'personal' && (
          <span style={{
            fontSize: '12px',
            backgroundColor: 'var(--bg-hover)',
            color: 'var(--text-secondary)',
            padding: '2px 8px',
            borderRadius: '12px',
          }}>
            Personal Workspace
          </span>
        )}
      </div>

      {/* Global Search Bar */}
      <div ref={searchRef} style={{ flex: '0 1 500px', position: 'relative' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => {
              if (searchQuery.trim()) setIsSearchOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setIsSearchOpen(false);
            }}
            placeholder="Search people, messages, channels, and meetings..."
            className="teams-input"
            style={{
              width: '100%',
              paddingLeft: '34px',
              paddingRight: searchQuery ? '30px' : '10px',
              height: '32px',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: '4px',
              fontSize: '13px',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setIsSearchOpen(false);
              }}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '2px',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Global Search Dropdown */}
        {isSearchOpen && searchQuery.trim().length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              boxShadow: '0 10px 28px rgba(0,0,0,0.35)',
              maxHeight: '440px',
              overflowY: 'auto',
              zIndex: 150,
              padding: '6px 0',
            }}
          >
            {isSearching ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '20px',
                  color: 'var(--text-secondary)',
                  fontSize: '13px',
                }}
              >
                <Loader2 size={16} className="animate-spin" />
                <span>Searching across workspace...</span>
              </div>
            ) : totalResultsCount === 0 ? (
              <div
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                }}
              >
                No matches found for <strong style={{ color: 'var(--text-primary)' }}>"{searchQuery}"</strong>
              </div>
            ) : (
              <div>
                {/* People Results */}
                {searchResults.people.length > 0 && (
                  <div>
                    <div
                      style={{
                        padding: '6px 12px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-primary)',
                      }}
                    >
                      People ({searchResults.people.length})
                    </div>
                    {searchResults.people.map((person) => (
                      <div
                        key={person.id}
                        onClick={() => {
                          setSelectedMemberId(person.user_id || person.id);
                          setProfileModalOpen(true);
                          setIsSearchOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <div
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--brand-primary)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          {getInitials(person.full_name)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {person.full_name}
                          </div>
                          <div
                            style={{
                              fontSize: '11px',
                              color: 'var(--text-secondary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {person.job_title} • {person.department || person.email}
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--bg-hover)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          View Profile
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Messages Results */}
                {searchResults.messages.length > 0 && (
                  <div>
                    <div
                      style={{
                        padding: '6px 12px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-primary)',
                      }}
                    >
                      Messages ({searchResults.messages.length})
                    </div>
                    {searchResults.messages.map((msg) => (
                      <div
                        key={msg.id}
                        onClick={() => {
                          navigate(`/chat?conversation=${msg.conversation_id}&message=${msg.id}`);
                          setIsSearchOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <MessageSquare size={16} color="var(--brand-light)" style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {msg.content}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            From {msg.sender_name}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Channels Results */}
                {searchResults.channels.length > 0 && (
                  <div>
                    <div
                      style={{
                        padding: '6px 12px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-primary)',
                      }}
                    >
                      Channels ({searchResults.channels.length})
                    </div>
                    {searchResults.channels.map((chan) => (
                      <div
                        key={chan.id}
                        onClick={() => {
                          navigate(`/teams?team=${chan.team_id}&channel=${chan.id}`);
                          setIsSearchOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <Hash size={16} color="var(--brand-light)" style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            #{chan.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            Team: {chan.team_name}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Meetings Results */}
                {searchResults.meetings.length > 0 && (
                  <div>
                    <div
                      style={{
                        padding: '6px 12px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-primary)',
                      }}
                    >
                      Meetings ({searchResults.meetings.length})
                    </div>
                    {searchResults.meetings.map((meeting) => (
                      <div
                        key={meeting.id}
                        onClick={() => {
                          navigate(`/meetings?meeting=${meeting.id}`);
                          setIsSearchOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <Calendar size={16} color="var(--brand-light)" style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {meeting.title}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {meeting.start_time ? new Date(meeting.start_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Scheduled'}
                          </div>
                        </div>
                        {meeting.is_live && (
                          <span
                            style={{
                              fontSize: '10px',
                              backgroundColor: 'var(--danger)',
                              color: '#fff',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 600,
                            }}
                          >
                            LIVE
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Controls: Theme Toggle, Custom Status, Presence & Profile Menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Active Custom Status Pill */}
        {customStatus && (
          <div
            onClick={() => setIsCustomStatusOpen(true)}
            title="Click to edit custom status"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: 'var(--bg-hover)',
              padding: '3px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              maxWidth: '160px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <Sparkles size={12} color="var(--brand-light)" />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{customStatus}</span>
          </div>
        )}

        <button
          onClick={toggleTheme}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
          }}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Presence Selector & Custom Status Trigger */}
        <div ref={presenceRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setIsPresenceOpen(!isPresenceOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'transparent',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '16px',
              padding: '3px 8px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: currentPresence.color,
              }}
            />
            <span>{currentPresence.label}</span>
          </button>

          {isPresenceOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
              width: '190px',
              padding: '4px 0',
              zIndex: 100,
            }}>
              {presenceOptions.map((opt) => (
                <div
                  key={opt.key}
                  onClick={() => {
                    updatePresence(opt.key, customStatus);
                    setIsPresenceOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    backgroundColor: presenceStatus === opt.key ? 'var(--bg-hover)' : 'transparent',
                  }}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: opt.color }} />
                  <span>{opt.label}</span>
                </div>
              ))}

              {/* Custom Status Option */}
              <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />
              <div
                onClick={() => {
                  setIsPresenceOpen(false);
                  setIsCustomStatusOpen(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  color: 'var(--brand-light)',
                }}
              >
                <Sparkles size={14} />
                <span>{customStatus ? 'Edit status message' : 'Set status message'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Profile Avatar & Account Switcher */}
        <div ref={profileRef} style={{ position: 'relative' }}>
          <div
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'var(--brand-primary)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            {getInitials(user?.full_name)}
          </div>

          {isProfileOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              width: '280px',
              padding: '16px',
              zIndex: 100,
            }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--brand-primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: '16px',
                }}>
                  {getInitials(user?.full_name)}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {user?.full_name || user?.username}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {user?.email}
                  </div>
                  {customStatus && (
                    <div style={{ fontSize: '11px', color: 'var(--brand-light)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Sparkles size={11} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {customStatus}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Message Edit Button */}
              <div style={{ marginBottom: '12px' }}>
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    setIsCustomStatusOpen(true);
                  }}
                  className="teams-btn teams-btn-secondary"
                  style={{ width: '100%', fontSize: '12px', padding: '6px 10px', justifyContent: 'center' }}
                >
                  <Edit3 size={13} />
                  <span>{customStatus ? 'Edit status message' : 'Set status message'}</span>
                </button>
              </div>

              {/* Account Context Switcher */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>
                  ACCOUNT CONTEXT
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button
                    onClick={() => {
                      switchContext('work');
                      setIsProfileOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '4px',
                      background: activeContext === 'work' ? 'var(--bg-hover)' : 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      width: '100%',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Building size={16} />
                      <span>Work Account</span>
                    </div>
                    {activeContext === 'work' && <Check size={14} color="var(--brand-light)" />}
                  </button>

                  <button
                    onClick={() => {
                      switchContext('personal');
                      setIsProfileOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '4px',
                      background: activeContext === 'personal' ? 'var(--bg-hover)' : 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      width: '100%',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <UserIcon size={16} />
                      <span>Personal Account</span>
                    </div>
                    {activeContext === 'personal' && <Check size={14} color="var(--brand-light)" />}
                  </button>
                </div>
              </div>

              {/* Sign Out */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                <button
                  onClick={logout}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--danger)',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  <LogOut size={16} />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom Status Modal */}
      {isCustomStatusOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              width: '420px',
              maxWidth: '90vw',
              padding: '20px',
              boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="var(--brand-light)" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Set status message</h3>
              </div>
              <button
                onClick={() => setIsCustomStatusOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 0, marginBottom: '12px' }}>
              What's your status? Let colleagues know what you're working on or when you're free.
            </p>

            <textarea
              value={customStatusInput}
              onChange={(e) => setCustomStatusInput(e.target.value)}
              placeholder="e.g., In design review until 3 PM, Focus mode, Working remotely today"
              maxLength={140}
              rows={3}
              className="teams-input"
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '13px',
                borderRadius: '4px',
                resize: 'none',
                backgroundColor: 'var(--bg-primary)',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span>{140 - customStatusInput.length} characters remaining</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              {customStatus && (
                <button
                  onClick={handleClearCustomStatus}
                  className="teams-btn teams-btn-secondary"
                  style={{ color: 'var(--danger)', marginRight: 'auto' }}
                >
                  Clear status
                </button>
              )}
              <button
                onClick={() => setIsCustomStatusOpen(false)}
                className="teams-btn teams-btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCustomStatus}
                className="teams-btn teams-btn-primary"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Profile Modal from Search */}
      <MemberProfileModal
        isOpen={profileModalOpen}
        onClose={() => {
          setProfileModalOpen(false);
          setSelectedMemberId(null);
        }}
        memberId={selectedMemberId}
      />
    </header>
  );
};
