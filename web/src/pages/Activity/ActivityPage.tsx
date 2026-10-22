import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../state/AuthContext';
import { api } from '../../services/api';
import { wsClient } from '../../services/websocket';
import { Notification } from '../../types';
import {
  Bell,
  MessageSquare,
  Users,
  Video,
  FileText,
  Info,
  CheckCircle,
  Check,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

export const ActivityPage: React.FC = () => {
  const { activeOrganization } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'mentions'>('all');

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const orgParam = activeOrganization ? `?organization_id=${activeOrganization.id}` : '';
      const resp = await api.get<any>(`/api/v1/notifications/${orgParam}`);
      const list = Array.isArray(resp)
        ? resp
        : (resp && Array.isArray(resp.results) ? resp.results : []);
      setNotifications(list);
    } catch (err: any) {
      console.error('Failed to load notifications', err);
      setError(err?.message || 'Failed to load notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [activeOrganization]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Real-time WebSocket notifications subscription
  useEffect(() => {
    const unbind = wsClient.on('new_notification', (data: any) => {
      if (data?.notification) {
        setNotifications((prev) => [data.notification, ...prev.filter((n) => n.id !== data.notification.id)]);
      }
    });

    return () => {
      unbind();
    };
  }, []);

  const markAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.post(`/api/v1/notifications/${id}/read/`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.post('/api/v1/notifications/read-all/');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Failed to mark all read', err);
    }
  };

  const handleNotificationClick = async (item: Notification) => {
    if (!item.is_read) {
      await markAsRead(item.id);
    }

    if (item.data?.link) {
      navigate(item.data.link);
    } else if (item.data?.meeting_id) {
      navigate(`/meetings/${item.data.meeting_id}`);
    } else if (item.data?.conversation_id) {
      navigate('/chat');
    } else if (item.notification_type === 'message' || item.notification_type === 'mention') {
      navigate('/chat');
    } else if (item.notification_type === 'meeting_invite') {
      navigate('/meetings');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
      case 'mention':
        return <MessageSquare size={18} color="#5b5fc7" />;
      case 'team_invite':
        return <Users size={18} color="#237b4b" />;
      case 'meeting_invite':
        return <Video size={18} color="#f2994a" />;
      case 'file_share':
        return <FileText size={18} color="#0078d4" />;
      default:
        return <Info size={18} color="#8a8a8a" />;
    }
  };

  const filteredNotifications = notifications.filter((item) => {
    if (activeTab === 'unread') return !item.is_read;
    if (activeTab === 'mentions') return item.notification_type === 'mention';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div style={{ flex: 1, padding: '28px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>Activity & Notifications</h1>
            {unreadCount > 0 && (
              <span style={{
                backgroundColor: 'var(--brand-primary)',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '10px'
              }}>
                {unreadCount} new
              </span>
            )}
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
            Stay updated with mentions, messages, meetings, and team events
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => loadNotifications()}
            className="teams-btn teams-btn-secondary"
            title="Refresh feed"
            style={{ padding: '6px 12px', fontSize: '13px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="teams-btn teams-btn-secondary"
            style={{ padding: '6px 14px', fontSize: '13px', opacity: unreadCount === 0 ? 0.6 : 1 }}
          >
            <Check size={16} />
            <span>Mark all read</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveTab('all')}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '13px',
            fontWeight: activeTab === 'all' ? 600 : 400,
            color: activeTab === 'all' ? 'var(--brand-primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'all' ? '2px solid var(--brand-primary)' : '2px solid transparent',
            padding: '6px 12px',
            cursor: 'pointer',
          }}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setActiveTab('unread')}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '13px',
            fontWeight: activeTab === 'unread' ? 600 : 400,
            color: activeTab === 'unread' ? 'var(--brand-primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'unread' ? '2px solid var(--brand-primary)' : '2px solid transparent',
            padding: '6px 12px',
            cursor: 'pointer',
          }}
        >
          Unread ({unreadCount})
        </button>
        <button
          onClick={() => setActiveTab('mentions')}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '13px',
            fontWeight: activeTab === 'mentions' ? 600 : 400,
            color: activeTab === 'mentions' ? 'var(--brand-primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'mentions' ? '2px solid var(--brand-primary)' : '2px solid transparent',
            padding: '6px 12px',
            cursor: 'pointer',
          }}
        >
          Mentions ({notifications.filter((n) => n.notification_type === 'mention').length})
        </button>
      </div>

      {/* Feed Container */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        minHeight: '200px'
      }}>
        {loading && notifications.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px', display: 'block', opacity: 0.6 }} />
            Loading activity feed...
          </div>
        ) : error ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <AlertCircle size={40} color="#d83b01" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Could not load activity feed</h3>
            <p style={{ fontSize: '13px', marginTop: '4px', color: 'var(--text-secondary)' }}>{error}</p>
            <button
              onClick={() => loadNotifications()}
              className="teams-btn teams-btn-primary"
              style={{ marginTop: '16px', padding: '6px 16px', fontSize: '13px' }}
            >
              Retry
            </button>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div style={{ padding: '64px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Bell size={48} style={{ opacity: 0.35, margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {activeTab === 'unread' ? 'No unread notifications' : activeTab === 'mentions' ? 'No mentions found' : 'All caught up!'}
            </h3>
            <p style={{ fontSize: '13px', marginTop: '4px', maxWidth: '360px', margin: '4px auto 0' }}>
              {activeTab === 'unread'
                ? 'You have reviewed all your updates.'
                : activeTab === 'mentions'
                ? 'When someone @mentions you in chats or channels, you will see it here.'
                : 'You have no recent activity. New messages, meeting invites, and file updates will show up here.'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((item) => (
            <div
              key={item.id}
              onClick={() => handleNotificationClick(item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: item.is_read ? 'transparent' : 'rgba(91, 95, 199, 0.08)',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
            >
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-tertiary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {getNotificationIcon(item.notification_type)}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                  <span style={{ fontWeight: item.is_read ? 500 : 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                    {item.title}
                  </span>
                  {!item.is_read && (
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--brand-primary)',
                      flexShrink: 0,
                    }} />
                  )}
                </div>
                <div style={{
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {item.body}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {!item.is_read && (
                  <button
                    onClick={(e) => markAsRead(item.id, e)}
                    className="teams-btn teams-btn-icon"
                    title="Mark as read"
                    style={{ padding: '4px' }}
                  >
                    <CheckCircle size={16} color="var(--brand-primary)" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
