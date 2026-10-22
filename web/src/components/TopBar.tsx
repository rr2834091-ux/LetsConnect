import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../state/AuthContext';
import {
  Search,
  ChevronDown,
  Building,
  User as UserIcon,
  LogOut,
  Moon,
  Sun,
  Check,
  Video
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

  const { theme, toggleTheme } = useTheme();

  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [isPresenceOpen, setIsPresenceOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const orgRef = useRef<HTMLDivElement>(null);
  const presenceRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

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
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const presenceOptions = [
    { key: 'available', label: 'Available', color: '#237b4b' },
    { key: 'busy', label: 'Busy', color: '#c4314b' },
    { key: 'dnd', label: 'Do not disturb', color: '#c4314b' },
    { key: 'away', label: 'Away', color: '#f2994a' },
    { key: 'be_right_back', label: 'Be right back', color: '#f2994a' },
    { key: 'offline', label: 'Appear offline', color: '#8a8a8a' },
  ];

  const currentPresence = presenceOptions.find((p) => p.key === presenceStatus) || presenceOptions[0];

  const getInitials = (name?: string) => {
    if (!name) return 'LC';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  };

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
      <div style={{ flex: '0 1 480px', position: 'relative' }}>
        <Search
          size={16}
          style={{
            position: 'absolute',
            left: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
          }}
        />
        <input
          type="text"
          placeholder="Search messages, channels, files, and meetings (Ctrl+E)"
          className="teams-input"
          style={{
            paddingLeft: '34px',
            height: '32px',
            backgroundColor: 'var(--bg-primary)',
            borderRadius: '4px',
          }}
        />
      </div>

      {/* Right Controls: Theme Toggle, Presence & Profile Menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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

        {/* Presence Selector */}
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
              width: '180px',
              padding: '4px 0',
              zIndex: 100,
            }}>
              {presenceOptions.map((opt) => (
                <div
                  key={opt.key}
                  onClick={() => {
                    updatePresence(opt.key);
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
                </div>
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
    </header>
  );
};
