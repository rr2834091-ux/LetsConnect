import React, { useState, useEffect } from 'react';
import { useAuth } from '../../state/AuthContext';
import { useTheme } from '../../state/ThemeContext';
import { api } from '../../services/api';
import {
  Settings,
  User as UserIcon,
  Moon,
  Sun,
  Shield,
  Bell,
  Building,
  LogOut,
  Check,
  AlertTriangle,
  X
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user, activeContext, activeOrganization, organizations, switchOrganization, logout, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [displayName, setDisplayName] = useState(user?.full_name || user?.username || '');
  const [bio, setBio] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Account Deactivation / Sign Off State
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [deactivatePassword, setDeactivatePassword] = useState('');
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [deactivateSuccessMessage, setDeactivateSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    // Fetch personal profile details
    api.get<any>('/api/v1/auth/profile/')
      .then((data) => {
        if (data.personal_profile) {
          setDisplayName(data.personal_profile.display_name || user?.full_name || '');
          setBio(data.personal_profile.bio || '');
        }
      })
      .catch(() => {});
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSuccess('');
    setProfileError('');

    try {
      await api.patch('/api/v1/auth/profile/', {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        display_name: displayName.trim(),
        bio: bio.trim(),
      });
      await refreshProfile();
      setProfileSuccess('Profile updated successfully.');
      setIsEditingProfile(false);
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeactivateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deactivatePassword) {
      setDeactivateError('Current password is required.');
      return;
    }
    setDeactivateLoading(true);
    setDeactivateError(null);
    try {
      const resp = await api.post<any>('/api/v1/auth/deactivate/', {
        password: deactivatePassword,
      });
      const farewellMsg = resp.detail || "Thank you for being part of Let's Connect. We wish you a great career ahead.";
      setDeactivateSuccessMessage(farewellMsg);
      setTimeout(() => {
        logout();
      }, 3500);
    } catch (err: any) {
      setDeactivateError(err.message || 'Incorrect password or deactivation failed.');
      setDeactivateLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, padding: '32px', overflowY: 'auto', maxWidth: '800px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Settings</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          Manage your account profile, theme preferences, and collaboration workspace
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Profile Card */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          padding: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserIcon size={18} color="var(--brand-light)" />
              <span>{activeContext === 'personal' ? 'Personal Account Profile' : 'Profile Details'}</span>
            </h2>
            <button
              onClick={() => setIsEditingProfile(!isEditingProfile)}
              className="teams-btn teams-btn-secondary"
              style={{ fontSize: '12px', padding: '4px 12px' }}
            >
              {isEditingProfile ? 'Cancel' : 'Edit Profile'}
            </button>
          </div>

          {profileSuccess && (
            <div style={{ backgroundColor: 'rgba(35, 123, 75, 0.15)', color: '#237b4b', padding: '8px 12px', borderRadius: '4px', fontSize: '13px', marginBottom: '14px' }}>
              {profileSuccess}
            </div>
          )}

          {profileError && (
            <div style={{ backgroundColor: '#fde7e9', color: '#c4314b', padding: '8px 12px', borderRadius: '4px', fontSize: '13px', marginBottom: '14px' }}>
              {profileError}
            </div>
          )}

          {isEditingProfile ? (
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>First Name</label>
                  <input
                    type="text"
                    className="teams-input"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Last Name</label>
                  <input
                    type="text"
                    className="teams-input"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Display Name</label>
                <input
                  type="text"
                  className="teams-input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Bio / Status Message</label>
                <input
                  type="text"
                  className="teams-input"
                  placeholder="e.g. Collaborating on LetsConnect"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="teams-btn teams-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="teams-btn teams-btn-primary"
                >
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Display Name
                </label>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>
                  {displayName || user?.full_name || user?.username}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Email Address
                </label>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>
                  {user?.email}
                </div>
              </div>

              {bio && (
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Bio
                  </label>
                  <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                    {bio}
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Active Context
                </label>
                <div style={{
                  display: 'inline-block',
                  fontSize: '12px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  backgroundColor: 'rgba(91, 95, 199, 0.15)',
                  color: 'var(--brand-light)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                }}>
                  {activeContext} Workspace
                </div>
              </div>

              {activeContext === 'work' && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Current Organization
                  </label>
                  <div style={{ fontSize: '14px', fontWeight: 500 }}>
                    {activeOrganization?.display_name || 'None'}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Appearance Card */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          padding: '20px',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Moon size={18} color="var(--brand-light)" />
            <span>Appearance & Theme</span>
          </h2>

          <div style={{ display: 'flex', gap: '16px' }}>
            {/* Dark Mode Option */}
            <div
              onClick={() => setTheme('dark')}
              style={{
                flex: 1,
                border: theme === 'dark' ? '2px solid var(--brand-primary)' : '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '16px',
                cursor: 'pointer',
                backgroundColor: '#1f1f1f',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Moon size={20} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>Dark Theme (Default)</div>
                  <div style={{ fontSize: '12px', color: '#adadad' }}>Classic Teams Dark Interface</div>
                </div>
              </div>
              {theme === 'dark' && <Check size={18} color="var(--brand-light)" />}
            </div>

            {/* Light Mode Option */}
            <div
              onClick={() => setTheme('light')}
              style={{
                flex: 1,
                border: theme === 'light' ? '2px solid var(--brand-primary)' : '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '16px',
                cursor: 'pointer',
                backgroundColor: '#ffffff',
                color: '#242424',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sun size={20} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>Light Theme</div>
                  <div style={{ fontSize: '12px', color: '#616161' }}>Clean High-Contrast View</div>
                </div>
              </div>
              {theme === 'light' && <Check size={18} color="var(--brand-primary)" />}
            </div>
          </div>
        </div>

        {/* Workspace & Organizations Card */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          padding: '20px',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building size={18} color="var(--brand-light)" />
            <span>Multi-Tenant Organizations</span>
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {organizations.map((org) => {
              const isActive = activeOrganization?.id === org.id && activeContext === 'work';
              return (
                <div
                  key={org.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: isActive ? 'var(--bg-hover)' : 'transparent',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{org.display_name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {org.legal_name} • Domain: {org.company_domain || 'N/A'}
                    </div>
                  </div>

                  {isActive ? (
                    <span style={{ fontSize: '12px', color: 'var(--brand-light)', fontWeight: 600 }}>Active</span>
                  ) : (
                    <button
                      onClick={() => switchOrganization(org.id)}
                      className="teams-btn teams-btn-secondary"
                      style={{ fontSize: '12px', padding: '4px 10px' }}
                    >
                      Switch To
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Notifications & Sound */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          padding: '20px',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={18} color="var(--brand-light)" />
            <span>Notification Preferences</span>
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>Desktop & In-App Notifications</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Receive alerts for new messages, mentions, and calls</div>
              </div>
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>Sound Alerts</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Play sound for incoming calls and notifications</div>
              </div>
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
              />
            </label>
          </div>
        </div>

        {/* Session / Logout */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>Sign Out</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Sign out of your current session on this device</div>
          </div>
          <button
            onClick={logout}
            className="teams-btn teams-btn-secondary"
            style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Danger Zone: Sign Off & Account Deactivation */}
        <div style={{
          backgroundColor: 'rgba(196, 49, 75, 0.05)',
          borderRadius: '8px',
          border: '1px solid rgba(196, 49, 75, 0.3)',
          padding: '20px',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: '#c4314b' }}>
            <AlertTriangle size={18} />
            <span>Sign Off & Deactivate Account</span>
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
            Deactivating your account will sign you off from LetsConnect across all devices, revoke active authentication tokens, and mark your employee profile as inactive. Your conversation history and past contributions will be preserved.
          </p>
          <button
            onClick={() => {
              setDeactivatePassword('');
              setDeactivateError(null);
              setDeactivateSuccessMessage(null);
              setIsDeactivateModalOpen(true);
            }}
            className="teams-btn teams-btn-danger"
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            Sign Off & Deactivate Account
          </button>
        </div>
      </div>

      {/* Account Deactivation Modal */}
      {isDeactivateModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            width: '460px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(196, 49, 75, 0.1)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#c4314b', fontWeight: 600, fontSize: '15px' }}>
                <AlertTriangle size={18} />
                <span>Confirm Account Deactivation</span>
              </div>
              {!deactivateSuccessMessage && (
                <button
                  onClick={() => setIsDeactivateModalOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              )}
            </div>

            <div style={{ padding: '20px' }}>
              {deactivateSuccessMessage ? (
                <div style={{
                  padding: '16px',
                  backgroundColor: 'rgba(35, 123, 75, 0.15)',
                  border: '1px solid #237b4b',
                  borderRadius: '6px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#237b4b', marginBottom: '8px' }}>
                    {deactivateSuccessMessage}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Signing off and redirecting to login...
                  </div>
                </div>
              ) : (
                <form onSubmit={handleDeactivateAccount} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0, lineHeight: '1.5' }}>
                    To confirm the permanent sign-off and deactivation of your <strong>{user?.email}</strong> account, please enter your current password below.
                  </p>

                  {deactivateError && (
                    <div style={{
                      padding: '8px 12px',
                      backgroundColor: 'rgba(196, 49, 75, 0.15)',
                      border: '1px solid var(--danger)',
                      borderRadius: '4px',
                      color: '#ff6b6b',
                      fontSize: '13px',
                    }}>
                      {deactivateError}
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Current Password <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                      type="password"
                      className="teams-input"
                      placeholder="Enter your current password"
                      value={deactivatePassword}
                      onChange={(e) => setDeactivatePassword(e.target.value)}
                      disabled={deactivateLoading}
                      required
                      autoFocus
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setIsDeactivateModalOpen(false)}
                      className="teams-btn teams-btn-secondary"
                      disabled={deactivateLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={deactivateLoading || !deactivatePassword.trim()}
                      className="teams-btn teams-btn-danger"
                      style={{ padding: '8px 16px' }}
                    >
                      {deactivateLoading ? 'Deactivating...' : 'Confirm Sign Off & Deactivate'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
