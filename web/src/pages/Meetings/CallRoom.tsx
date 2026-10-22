import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Room, RoomEvent, VideoPresets, Track, RemoteParticipant, RemoteTrackPublication } from 'livekit-client';
import { useAuth } from '../../state/AuthContext';
import { api } from '../../services/api';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Monitor,
  PhoneOff,
  Users,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  Settings,
  ShieldCheck,
  UserPlus,
  Smile,
  Paperclip,
  Download,
  X,
  FileText,
  Upload
} from 'lucide-react';

type CallStage = 'prejoin' | 'connecting' | 'in_call' | 'error' | 'disconnected';

interface MeetingFile {
  id: string;
  filename: string;
  file_size: number;
  download_url: string;
  uploader: string;
  timestamp: string;
}

interface ReactionItem {
  id: string;
  emoji: string;
  sender: string;
}

export const CallRoom: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, activeOrganization } = useAuth();

  // Session parameters from router state or sessionStorage
  const navState = (location.state || {}) as {
    meetingId?: string;
    meetingToken?: string;
    livekitUrl?: string;
    roomName?: string;
    title?: string;
    displayName?: string;
    isHost?: boolean;
    initialVideo?: boolean;
  };

  const [meetingId, setMeetingId] = useState<string>(navState.meetingId || '');
  const [meetingToken, setMeetingToken] = useState<string>(navState.meetingToken || '');
  const [livekitUrl, setLivekitUrl] = useState<string>(navState.livekitUrl || import.meta.env.VITE_LIVEKIT_URL || '');
  const [roomName, setRoomName] = useState<string>(navState.roomName || searchParams.get('room') || '');
  const [meetingTitle, setMeetingTitle] = useState<string>(navState.title || 'LetsConnect Meeting');
  const [displayName, setDisplayName] = useState<string>(
    navState.displayName || (user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username : 'Participant')
  );
  const [isHost, setIsHost] = useState<boolean>(navState.isHost ?? false);

  // Call stage state
  const [stage, setStage] = useState<CallStage>('prejoin');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hardwareNotice, setHardwareNotice] = useState<string | null>(null);

  // Hardware states
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(navState.initialVideo !== undefined ? navState.initialVideo : true);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [participantsCount, setParticipantsCount] = useState<number>(1);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  // In-Call Features State
  const [isAddPeopleOpen, setIsAddPeopleOpen] = useState(false);
  const [directoryUsers, setDirectoryUsers] = useState<any[]>([]);
  const [addPeopleQuery, setAddPeopleQuery] = useState('');
  const [addPeopleSuccess, setAddPeopleSuccess] = useState('');

  const [isReactionPickerOpen, setIsReactionPickerOpen] = useState(false);
  const [activeReactions, setActiveReactions] = useState<ReactionItem[]>([]);

  const [isFilesDrawerOpen, setIsFilesDrawerOpen] = useState(false);
  const [meetingFiles, setMeetingFiles] = useState<MeetingFile[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [fileToast, setFileToast] = useState<string | null>(null);

  // Refs for Room and Media
  const roomRef = useRef<Room | null>(null);
  const isConnectingRef = useRef<boolean>(false);
  const isLeavingRef = useRef<boolean>(false);
  const prejoinStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // DOM Refs
  const prejoinVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideosRef = useRef<HTMLDivElement>(null);

  // Fallback: If token was not passed in state, try reading from sessionStorage
  useEffect(() => {
    if (!meetingToken) {
      try {
        const cached = sessionStorage.getItem('active_call_session');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.meetingToken && (!roomName || parsed.roomName === roomName)) {
            setMeetingId(parsed.meetingId || '');
            setMeetingToken(parsed.meetingToken);
            setLivekitUrl(parsed.livekitUrl || import.meta.env.VITE_LIVEKIT_URL);
            setRoomName(parsed.roomName || '');
            setMeetingTitle(parsed.title || 'LetsConnect Meeting');
            if (parsed.displayName) setDisplayName(parsed.displayName);
            if (parsed.isHost !== undefined) setIsHost(parsed.isHost);
          }
        }
      } catch (e) {
        console.warn('Failed to parse cached session', e);
      }
    }
  }, [meetingToken, roomName]);

  // Persist valid session to sessionStorage
  useEffect(() => {
    if (meetingToken && roomName) {
      sessionStorage.setItem('active_call_session', JSON.stringify({
        meetingId,
        meetingToken,
        livekitUrl,
        roomName,
        title: meetingTitle,
        displayName,
        isHost
      }));
    }
  }, [meetingId, meetingToken, livekitUrl, roomName, meetingTitle, displayName, isHost]);

  // Pre-join camera & microphone preview with device enumeration check
  useEffect(() => {
    let active = true;

    const startPrejoinPreview = async () => {
      if (stage !== 'prejoin') return;

      try {
        let hasVideoDevice = false;
        let hasAudioDevice = false;

        if (navigator.mediaDevices?.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          hasVideoDevice = devices.some((d) => d.kind === 'videoinput');
          hasAudioDevice = devices.some((d) => d.kind === 'audioinput');
        }

        if (!hasVideoDevice) {
          setIsVideoEnabled(false);
          setHardwareNotice('No webcam detected. Video disabled; joining in audio-only mode.');
        }

        const constraints: MediaStreamConstraints = {
          audio: true,
          video: (hasVideoDevice && isVideoEnabled) ? true : false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        prejoinStreamRef.current = stream;
        if (prejoinVideoRef.current && hasVideoDevice) {
          prejoinVideoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.warn('Pre-join camera/mic unavailable:', err.message);
        // Fallback: try audio-only
        try {
          setIsVideoEnabled(false);
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          if (!active) {
            audioStream.getTracks().forEach((t) => t.stop());
            return;
          }
          prejoinStreamRef.current = audioStream;
          setHardwareNotice('Camera not available or permitted. Audio connected.');
        } catch {
          setHardwareNotice('Microphone and camera permissions not granted. You can still join as an attendee.');
        }
      }
    };

    startPrejoinPreview();

    return () => {
      active = false;
      if (prejoinStreamRef.current) {
        prejoinStreamRef.current.getTracks().forEach((t) => t.stop());
        prejoinStreamRef.current = null;
      }
    };
  }, [stage]);

  // Toggle pre-join media preview states
  const togglePrejoinVideo = () => {
    const nextState = !isVideoEnabled;
    setIsVideoEnabled(nextState);
    if (prejoinStreamRef.current) {
      prejoinStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = nextState;
      });
    }
  };

  const togglePrejoinAudio = () => {
    const nextState = !isAudioEnabled;
    setIsAudioEnabled(nextState);
    if (prejoinStreamRef.current) {
      prejoinStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = nextState;
      });
    }
  };

  // Timer for active call duration
  useEffect(() => {
    let timer: any = null;
    if (stage === 'in_call') {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [stage]);

  // Helper to attach remote track
  const attachRemoteTrack = (track: Track, participant: RemoteParticipant) => {
    if (!remoteVideosRef.current) return;
    if (track.kind === Track.Kind.Video) {
      const existing = document.getElementById(`track-${participant.identity}`);
      if (existing) existing.remove();

      const el = track.attach();
      el.id = `track-${participant.identity}`;
      el.style.width = '100%';
      el.style.height = '100%';
      el.style.objectFit = 'cover';
      el.style.borderRadius = '8px';

      const wrapper = document.createElement('div');
      wrapper.id = `wrapper-${participant.identity}`;
      wrapper.style.width = '480px';
      wrapper.style.height = '340px';
      wrapper.style.backgroundColor = '#262626';
      wrapper.style.borderRadius = '10px';
      wrapper.style.position = 'relative';
      wrapper.style.overflow = 'hidden';
      wrapper.style.border = '1px solid #383838';

      const label = document.createElement('div');
      label.style.position = 'absolute';
      label.style.bottom = '12px';
      label.style.left = '12px';
      label.style.backgroundColor = 'rgba(0,0,0,0.6)';
      label.style.padding = '4px 10px';
      label.style.borderRadius = '4px';
      label.style.fontSize = '12px';
      label.style.color = '#ffffff';
      label.innerText = participant.name || participant.identity;

      wrapper.appendChild(el);
      wrapper.appendChild(label);
      remoteVideosRef.current.appendChild(wrapper);
    } else if (track.kind === Track.Kind.Audio) {
      const audioEl = track.attach();
      audioEl.id = `audio-${participant.identity}`;
      document.body.appendChild(audioEl);
    }
  };

  const detachRemoteTrack = (track: Track, participant: RemoteParticipant) => {
    track.detach().forEach((el) => el.remove());
    const wrapper = document.getElementById(`wrapper-${participant.identity}`);
    if (wrapper) wrapper.remove();
    const audioEl = document.getElementById(`audio-${participant.identity}`);
    if (audioEl) audioEl.remove();
  };

  // Main LiveKit Connect lifecycle
  const connectToLiveKit = async () => {
    if (isConnectingRef.current || roomRef.current) return;
    if (!meetingToken || !livekitUrl) {
      setErrorMessage('Missing meeting access credentials. Please rejoin from Calendar.');
      setStage('error');
      return;
    }

    if (prejoinStreamRef.current) {
      prejoinStreamRef.current.getTracks().forEach((t) => t.stop());
      prejoinStreamRef.current = null;
    }

    isConnectingRef.current = true;
    isLeavingRef.current = false;
    setStage('connecting');
    setErrorMessage(null);

    let roomInstance: Room | null = null;

    try {
      roomInstance = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
        },
      });

      roomRef.current = roomInstance;

      roomInstance.on(RoomEvent.Connected, () => {
        setStage('in_call');
        if (roomInstance) {
          setParticipantsCount(roomInstance.remoteParticipants.size + 1);
        }
      });

      roomInstance.on(RoomEvent.ParticipantConnected, () => {
        if (roomInstance) {
          setParticipantsCount(roomInstance.remoteParticipants.size + 1);
        }
      });

      roomInstance.on(RoomEvent.ParticipantDisconnected, (participant) => {
        if (roomInstance) {
          setParticipantsCount(roomInstance.remoteParticipants.size + 1);
        }
        const wrapper = document.getElementById(`wrapper-${participant.identity}`);
        if (wrapper) wrapper.remove();
      });

      roomInstance.on(RoomEvent.TrackSubscribed, (track: Track, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        attachRemoteTrack(track, participant);
      });

      roomInstance.on(RoomEvent.TrackUnsubscribed, (track: Track, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        detachRemoteTrack(track, participant);
      });

      // Handle real-time data packets (Reactions, Meeting Ended, Shared Files)
      roomInstance.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
        try {
          const text = new TextDecoder().decode(payload);
          const data = JSON.parse(text);

          if (data?.type === 'meeting_ended') {
            alert('The meeting host has ended this meeting.');
            leaveMeeting();
          } else if (data?.type === 'reaction') {
            const reactionId = `${Date.now()}_${Math.random()}`;
            setActiveReactions((prev) => [...prev, { id: reactionId, emoji: data.emoji, sender: data.sender || 'Participant' }]);
            setTimeout(() => {
              setActiveReactions((prev) => prev.filter((r) => r.id !== reactionId));
            }, 3000);
          } else if (data?.type === 'file_shared' && data.file) {
            setMeetingFiles((prev) => [data.file, ...prev.filter((f) => f.id !== data.file.id)]);
            setFileToast(`New file shared by ${data.file.uploader}: ${data.file.filename}`);
            setTimeout(() => setFileToast(null), 4000);
          }
        } catch (_) {}
      });

      roomInstance.on(RoomEvent.Disconnected, () => {
        if (isLeavingRef.current) {
          sessionStorage.removeItem('active_call_session');
          navigate('/meetings');
        } else {
          setStage('disconnected');
        }
      });

      // Connect to LiveKit Cloud Server
      await roomInstance.connect(livekitUrl, meetingToken);
      roomRef.current = roomInstance;

      // Publish local media
      try {
        if (isVideoEnabled) {
          await roomInstance.localParticipant.setCameraEnabled(true);
          const camPub = roomInstance.localParticipant.getTrackPublication(Track.Source.Camera);
          if (camPub?.track && localVideoRef.current) {
            camPub.track.attach(localVideoRef.current);
          }
        } else {
          await roomInstance.localParticipant.setCameraEnabled(false);
        }

        if (isAudioEnabled) {
          await roomInstance.localParticipant.setMicrophoneEnabled(true);
        } else {
          await roomInstance.localParticipant.setMicrophoneEnabled(false);
        }
      } catch (mediaErr: any) {
        console.warn('Initial media device publishing error:', mediaErr);
      }
    } catch (err: any) {
      console.error('Failed to connect to LiveKit room:', err);
      if (roomInstance) {
        try {
          roomInstance.disconnect();
        } catch (_) {}
      }
      roomRef.current = null;
      setErrorMessage(err.message || 'Unable to connect to the meeting room. Please check connection and try again.');
      setStage('error');
    } finally {
      isConnectingRef.current = false;
    }
  };

  // Safe teardown when leaving call
  const leaveMeeting = useCallback(() => {
    isLeavingRef.current = true;
    if (roomRef.current) {
      try {
        roomRef.current.disconnect();
      } catch (err) {
        console.warn('Error during room disconnect', err);
      }
      roomRef.current = null;
    }
    sessionStorage.removeItem('active_call_session');
    navigate('/meetings');
  }, [navigate]);

  const endMeetingForAll = async () => {
    if (!window.confirm('Are you sure you want to end this meeting for all participants?')) {
      return;
    }
    try {
      if (roomRef.current) {
        try {
          const payload = new TextEncoder().encode(JSON.stringify({ type: 'meeting_ended' }));
          await roomRef.current.localParticipant.publishData(payload, { reliable: true });
        } catch (e) {
          console.warn('Could not broadcast meeting_ended', e);
        }
      }
      if (meetingId) {
        await api.post(`/api/v1/meetings/${meetingId}/end/`);
      }
    } catch (err) {
      console.warn('Failed to end meeting on backend', err);
    } finally {
      leaveMeeting();
    }
  };

  // Component unmount cleanup
  useEffect(() => {
    return () => {
      if (prejoinStreamRef.current) {
        prejoinStreamRef.current.getTracks().forEach((t) => t.stop());
        prejoinStreamRef.current = null;
      }
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, []);

  // In-call toggles
  const toggleMic = async () => {
    if (!roomRef.current) return;
    const newState = !isAudioEnabled;
    try {
      await roomRef.current.localParticipant.setMicrophoneEnabled(newState);
      setIsAudioEnabled(newState);
    } catch (err) {
      console.error('Failed to toggle mic', err);
    }
  };

  const toggleCam = async () => {
    if (!roomRef.current) return;
    const newState = !isVideoEnabled;
    try {
      await roomRef.current.localParticipant.setCameraEnabled(newState);
      setIsVideoEnabled(newState);
      if (newState && localVideoRef.current) {
        const camPub = roomRef.current.localParticipant.getTrackPublication(Track.Source.Camera);
        if (camPub?.track) {
          camPub.track.attach(localVideoRef.current);
        }
      }
    } catch (err) {
      console.error('Failed to toggle camera', err);
    }
  };

  const toggleScreenShare = async () => {
    if (!roomRef.current) return;
    const newState = !isScreenSharing;
    try {
      await roomRef.current.localParticipant.setScreenShareEnabled(newState);
      setIsScreenSharing(newState);
    } catch (err) {
      console.warn('Screen share canceled or failed', err);
      setIsScreenSharing(false);
    }
  };

  // Broadcast Reaction
  const sendReaction = async (emoji: string) => {
    setIsReactionPickerOpen(false);
    if (!roomRef.current) return;
    try {
      const payload = new TextEncoder().encode(JSON.stringify({
        type: 'reaction',
        emoji,
        sender: displayName,
      }));
      await roomRef.current.localParticipant.publishData(payload, { reliable: true });

      const reactionId = `${Date.now()}_${Math.random()}`;
      setActiveReactions((prev) => [...prev, { id: reactionId, emoji, sender: 'You' }]);
      setTimeout(() => {
        setActiveReactions((prev) => prev.filter((r) => r.id !== reactionId));
      }, 3000);
    } catch (err) {
      console.warn('Failed to broadcast reaction', err);
    }
  };

  // In-Call Add People
  const openAddPeopleModal = async () => {
    setIsAddPeopleOpen(true);
    setAddPeopleQuery('');
    setAddPeopleSuccess('');
    try {
      const resp = await api.get<any>('/api/v1/memberships/directory/');
      const list = Array.isArray(resp) ? resp : (resp.results || []);
      setDirectoryUsers(list);
    } catch (err) {
      console.warn('Failed to load directory', err);
    }
  };

  const handleInviteColleague = async (colleague: any) => {
    try {
      await api.post('/api/v1/notifications/', {
        user_id: colleague.user_id || colleague.id,
        notification_type: 'meeting_invite',
        title: `Meeting Invitation: ${meetingTitle}`,
        body: `${displayName} invited you to join "${meetingTitle}" (Room: ${roomName})`,
        data: {
          meeting_id: meetingId,
          room_name: roomName,
          link: '/meetings',
        },
      });
      setAddPeopleSuccess(`Invitation sent to ${colleague.full_name || colleague.email}!`);
      setTimeout(() => setAddPeopleSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to invite colleague', err);
    }
  };

  // In-Call File Sharing
  const handleFileUploadInMeeting = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (meetingId) {
        formData.append('meeting_id', meetingId);
      }

      const resp = await api.post<any>('/api/v1/files/upload/', formData);
      const sharedFile: MeetingFile = {
        id: resp.id,
        filename: resp.filename,
        file_size: resp.file_size,
        download_url: resp.download_url || `/api/v1/files/${resp.id}/download/`,
        uploader: displayName,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMeetingFiles((prev) => [sharedFile, ...prev]);

      if (roomRef.current) {
        try {
          const payload = new TextEncoder().encode(JSON.stringify({
            type: 'file_shared',
            file: sharedFile,
          }));
          await roomRef.current.localParticipant.publishData(payload, { reliable: true });
        } catch (_) {}
      }
    } catch (err) {
      console.error('Failed to upload file in meeting', err);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const copyMeetingId = () => {
    navigator.clipboard.writeText(roomName);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // ================= RENDER: 1. PRE-JOIN SCREEN =================
  if (stage === 'prejoin') {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#1a1a1a',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Pre-join Top Header */}
        <div style={{
          height: '56px',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #333333',
          backgroundColor: '#1f1f1f',
        }}>
          <button
            onClick={() => navigate('/meetings')}
            className="teams-btn teams-btn-secondary"
            style={{ fontSize: '13px', height: '32px' }}
          >
            <ChevronLeft size={16} />
            <span>Back to Calendar</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#adadad' }}>
            <ShieldCheck size={16} color="var(--brand-primary)" />
            <span>End-to-End Encrypted LiveKit Session</span>
          </div>
        </div>

        {/* Pre-join Main Staging Area */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px',
        }}>
          <div style={{
            width: '100%',
            maxWidth: '640px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
          }}>
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '6px' }}>{meetingTitle}</h1>
              <p style={{ fontSize: '13px', color: '#8a8a8a' }}>Room ID: {roomName || 'Pending'}</p>
            </div>

            {hardwareNotice && (
              <div style={{
                backgroundColor: 'rgba(242, 153, 74, 0.15)',
                color: '#f2994a',
                border: '1px solid rgba(242, 153, 74, 0.3)',
                padding: '8px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <AlertCircle size={15} />
                <span>{hardwareNotice}</span>
              </div>
            )}

            {/* Video Preview Card */}
            <div style={{
              width: '520px',
              height: '320px',
              backgroundColor: '#0d0d0d',
              borderRadius: '12px',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
              border: '1px solid #383838',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <video
                ref={prejoinVideoRef}
                autoPlay
                muted
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: isVideoEnabled ? 'block' : 'none',
                  transform: 'scaleX(-1)',
                }}
              />

              {!isVideoEnabled && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--brand-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px',
                    fontWeight: 700,
                  }}>
                    {displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <span style={{ fontSize: '13px', color: '#8a8a8a' }}>Camera is turned off</span>
                </div>
              )}

              {/* In-preview quick controls */}
              <div style={{
                position: 'absolute',
                bottom: '16px',
                display: 'flex',
                gap: '12px',
                backgroundColor: 'rgba(0,0,0,0.65)',
                padding: '6px 14px',
                borderRadius: '24px',
                backdropFilter: 'blur(4px)',
              }}>
                <button
                  onClick={togglePrejoinAudio}
                  className="teams-btn"
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    backgroundColor: isAudioEnabled ? '#333333' : '#c4314b',
                    color: '#ffffff',
                    padding: 0,
                  }}
                  title={isAudioEnabled ? 'Mute' : 'Unmute'}
                >
                  {isAudioEnabled ? <Mic size={18} /> : <MicOff size={18} />}
                </button>

                <button
                  onClick={togglePrejoinVideo}
                  className="teams-btn"
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    backgroundColor: isVideoEnabled ? '#333333' : '#c4314b',
                    color: '#ffffff',
                    padding: 0,
                  }}
                  title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                >
                  {isVideoEnabled ? <VideoIcon size={18} /> : <VideoOff size={18} />}
                </button>
              </div>
            </div>

            {/* Display Name and Join Actions */}
            <div style={{ width: '520px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#adadad', marginBottom: '6px' }}>
                  Your Display Name in Meeting
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="teams-input"
                  style={{
                    width: '100%',
                    backgroundColor: '#262626',
                    border: '1px solid #444444',
                    color: '#ffffff',
                    height: '40px',
                    fontSize: '14px',
                  }}
                  placeholder="Enter your name"
                />
              </div>

              <button
                onClick={connectToLiveKit}
                className="teams-btn teams-btn-primary"
                style={{
                  width: '100%',
                  height: '44px',
                  fontSize: '15px',
                  fontWeight: 600,
                  borderRadius: '6px',
                }}
              >
                Join now
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ================= RENDER: 2. CONNECTING STAGE =================
  if (stage === 'connecting') {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#1a1a1a',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
      }}>
        <RefreshCw size={36} className="spin" color="var(--brand-primary)" />
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Connecting to LiveKit Room...</h2>
        <p style={{ fontSize: '13px', color: '#8a8a8a' }}>Authenticating participant credentials and establishing WebRTC stream</p>
      </div>
    );
  }

  // ================= RENDER: 3. ERROR STAGE =================
  if (stage === 'error') {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#1a1a1a',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center',
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'rgba(196, 49, 75, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
        }}>
          <AlertCircle size={28} color="#c4314b" />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Call Connection Error</h2>
        <p style={{ fontSize: '14px', color: '#adadad', maxWidth: '440px', lineHeight: '1.5', marginBottom: '24px' }}>
          {errorMessage || 'Unable to establish connection with the LiveKit Cloud room.'}
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setStage('prejoin')}
            className="teams-btn teams-btn-secondary"
            style={{ padding: '8px 18px', fontSize: '13px' }}
          >
            Adjust Settings
          </button>
          <button
            onClick={() => navigate('/meetings')}
            className="teams-btn teams-btn-primary"
            style={{ padding: '8px 18px', fontSize: '13px' }}
          >
            Return to Calendar
          </button>
        </div>
      </div>
    );
  }

  // ================= RENDER: 4. IN-CALL MEETING ROOM =================
  const filteredColleagues = directoryUsers.filter((u) =>
    (u.full_name || '').toLowerCase().includes(addPeopleQuery.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(addPeopleQuery.toLowerCase()) ||
    (u.job_title || '').toLowerCase().includes(addPeopleQuery.toLowerCase())
  );

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#141414',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Active Reactions Floating Overlay */}
      {activeReactions.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '76px',
          right: '24px',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          pointerEvents: 'none',
        }}>
          {activeReactions.map((r) => (
            <div
              key={r.id}
              style={{
                backgroundColor: 'rgba(0,0,0,0.75)',
                color: '#ffffff',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backdropFilter: 'blur(4px)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                animation: 'fadein 0.2s ease-out',
              }}
            >
              <span style={{ fontSize: '24px' }}>{r.emoji}</span>
              <span style={{ fontSize: '12px', color: '#adadad' }}>{r.sender}</span>
            </div>
          ))}
        </div>
      )}

      {/* Shared File Toast Alert */}
      {fileToast && (
        <div style={{
          position: 'absolute',
          top: '76px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          backgroundColor: 'var(--brand-primary)',
          color: '#ffffff',
          padding: '8px 18px',
          borderRadius: '20px',
          fontSize: '13px',
          fontWeight: 500,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          {fileToast}
        </div>
      )}

      {/* Top Meeting Header Bar */}
      <div style={{
        height: '56px',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#1f1f1f',
        borderBottom: '1px solid #333333',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>{meetingTitle}</h2>
          <span style={{ fontSize: '12px', color: '#8a8a8a' }}>Room: {roomName}</span>
          <button
            onClick={copyMeetingId}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--brand-light)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
            }}
          >
            {copied ? <Check size={14} color="#237b4b" /> : <Copy size={14} />}
            <span>{copied ? 'Copied' : 'Copy Room ID'}</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Duration Badge */}
          <div style={{ fontSize: '13px', color: '#adadad', fontWeight: 500 }}>
            {formatDuration(callDuration)}
          </div>

          {/* Participant count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#adadad' }}>
            <Users size={16} />
            <span>{participantsCount} in call</span>
          </div>

          {/* Live indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#237b4b' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#237b4b' }} />
            <span>Live</span>
          </div>
        </div>
      </div>

      {/* Main Video Gallery Stage */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        gap: '16px',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Local Video Tile */}
        <div style={{
          width: '480px',
          height: '340px',
          backgroundColor: '#262626',
          borderRadius: '10px',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #383838',
        }}>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: isVideoEnabled ? 'block' : 'none',
              transform: 'scaleX(-1)',
            }}
          />

          {!isVideoEnabled && (
            <div style={{
              width: '76px',
              height: '76px',
              borderRadius: '50%',
              backgroundColor: 'var(--brand-primary)',
              color: '#ffffff',
              fontSize: '28px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {displayName ? displayName.slice(0, 2).toUpperCase() : 'ME'}
            </div>
          )}

          <div style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            backgroundColor: 'rgba(0,0,0,0.65)',
            padding: '4px 10px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <span>{displayName || 'You'}</span>
            {!isAudioEnabled && <MicOff size={13} color="#c4314b" />}
          </div>
        </div>

        {/* Remote Video Gallery Container */}
        <div
          ref={remoteVideosRef}
          style={{
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
      </div>

      {/* Floating Call Controls Bar (Microsoft Teams Style) */}
      <div style={{
        height: '76px',
        backgroundColor: '#1f1f1f',
        borderTop: '1px solid #333333',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        position: 'relative',
        zIndex: 20,
      }}>
        {/* Mic Button */}
        <button
          onClick={toggleMic}
          className="teams-btn"
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            backgroundColor: isAudioEnabled ? '#333333' : '#c4314b',
            color: '#ffffff',
            padding: 0,
            transition: 'background-color 0.2s',
          }}
          title={isAudioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
        >
          {isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
        </button>

        {/* Cam Button */}
        <button
          onClick={toggleCam}
          className="teams-btn"
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            backgroundColor: isVideoEnabled ? '#333333' : '#c4314b',
            color: '#ffffff',
            padding: 0,
            transition: 'background-color 0.2s',
          }}
          title={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
        >
          {isVideoEnabled ? <VideoIcon size={20} /> : <VideoOff size={20} />}
        </button>

        {/* Screen Share Button */}
        <button
          onClick={toggleScreenShare}
          className="teams-btn"
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            backgroundColor: isScreenSharing ? 'var(--brand-primary)' : '#333333',
            color: '#ffffff',
            padding: 0,
            transition: 'background-color 0.2s',
          }}
          title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
        >
          <Monitor size={20} />
        </button>

        {/* Reactions Picker Button */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsReactionPickerOpen(!isReactionPickerOpen)}
            className="teams-btn"
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              backgroundColor: isReactionPickerOpen ? 'var(--brand-primary)' : '#333333',
              color: '#ffffff',
              padding: 0,
              transition: 'background-color 0.2s',
            }}
            title="React"
          >
            <Smile size={20} />
          </button>

          {isReactionPickerOpen && (
            <div style={{
              position: 'absolute',
              bottom: '56px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: '#262626',
              borderRadius: '24px',
              padding: '6px 12px',
              display: 'flex',
              gap: '10px',
              boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
              border: '1px solid #444444',
            }}>
              {['👍', '👏', '❤️', '😂', '🎉', '👋'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '22px',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    transition: 'transform 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.25)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Add People Button */}
        <button
          onClick={openAddPeopleModal}
          className="teams-btn"
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            backgroundColor: '#333333',
            color: '#ffffff',
            padding: 0,
            transition: 'background-color 0.2s',
          }}
          title="Add People to Call"
        >
          <UserPlus size={20} />
        </button>

        {/* Share Files Button */}
        <button
          onClick={() => setIsFilesDrawerOpen(!isFilesDrawerOpen)}
          className="teams-btn"
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            backgroundColor: isFilesDrawerOpen ? 'var(--brand-primary)' : '#333333',
            color: '#ffffff',
            padding: 0,
            position: 'relative',
            transition: 'background-color 0.2s',
          }}
          title="Meeting Files"
        >
          <Paperclip size={20} />
          {meetingFiles.length > 0 && (
            <span style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              backgroundColor: 'var(--brand-primary)',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 700,
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {meetingFiles.length}
            </span>
          )}
        </button>

        {/* Leave Meeting Button */}
        <button
          onClick={leaveMeeting}
          className="teams-btn teams-btn-danger"
          style={{
            height: '46px',
            padding: '0 24px',
            borderRadius: '23px',
            fontWeight: 600,
            fontSize: '14px',
          }}
        >
          <PhoneOff size={18} />
          <span>Leave</span>
        </button>

        {/* End Meeting for all (Host only) */}
        {isHost && (
          <button
            onClick={endMeetingForAll}
            className="teams-btn"
            style={{
              height: '46px',
              padding: '0 20px',
              borderRadius: '23px',
              backgroundColor: '#a80000',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="End meeting for all participants"
          >
            <PhoneOff size={16} />
            <span>End Meeting</span>
          </button>
        )}
      </div>

      {/* ================= MODAL: ADD PEOPLE DURING MEETING ================= */}
      {isAddPeopleOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
        }}>
          <div style={{
            backgroundColor: '#262626',
            borderRadius: '10px',
            width: '460px',
            maxHeight: '520px',
            padding: '24px',
            border: '1px solid #444444',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Add People to Call</h3>
              <button
                onClick={() => setIsAddPeopleOpen(false)}
                style={{ background: 'none', border: 'none', color: '#adadad', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {addPeopleSuccess && (
              <div style={{ backgroundColor: 'rgba(35, 123, 75, 0.2)', color: '#237b4b', padding: '8px 12px', borderRadius: '4px', fontSize: '13px', marginBottom: '12px' }}>
                {addPeopleSuccess}
              </div>
            )}

            <input
              type="text"
              placeholder="Search colleagues by name, email, or title..."
              value={addPeopleQuery}
              onChange={(e) => setAddPeopleQuery(e.target.value)}
              className="teams-input"
              style={{
                width: '100%',
                backgroundColor: '#1f1f1f',
                border: '1px solid #383838',
                color: '#ffffff',
                marginBottom: '14px',
              }}
            />

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredColleagues.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#8a8a8a', padding: '24px 0', fontSize: '13px' }}>
                  No colleagues found.
                </div>
              ) : (
                filteredColleagues.map((emp) => (
                  <div
                    key={emp.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#1f1f1f',
                      border: '1px solid #333333',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{emp.full_name}</div>
                      <div style={{ fontSize: '12px', color: '#8a8a8a' }}>{emp.email} • {emp.job_title || 'Colleague'}</div>
                    </div>
                    <button
                      onClick={() => handleInviteColleague(emp)}
                      className="teams-btn teams-btn-primary"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      Invite
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= DRAWER / MODAL: MEETING FILE SHARING ================= */}
      {isFilesDrawerOpen && (
        <div style={{
          position: 'fixed',
          top: '56px',
          right: 0,
          bottom: '76px',
          width: '360px',
          backgroundColor: '#212121',
          borderLeft: '1px solid #333333',
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-6px 0 24px rgba(0,0,0,0.4)',
        }}>
          <div style={{
            padding: '16px',
            borderBottom: '1px solid #333333',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Paperclip size={18} color="var(--brand-primary)" />
              <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Meeting Files ({meetingFiles.length})</h3>
            </div>
            <button
              onClick={() => setIsFilesDrawerOpen(false)}
              style={{ background: 'none', border: 'none', color: '#adadad', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Upload Button */}
          <div style={{ padding: '16px', borderBottom: '1px solid #333333' }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUploadInMeeting}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile}
              className="teams-btn teams-btn-primary"
              style={{ width: '100%', padding: '8px 0', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Upload size={16} />
              <span>{uploadingFile ? 'Uploading File...' : 'Share a File with Attendees'}</span>
            </button>
          </div>

          {/* Shared Files List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {meetingFiles.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#8a8a8a', padding: '36px 12px', fontSize: '13px' }}>
                <FileText size={36} style={{ opacity: 0.35, margin: '0 auto 8px', display: 'block' }} />
                <p style={{ margin: 0, fontWeight: 600 }}>No files shared yet</p>
                <p style={{ margin: '4px 0 0', fontSize: '12px' }}>Upload documents or media to share them with attendees.</p>
              </div>
            ) : (
              meetingFiles.map((file) => (
                <div
                  key={file.id}
                  style={{
                    padding: '12px',
                    borderRadius: '6px',
                    backgroundColor: '#2a2a2a',
                    border: '1px solid #383838',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontWeight: 600,
                      fontSize: '13px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {file.filename}
                    </div>
                    <div style={{ fontSize: '11px', color: '#8a8a8a', marginTop: '2px' }}>
                      {Math.round(file.file_size / 1024)} KB • Shared by {file.uploader}
                    </div>
                  </div>

                  <a
                    href={file.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="teams-btn teams-btn-secondary"
                    style={{ padding: '6px', marginLeft: '10px', display: 'flex', alignItems: 'center' }}
                    title="Download File"
                  >
                    <Download size={15} />
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
