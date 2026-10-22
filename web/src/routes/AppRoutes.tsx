import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';
import { AppLayout } from '../layouts/AppLayout';
import { Login } from '../pages/Auth/Login';
import { ChatPage } from '../pages/Chat/ChatPage';
import { TeamsPage } from '../pages/Teams/TeamsPage';
import { MeetingsPage } from '../pages/Meetings/MeetingsPage';
import { CallRoom } from '../pages/Meetings/CallRoom';
import { ActivityPage } from '../pages/Activity/ActivityPage';
import { CallsPage } from '../pages/Calls/CallsPage';
import { SettingsPage } from '../pages/Settings/SettingsPage';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-secondary)',
        fontSize: '14px',
      }}>
        Loading LetsConnect workspace...
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isLoading } = useAuth();
  if (isLoading) return null;
  if (token) return <Navigate to="/chat" replace />;
  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      {/* Standalone LiveKit Call Room (supports authenticated and guest attendees) */}
      <Route path="/call-room" element={<CallRoom />} />

      {/* Authenticated Workspace Layout */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/chat" replace />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="teams" element={<TeamsPage />} />
        <Route path="meetings" element={<MeetingsPage />} />
        <Route path="calls" element={<CallsPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
};
