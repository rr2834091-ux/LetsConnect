import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Organization, OrgPermissions, Presence } from '../types';
import { api } from '../services/api';
import { wsClient } from '../services/websocket';

interface AuthContextType {
  user: User | null;
  token: string | null;
  activeContext: 'work' | 'personal';
  activeOrganization: Organization | null;
  organizations: Organization[];
  permissions: OrgPermissions | null;
  presenceStatus: string;
  customStatus: string;
  isLoading: boolean;
  login: (data: any) => Promise<void>;
  logout: () => void;
  switchContext: (context: 'work' | 'personal', orgId?: string) => Promise<void>;
  switchOrganization: (orgId: string) => Promise<void>;
  updatePresence: (status: string, customMessage?: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('lc_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('lc_auth_token'));
  const [activeContext, setActiveContext] = useState<'work' | 'personal'>(
    (localStorage.getItem('lc_active_context') as any) || 'work'
  );
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(() => {
    try {
      const saved = localStorage.getItem('lc_active_organization');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [organizations, setOrganizations] = useState<Organization[]>(() => {
    try {
      const saved = localStorage.getItem('lc_organizations');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [permissions, setPermissions] = useState<OrgPermissions | null>(() => {
    try {
      const saved = localStorage.getItem('lc_permissions');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [presenceStatus, setPresenceStatus] = useState<string>('available');
  const [customStatus, setCustomStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(!token);

  const fetchPermissions = async (orgId: string) => {
    try {
      const perms = await api.get<OrgPermissions>(`/api/v1/organizations/${orgId}/permissions/`);
      setPermissions(perms);
      localStorage.setItem('lc_permissions', JSON.stringify(perms));
    } catch {
      setPermissions(null);
      localStorage.removeItem('lc_permissions');
    }
  };

  const refreshProfile = async () => {
    const currentToken = localStorage.getItem('lc_auth_token');
    if (!currentToken) {
      setIsLoading(false);
      return;
    }
    try {
      const data = await api.get<any>('/api/v1/auth/profile/');
      setUser(data.user);
      localStorage.setItem('lc_user', JSON.stringify(data.user));
      setActiveContext(data.active_context);
      localStorage.setItem('lc_active_context', data.active_context);
      setOrganizations(data.organizations || []);
      localStorage.setItem('lc_organizations', JSON.stringify(data.organizations || []));

      if (data.active_organization) {
        setActiveOrganization(data.active_organization);
        localStorage.setItem('lc_active_organization', JSON.stringify(data.active_organization));
        localStorage.setItem('lc_active_org_id', data.active_organization.id);
        await fetchPermissions(data.active_organization.id);
      } else if (data.organizations && data.organizations.length > 0 && data.active_context === 'work') {
        const defaultOrg = data.organizations[0];
        setActiveOrganization(defaultOrg);
        localStorage.setItem('lc_active_organization', JSON.stringify(defaultOrg));
        localStorage.setItem('lc_active_org_id', defaultOrg.id);
        await fetchPermissions(defaultOrg.id);
      } else {
        setActiveOrganization(null);
        localStorage.removeItem('lc_active_organization');
        localStorage.removeItem('lc_active_org_id');
      }

      if (data.presence) {
        setPresenceStatus(data.presence.status);
        setCustomStatus(data.presence.custom_status || '');
      }

      // Connect real-time WebSocket
      wsClient.connect();
    } catch (err) {
      console.error('Failed to restore user session', err);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();

    const handleUnauthorized = () => logout();
    window.addEventListener('lc_unauthorized', handleUnauthorized);
    return () => window.removeEventListener('lc_unauthorized', handleUnauthorized);
  }, []);

  const login = async (response: any) => {
    localStorage.setItem('lc_auth_token', response.token);
    localStorage.setItem('lc_user', JSON.stringify(response.user));
    setToken(response.token);
    setUser(response.user);
    setActiveContext(response.active_context);
    localStorage.setItem('lc_active_context', response.active_context);
    setOrganizations(response.organizations || []);
    localStorage.setItem('lc_organizations', JSON.stringify(response.organizations || []));

    if (response.active_organization) {
      setActiveOrganization(response.active_organization);
      localStorage.setItem('lc_active_organization', JSON.stringify(response.active_organization));
      localStorage.setItem('lc_active_org_id', response.active_organization.id);
      await fetchPermissions(response.active_organization.id);
    }

    wsClient.connect();
  };

  const logout = () => {
    localStorage.removeItem('lc_auth_token');
    localStorage.removeItem('lc_user');
    localStorage.removeItem('lc_active_org_id');
    localStorage.removeItem('lc_active_organization');
    localStorage.removeItem('lc_organizations');
    localStorage.removeItem('lc_permissions');
    setToken(null);
    setUser(null);
    setActiveOrganization(null);
    setOrganizations([]);
    setPermissions(null);
    wsClient.disconnect();
  };

  const switchContext = async (context: 'work' | 'personal', orgId?: string) => {
    try {
      if (context === 'work' && organizations.length === 0) {
        alert("This account is not associated with any company organization. You can collaborate freely in your Personal Workspace.");
        return;
      }
      const payload: any = { context };
      if (orgId) {
        payload.organization_id = orgId;
      } else if (context === 'work' && organizations.length > 0) {
        payload.organization_id = organizations[0].id;
      }

      const resp = await api.post<any>('/api/v1/auth/switch-context/', payload);
      setActiveContext(resp.active_context);
      localStorage.setItem('lc_active_context', resp.active_context);

      if (resp.active_organization) {
        setActiveOrganization(resp.active_organization);
        localStorage.setItem('lc_active_org_id', resp.active_organization.id);
        await fetchPermissions(resp.active_organization.id);
      } else {
        setActiveOrganization(null);
        localStorage.removeItem('lc_active_org_id');
        setPermissions(null);
      }
    } catch (err) {
      console.error('Failed to switch context', err);
    }
  };

  const switchOrganization = async (orgId: string) => {
    await switchContext('work', orgId);
  };

  const updatePresence = async (status: string, customMessage?: string) => {
    try {
      const resp = await api.post<Presence>('/api/v1/presence/status/', {
        status,
        custom_message: customMessage || '',
      });
      setPresenceStatus(resp.status);
      setCustomStatus(resp.custom_status_message);

      // Broadcast via WebSocket
      wsClient.send('presence_status', {
        status: resp.status,
        custom_message: resp.custom_status_message,
        organization_id: activeOrganization?.id,
      });
    } catch (err) {
      console.error('Failed to update presence', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        activeContext,
        activeOrganization,
        organizations,
        permissions,
        presenceStatus,
        customStatus,
        isLoading,
        login,
        logout,
        switchContext,
        switchOrganization,
        updatePresence,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
