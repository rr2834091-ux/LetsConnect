import React, { useState, useEffect } from 'react';
import { useAuth } from '../../state/AuthContext';
import { api } from '../../services/api';
import { Phone, Video, Search, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const CallsPage: React.FC = () => {
  const { activeOrganization } = useAuth();
  const [colleagues, setColleagues] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (activeOrganization) {
      api.get<any>(`/api/v1/memberships/directory/?organization_id=${activeOrganization.id}`)
        .then((resp) => setColleagues(resp.results || resp))
        .catch((err) => console.error(err));
    }
  }, [activeOrganization]);

  const startCall = async (colleague: any, isVideo = true) => {
    try {
      const resp = await api.post<any>('/api/v1/meetings/', {
        title: `${isVideo ? 'Video' : 'Audio'} Call with ${colleague.full_name}`,
        organization: activeOrganization?.id,
        is_instant: true,
        attendees: [colleague.user_id || colleague.id],
      });

      const joinResp = await api.post<any>('/api/v1/meetings/join/', {
        meeting_id: resp.room_name,
      });

      navigate('/call-room', {
        state: {
          meetingId: resp.id,
          meetingToken: joinResp.token,
          livekitUrl: joinResp.livekit_url,
          roomName: joinResp.room_name,
          title: resp.title,
          displayName: joinResp.display_name,
          isHost: true,
          initialVideo: isVideo,
        },
      });
    } catch (err) {
      console.error('Failed to start call', err);
    }
  };

  const filtered = colleagues.filter((c) =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.job_title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ flex: 1, padding: '28px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Calls & Contacts</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Instant audio and video calling with organization team members
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div style={{ maxWidth: '400px', marginBottom: '20px', position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Search by name, email, or role..."
          className="teams-input"
          style={{ paddingLeft: '34px' }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Directory List */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
      }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
            No contacts found in this organization.
          </div>
        ) : (
          filtered.map((emp) => (
            <div
              key={emp.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--brand-primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: '13px',
                }}>
                  {emp.full_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{emp.full_name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {emp.email} • {emp.job_title || 'Team Member'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => startCall(emp, false)}
                  className="teams-btn teams-btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  <Phone size={14} />
                  <span>Audio Call</span>
                </button>
                <button
                  onClick={() => startCall(emp, true)}
                  className="teams-btn teams-btn-primary"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  <Video size={14} />
                  <span>Video Call</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
