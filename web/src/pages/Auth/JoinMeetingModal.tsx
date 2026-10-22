import React, { useState } from 'react';
import { api } from '../../services/api';
import { Video, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface JoinMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const JoinMeetingModal: React.FC<JoinMeetingModalProps> = ({ isOpen, onClose }) => {
  const [meetingId, setMeetingId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingId.trim()) {
      setError('Meeting link or ID is required.');
      return;
    }
    if (!guestName.trim()) {
      setError('Please provide your name.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const resp = await api.post<any>('/api/v1/meetings/join/', {
        meeting_id: meetingId.trim(),
        guest_name: guestName.trim(),
        passcode: passcode.trim(),
      });

      // Navigate to call room with credentials in state
      navigate('/call-room', {
        state: {
          meetingToken: resp.token,
          livekitUrl: resp.livekit_url,
          roomName: resp.room_name,
          title: resp.title,
          displayName: resp.display_name,
        },
      });
    } catch (err: any) {
      setError(err.message || 'Failed to join meeting.');
    } finally {
      setLoading(false);
    }
  };

  return (
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
        backgroundColor: '#ffffff',
        color: '#242424',
        borderRadius: '8px',
        width: '420px',
        padding: '24px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
        position: 'relative',
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#616161',
          }}
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            backgroundColor: 'var(--brand-primary)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Video size={18} />
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Join a Meeting</h2>
        </div>

        {error && (
          <div style={{
            backgroundColor: '#fde7e9',
            color: '#c4314b',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '13px',
            marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
              Meeting Link or ID *
            </label>
            <input
              type="text"
              className="teams-input"
              style={{ backgroundColor: '#f9f9f9', color: '#242424', borderColor: '#d1d1d1' }}
              placeholder="e.g. room_a1b2c3d4 or UUID"
              value={meetingId}
              onChange={(e) => setMeetingId(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
              Your Name *
            </label>
            <input
              type="text"
              className="teams-input"
              style={{ backgroundColor: '#f9f9f9', color: '#242424', borderColor: '#d1d1d1' }}
              placeholder="How should others see you?"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
              Passcode (if required)
            </label>
            <input
              type="password"
              className="teams-input"
              style={{ backgroundColor: '#f9f9f9', color: '#242424', borderColor: '#d1d1d1' }}
              placeholder="Passcode"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              className="teams-btn"
              style={{ backgroundColor: '#ebebeb', color: '#242424' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="teams-btn teams-btn-primary"
            >
              {loading ? 'Connecting...' : 'Join Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
