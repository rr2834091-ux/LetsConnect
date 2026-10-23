import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Mail,
  Phone,
  Briefcase,
  Building,
  Shield,
  MessageSquare,
  Video,
  PhoneCall,
  Clock,
  Sparkles
} from 'lucide-react';

interface MemberProfileData {
  user_id: number | null;
  employee_id: string | null;
  corporate_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  job_title: string;
  department: string;
  role: string;
  presence_status: string;
  custom_status: string;
  bio: string;
}

interface MemberProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: string | number | null;
  initialName?: string;
  initialEmail?: string;
  onStartDirectChat?: (userId: number, name: string) => void;
}

export const MemberProfileModal: React.FC<MemberProfileModalProps> = ({
  isOpen,
  onClose,
  memberId,
  initialName,
  initialEmail,
  onStartDirectChat,
}) => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<MemberProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !memberId) {
      setProfile(null);
      return;
    }

    setLoading(true);
    setError(null);

    api.get<MemberProfileData>(`/api/v1/memberships/profile/${memberId}/`)
      .then((data) => {
        setProfile(data);
      })
      .catch((err) => {
        console.warn('Failed to fetch profile', err);
        setError(err.message || 'Could not load full profile.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, memberId]);

  if (!isOpen) return null;

  const getPresenceColor = (status?: string): string => {
    switch (status) {
      case 'available':
        return '#237b4b'; // Green
      case 'busy':
      case 'dnd':
        return '#c4314b'; // Red
      case 'away':
        return '#f38518'; // Orange
      case 'offline':
      default:
        return '#8a8a8a'; // Grey
    }
  };

  const getPresenceLabel = (status?: string): string => {
    switch (status) {
      case 'available':
        return 'Available';
      case 'busy':
        return 'Busy';
      case 'dnd':
        return 'Do Not Disturb';
      case 'away':
        return 'Away';
      case 'offline':
        return 'Offline';
      default:
        return 'Available';
    }
  };

  const displayName = profile?.full_name || initialName || 'Team Member';
  const displayEmail = profile?.email || initialEmail || '';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('') || 'U';

  const handleStartChat = () => {
    if (onStartDirectChat && profile?.user_id) {
      onStartDirectChat(profile.user_id, displayName);
      onClose();
    } else if (profile?.user_id) {
      navigate('/chat');
      onClose();
    }
  };

  const handleStartCall = async (isVideo = true) => {
    onClose();
    navigate('/calls');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        backdropFilter: 'blur(3px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '440px',
          backgroundColor: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          borderRadius: '12px',
          boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner with Close button */}
        <div style={{
          height: '76px',
          backgroundColor: 'var(--brand-primary)',
          position: 'relative',
          padding: '12px',
        }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'rgba(0,0,0,0.25)',
              border: 'none',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Avatar and Primary Header */}
        <div style={{ padding: '0 24px 20px', position: 'relative' }}>
          {/* Avatar floating above banner */}
          <div style={{
            position: 'relative',
            marginTop: '-44px',
            marginBottom: '12px',
            width: '84px',
            height: '84px',
          }}>
            <div style={{
              width: '84px',
              height: '84px',
              borderRadius: '50%',
              backgroundColor: '#5b5fc7',
              color: '#ffffff',
              border: '4px solid var(--bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '30px',
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}>
              {initials}
            </div>
            {/* Presence dot */}
            <div style={{
              position: 'absolute',
              bottom: '4px',
              right: '4px',
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              backgroundColor: getPresenceColor(profile?.presence_status),
              border: '3px solid var(--bg-secondary)',
            }} />
          </div>

          {/* Name & Title */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>
                {displayName}
              </h2>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px', fontWeight: 500 }}>
              {profile?.job_title || 'Team Member'} • {profile?.department || 'Department'}
            </div>
            {profile?.corporate_id && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                ID: {profile.corporate_id}
              </div>
            )}
          </div>

          {/* Availability / Status Pill */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'var(--bg-tertiary)',
            padding: '4px 10px',
            borderRadius: '14px',
            fontSize: '12px',
            fontWeight: 500,
            marginTop: '10px',
            border: '1px solid var(--border-color)',
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: getPresenceColor(profile?.presence_status),
            }} />
            <span>{getPresenceLabel(profile?.presence_status)}</span>
          </div>

          {/* Custom Status Note */}
          {profile?.custom_status && (
            <div style={{
              marginTop: '10px',
              padding: '8px 12px',
              backgroundColor: 'rgba(91, 95, 199, 0.1)',
              borderRadius: '6px',
              borderLeft: '3px solid var(--brand-primary)',
              fontSize: '12px',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <Sparkles size={14} color="var(--brand-primary)" />
              <span style={{ fontStyle: 'italic' }}>"{profile.custom_status}"</span>
            </div>
          )}

          {/* Action Buttons: Message, Audio Call, Video Call */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button
              onClick={handleStartChat}
              className="teams-btn teams-btn-primary"
              style={{ flex: 1, padding: '8px 12px', fontSize: '13px', borderRadius: '6px' }}
            >
              <MessageSquare size={16} />
              <span>Message</span>
            </button>
            <button
              onClick={() => handleStartCall(false)}
              className="teams-btn teams-btn-secondary"
              style={{ flex: 1, padding: '8px 12px', fontSize: '13px', borderRadius: '6px' }}
            >
              <PhoneCall size={16} />
              <span>Audio</span>
            </button>
            <button
              onClick={() => handleStartCall(true)}
              className="teams-btn teams-btn-secondary"
              style={{ flex: 1, padding: '8px 12px', fontSize: '13px', borderRadius: '6px' }}
            >
              <Video size={16} />
              <span>Video</span>
            </button>
          </div>

          <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '18px 0 14px' }} />

          {/* Contact Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            {displayEmail && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Mail size={16} color="var(--text-secondary)" />
                <span style={{ color: 'var(--text-secondary)' }}>Email:</span>
                <span style={{ fontWeight: 500 }}>{displayEmail}</span>
              </div>
            )}
            {profile?.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Phone size={16} color="var(--text-secondary)" />
                <span style={{ color: 'var(--text-secondary)' }}>Phone:</span>
                <span style={{ fontWeight: 500 }}>{profile.phone}</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Briefcase size={16} color="var(--text-secondary)" />
              <span style={{ color: 'var(--text-secondary)' }}>Role:</span>
              <span style={{ fontWeight: 500 }}>{profile?.role || 'Member'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Building size={16} color="var(--text-secondary)" />
              <span style={{ color: 'var(--text-secondary)' }}>Department:</span>
              <span style={{ fontWeight: 500 }}>{profile?.department || 'General'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
