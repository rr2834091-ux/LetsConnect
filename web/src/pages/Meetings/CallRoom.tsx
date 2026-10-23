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
  ShieldCheck,
  UserPlus,
  Smile,
  Paperclip,
  Download,
  X,
  FileText,
  Upload,
  Volume2,
  Pin,
  Maximize2,
  Minimize2,
  Expand,
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

// Subcomponent to render any LiveKit Video Track automatically filling its container with full device screen resolution
const VideoTrackView: React.FC<{
  track?: Track | null;
  fit?: 'cover' | 'contain';
  mirrored?: boolean;
  style?: React.CSSProperties;
}> = ({ track, fit = 'cover', mirrored = false, style }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !track) return;
    track.attach(el);
    return () => {
      try {
        track.detach(el);
      } catch (_) {}
    };
  }, [track]);

  if (!track) return null;

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={mirrored}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: fit,
        transform: mirrored ? 'scaleX(-1)' : 'none',
        display: 'block',
        ...style,
      }}
    />
  );
};

export const CallRoom: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

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

  // Full-screen and Screen Resolution Adapter states
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [videoFitMode, setVideoFitMode] = useState<'cover' | 'contain'>('cover');
  const [swappedPiP, setSwappedPiP] = useState<boolean>(false);

  // Immersive layout states: Active Speaker & Focused Participant
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [focusedParticipantId, setFocusedParticipantId] = useState<string | null>(null);
  const [, setMediaUpdateTick] = useState<number>(0);

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
  const prejoinStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // DOM Ref for prejoin preview
  const prejoinVideoRef = useRef<HTMLVideoElement>(null);

  // Listen to browser fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Error entering fullscreen:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.warn('Error exiting fullscreen:', err);
        });
      }
    }
  };

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

  // Pre-join camera & microphone preview with dynamic device resolution check
  useEffect(() => {
    let active = true;

    const startPrejoinPreview = async () => {
      if (stage !== 'prejoin') return;

      try {
        let hasVideoDevice = false;

        if (navigator.mediaDevices?.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          hasVideoDevice = devices.some((d) => d.kind === 'videoinput');
        }

        if (!hasVideoDevice) {
          setIsVideoEnabled(false);
          setHardwareNotice('No webcam detected. Video disabled; joining in audio-only mode.');
        }

        // Request high-resolution capture matching device capability
        const constraints: MediaStreamConstraints = {
          audio: true,
          video: (hasVideoDevice && isVideoEnabled) ? {
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
            facingMode: 'user',
          } : false,
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
  }, [stage, isVideoEnabled]);

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
    setStage('connecting');
    setErrorMessage(null);

    let roomInstance: Room | null = null;

    try {
      roomInstance = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h1080.resolution,
        },
      });

      roomRef.current = roomInstance;

      roomInstance.on(RoomEvent.Connected, () => {
        setStage('in_call');
        if (roomInstance) {
          setParticipantsCount(roomInstance.remoteParticipants.size + 1);
        }
        setMediaUpdateTick((t) => t + 1);
      });

      roomInstance.on(RoomEvent.ParticipantConnected, () => {
        if (roomInstance) {
          setParticipantsCount(roomInstance.remoteParticipants.size + 1);
        }
        setMediaUpdateTick((t) => t + 1);
      });

      roomInstance.on(RoomEvent.ParticipantDisconnected, (participant) => {
        if (roomInstance) {
          setParticipantsCount(roomInstance.remoteParticipants.size + 1);
        }
        setFocusedParticipantId((prev) => (prev === participant.identity ? null : prev));
        const audioEl = document.getElementById(`audio-${participant.identity}`);
        if (audioEl) audioEl.remove();
        setMediaUpdateTick((t) => t + 1);
      });

      roomInstance.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        if (speakers && speakers.length > 0) {
          setActiveSpeakerId(speakers[0].identity);
        } else {
          setActiveSpeakerId(null);
        }
        setMediaUpdateTick((t) => t + 1);
      });

      roomInstance.on(RoomEvent.TrackSubscribed, (track: Track, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Audio) {
          const existing = document.getElementById(`audio-${participant.identity}`);
          if (existing) existing.remove();
          const audioEl = track.attach();
          audioEl.id = `audio-${participant.identity}`;
          document.body.appendChild(audioEl);
        }
        setMediaUpdateTick((t) => t + 1);
      });

      roomInstance.on(RoomEvent.TrackUnsubscribed, (track: Track, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Audio) {
          try {
            track.detach().forEach((el) => el.remove());
          } catch (_) {}
          const audioEl = document.getElementById(`audio-${participant.identity}`);
          if (audioEl) audioEl.remove();
        }
        setMediaUpdateTick((t) => t + 1);
      });

      roomInstance.on(RoomEvent.TrackMuted, () => {
        setMediaUpdateTick((t) => t + 1);
      });

      roomInstance.on(RoomEvent.TrackUnmuted, () => {
        setMediaUpdateTick((t) => t + 1);
      });

      roomInstance.on(RoomEvent.LocalTrackPublished, () => {
        setMediaUpdateTick((t) => t + 1);
      });

      roomInstance.on(RoomEvent.LocalTrackUnpublished, () => {
        setMediaUpdateTick((t) => t + 1);
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
        sessionStorage.removeItem('active_call_session');
        navigate('/calls');
      });

      // Connect to LiveKit Cloud Server
      await roomInstance.connect(livekitUrl, meetingToken);
      roomRef.current = roomInstance;

      // Attach existing audio tracks from participants already in room
      roomInstance.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((pub) => {
          if (pub.track && pub.track.kind === Track.Kind.Audio) {
            const audioEl = pub.track.attach();
            audioEl.id = `audio-${participant.identity}`;
            document.body.appendChild(audioEl);
          }
        });
      });

      // Publish local media with high-resolution presets
      try {
        if (isVideoEnabled) {
          await roomInstance.localParticipant.setCameraEnabled(true);
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
      setMediaUpdateTick((t) => t + 1);
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
    if (roomRef.current) {
      try {
        roomRef.current.disconnect();
      } catch (err) {
        console.warn('Error during room disconnect', err);
      }
      roomRef.current = null;
    }
    document.querySelectorAll('[id^="audio-"]').forEach((el) => el.remove());
    sessionStorage.removeItem('active_call_session');
    navigate('/calls');
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
        try {
          roomRef.current.disconnect();
        } catch (_) {}
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
      setMediaUpdateTick((t) => t + 1);
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
      setMediaUpdateTick((t) => t + 1);
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
      setMediaUpdateTick((t) => t + 1);
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
                  position: 'absolute',
                  inset: 0,
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
                zIndex: 10,
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
            onClick={() => navigate('/calls')}
            className="teams-btn teams-btn-primary"
            style={{ padding: '8px 18px', fontSize: '13px' }}
          >
            Return to Calls
          </button>
        </div>
      </div>
    );
  }

  // ================= RENDER: 4. IN-CALL MEETING ROOM (TRUE FULL SCREEN & RESOLUTION AUTO-ADAPT) =================
  const filteredColleagues = directoryUsers.filter((u) =>
    (u.full_name || '').toLowerCase().includes(addPeopleQuery.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(addPeopleQuery.toLowerCase()) ||
    (u.job_title || '').toLowerCase().includes(addPeopleQuery.toLowerCase())
  );

  // Compute active screen share (local or remote)
  let activeScreenShare: { track: Track; name: string; isLocal: boolean } | null = null;
  if (roomRef.current) {
    const localScreenPub = roomRef.current.localParticipant.getTrackPublication(Track.Source.ScreenShare);
    if (localScreenPub?.track && !localScreenPub.isMuted) {
      activeScreenShare = {
        track: localScreenPub.track,
        name: displayName || 'You',
        isLocal: true,
      };
    } else {
      for (const [, p] of roomRef.current.remoteParticipants) {
        const screenPub = p.getTrackPublication(Track.Source.ScreenShare);
        if (screenPub?.track && !screenPub.isMuted) {
          activeScreenShare = {
            track: screenPub.track,
            name: p.name || p.identity,
            isLocal: false,
          };
          break;
        }
      }
    }
  }

  // Build the complete participants list
  interface ParticipantItem {
    id: string;
    name: string;
    isLocal: boolean;
    cameraTrack: Track | null;
    isVideoMuted: boolean;
    isAudioMuted: boolean;
    isSpeaking: boolean;
  }

  const participantsList: ParticipantItem[] = [];

  // Local user participant item
  const localCamPub = roomRef.current?.localParticipant.getTrackPublication(Track.Source.Camera);
  participantsList.push({
    id: 'local',
    name: `${displayName || 'You'} (You)`,
    isLocal: true,
    cameraTrack: (isVideoEnabled && localCamPub?.track) ? localCamPub.track : null,
    isVideoMuted: !isVideoEnabled || !localCamPub?.track,
    isAudioMuted: !isAudioEnabled,
    isSpeaking: activeSpeakerId === roomRef.current?.localParticipant.identity,
  });

  // Remote participants
  if (roomRef.current) {
    roomRef.current.remoteParticipants.forEach((p) => {
      const camPub = p.getTrackPublication(Track.Source.Camera);
      const micPub = p.getTrackPublication(Track.Source.Microphone);
      participantsList.push({
        id: p.identity,
        name: p.name || p.identity,
        isLocal: false,
        cameraTrack: (camPub?.track && !camPub.isMuted) ? camPub.track : null,
        isVideoMuted: !camPub || camPub.isMuted || !camPub.track,
        isAudioMuted: !micPub || micPub.isMuted,
        isSpeaking: p.isSpeaking || activeSpeakerId === p.identity,
      });
    });
  }

  const isSolo = participantsList.length === 1;
  const isOneOnOne = participantsList.length === 2 && !activeScreenShare;
  const isMultiParty = participantsList.length >= 3 || !!activeScreenShare;

  // Primary participant for the full-screen stage
  let primaryParticipant: ParticipantItem = participantsList[0];
  let secondaryParticipant: ParticipantItem | null = null;

  if (isOneOnOne) {
    // In 1-on-1, remote user is full-screen, local user is in floating PiP
    if (swappedPiP) {
      primaryParticipant = participantsList[0]; // Local
      secondaryParticipant = participantsList[1]; // Remote
    } else {
      primaryParticipant = participantsList[1]; // Remote
      secondaryParticipant = participantsList[0]; // Local
    }
  } else if (focusedParticipantId) {
    const found = participantsList.find((p) => p.id === focusedParticipantId);
    if (found) primaryParticipant = found;
  } else if (activeSpeakerId) {
    const speaker = participantsList.find((p) => p.id === activeSpeakerId || (p.isLocal && activeSpeakerId === roomRef.current?.localParticipant.identity));
    if (speaker) primaryParticipant = speaker;
  } else if (participantsList.length > 1) {
    primaryParticipant = participantsList[1];
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#0a0a0a',
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
          top: '68px',
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
                backgroundColor: 'rgba(0,0,0,0.85)',
                color: '#ffffff',
                padding: '8px 16px',
                borderRadius: '24px',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              <span style={{ fontSize: '26px' }}>{r.emoji}</span>
              <span style={{ fontSize: '13px', color: '#cccccc', fontWeight: 500 }}>{r.sender}</span>
            </div>
          ))}
        </div>
      )}

      {/* Shared File Toast Alert */}
      {fileToast && (
        <div style={{
          position: 'absolute',
          top: '68px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          backgroundColor: 'var(--brand-primary)',
          color: '#ffffff',
          padding: '8px 20px',
          borderRadius: '24px',
          fontSize: '13px',
          fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
        }}>
          {fileToast}
        </div>
      )}

      {/* ================= 1. FLOATING FULL-WIDTH TOP HEADER ================= */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '56px',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 65%, rgba(0,0,0,0) 100%)',
        zIndex: 30,
        pointerEvents: 'auto',
      }}>
        {/* Left info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
            {meetingTitle}
          </h2>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
            Room: {roomName}
          </span>
          <button
            onClick={copyMeetingId}
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '16px',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              padding: '4px 10px',
              backdropFilter: 'blur(4px)',
            }}
          >
            {copied ? <Check size={14} color="#237b4b" /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy ID'}</span>
          </button>
        </div>

        {/* Right Controls: Duration, Participants, Resolution Fit, Fullscreen */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Duration Badge */}
          <div style={{
            fontSize: '12px',
            color: '#ffffff',
            fontWeight: 500,
            background: 'rgba(0,0,0,0.4)',
            padding: '4px 10px',
            borderRadius: '12px',
          }}>
            {formatDuration(callDuration)}
          </div>

          {/* Participant count */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: '#ffffff',
            background: 'rgba(0,0,0,0.4)',
            padding: '4px 10px',
            borderRadius: '12px',
          }}>
            <Users size={14} />
            <span>{participantsCount} in call</span>
          </div>

          {/* Live indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: '#4ade80',
            background: 'rgba(35, 123, 75, 0.25)',
            border: '1px solid rgba(35, 123, 75, 0.5)',
            padding: '4px 10px',
            borderRadius: '12px',
          }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
            <span>Live</span>
          </div>

          {/* Auto Screen Resolution Aspect Ratio Toggle (Cover vs Contain) */}
          <button
            onClick={() => setVideoFitMode((prev) => (prev === 'cover' ? 'contain' : 'cover'))}
            className="teams-btn"
            style={{
              height: '32px',
              fontSize: '12px',
              padding: '0 10px',
              borderRadius: '16px',
              backgroundColor: 'rgba(255,255,255,0.15)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backdropFilter: 'blur(4px)',
            }}
            title={videoFitMode === 'cover' ? 'Currently Filling Screen (Click to Fit Frame)' : 'Currently Fitting Frame (Click to Fill Screen)'}
          >
            <Expand size={14} />
            <span>{videoFitMode === 'cover' ? 'Fill Screen' : 'Fit Frame'}</span>
          </button>

          {/* Device Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="teams-btn"
            style={{
              height: '32px',
              fontSize: '12px',
              padding: '0 10px',
              borderRadius: '16px',
              backgroundColor: isFullscreen ? 'var(--brand-primary)' : 'rgba(255,255,255,0.15)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backdropFilter: 'blur(4px)',
            }}
            title={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>
        </div>
      </div>

      {/* ================= 2. TRUE FULL SCREEN VIDEO STAGE (EDGE-TO-EDGE) ================= */}
      <div style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {activeScreenShare ? (
          // Screen share fills the screen with contain mode
          <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <VideoTrackView
              track={activeScreenShare.track}
              fit="contain"
              mirrored={false}
            />
            <div style={{
              position: 'absolute',
              top: '68px',
              left: '20px',
              backgroundColor: 'rgba(0,0,0,0.8)',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backdropFilter: 'blur(6px)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}>
              <Monitor size={16} color="var(--brand-primary)" />
              <span>Screen Share: {activeScreenShare.name}</span>
            </div>
          </div>
        ) : primaryParticipant?.cameraTrack && !primaryParticipant.isVideoMuted ? (
          // Camera track filling 100% of device screen resolution
          <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <VideoTrackView
              track={primaryParticipant.cameraTrack}
              fit={videoFitMode}
              mirrored={primaryParticipant.isLocal}
            />
          </div>
        ) : (
          // Camera-off state with centered avatar
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              backgroundColor: 'var(--brand-primary)',
              color: '#ffffff',
              fontSize: '44px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
            }}>
              {(primaryParticipant?.name || 'P').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 600 }}>{primaryParticipant?.name}</div>
              <div style={{ fontSize: '13px', color: '#8a8a8a', marginTop: '4px' }}>Camera is turned off</div>
            </div>
          </div>
        )}

        {/* Solo Call Notice Overlay */}
        {isSolo && (
          <div style={{
            position: 'absolute',
            top: '72px',
            backgroundColor: 'rgba(0,0,0,0.65)',
            padding: '8px 18px',
            borderRadius: '20px',
            fontSize: '13px',
            color: '#e0e0e0',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(255,255,255,0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <Users size={15} color="var(--brand-primary)" />
            <span>You are alone in this meeting. Invite colleagues or share Room ID: <strong>{roomName}</strong></span>
          </div>
        )}

        {/* Focus Pin Badge */}
        {focusedParticipantId && (
          <div
            onClick={() => setFocusedParticipantId(null)}
            style={{
              position: 'absolute',
              top: '68px',
              right: '20px',
              backgroundColor: 'rgba(0,0,0,0.75)',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255,255,255,0.2)',
              zIndex: 20,
            }}
            title="Click to unpin and follow active speaker"
          >
            <Pin size={13} color="var(--brand-light)" />
            <span>Pinned (Click to unpin)</span>
          </div>
        )}

        {/* Primary Participant Name Pill (Bottom Left) */}
        <div style={{
          position: 'absolute',
          bottom: isMultiParty ? '120px' : '90px',
          left: '24px',
          backgroundColor: 'rgba(0,0,0,0.75)',
          padding: '6px 14px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255,255,255,0.1)',
          zIndex: 20,
        }}>
          <span>{activeScreenShare ? `Screen by ${activeScreenShare.name}` : primaryParticipant?.name}</span>
          {primaryParticipant?.isSpeaking && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4ade80', fontSize: '11px', fontWeight: 600 }}>
              <Volume2 size={13} />
              <span>Speaking</span>
            </span>
          )}
          {primaryParticipant?.isAudioMuted && <MicOff size={14} color="#c4314b" />}
        </div>
      </div>

      {/* ================= 3. FLOATING PICTURE-IN-PICTURE (FOR 1-ON-1 CALLS) ================= */}
      {isOneOnOne && secondaryParticipant && (
        <div
          onClick={() => setSwappedPiP(!swappedPiP)}
          style={{
            position: 'absolute',
            bottom: '90px',
            right: '24px',
            width: '210px',
            height: '130px',
            borderRadius: '12px',
            backgroundColor: '#1a1a1a',
            overflow: 'hidden',
            cursor: 'pointer',
            zIndex: 25,
            border: secondaryParticipant.isSpeaking ? '2px solid #22c55e' : '2px solid rgba(255,255,255,0.25)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s, border 0.2s',
          }}
          title="Click to swap main view"
        >
          {secondaryParticipant.cameraTrack && !secondaryParticipant.isVideoMuted ? (
            <VideoTrackView
              track={secondaryParticipant.cameraTrack}
              fit="cover"
              mirrored={secondaryParticipant.isLocal}
            />
          ) : (
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              backgroundColor: 'var(--brand-primary)',
              color: '#ffffff',
              fontSize: '18px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {secondaryParticipant.name.slice(0, 2).toUpperCase()}
            </div>
          )}

          {/* PiP Name Badge */}
          <div style={{
            position: 'absolute',
            bottom: '6px',
            left: '6px',
            right: '6px',
            backgroundColor: 'rgba(0,0,0,0.75)',
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backdropFilter: 'blur(4px)',
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {secondaryParticipant.name}
            </span>
            {secondaryParticipant.isAudioMuted && <MicOff size={11} color="#c4314b" style={{ flexShrink: 0 }} />}
          </div>
        </div>
      )}

      {/* ================= 4. COMPACT PARTICIPANT THUMBNAIL STRIP (FOR 3+ PARTICIPANTS OR SCREEN SHARE) ================= */}
      {isMultiParty && (
        <div style={{
          position: 'absolute',
          bottom: '86px',
          left: '20px',
          right: '20px',
          height: '96px',
          display: 'flex',
          gap: '10px',
          overflowX: 'auto',
          alignItems: 'center',
          padding: '4px',
          zIndex: 25,
          pointerEvents: 'auto',
        }}>
          {participantsList.map((p) => {
            const isMain = primaryParticipant?.id === p.id && !activeScreenShare;
            return (
              <div
                key={p.id}
                onClick={() => setFocusedParticipantId(p.id)}
                style={{
                  width: '144px',
                  height: '88px',
                  borderRadius: '10px',
                  backgroundColor: '#1f1f1f',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: p.isSpeaking
                    ? '2px solid #22c55e'
                    : isMain
                    ? '2px solid #5b5fc7'
                    : '1px solid rgba(255,255,255,0.2)',
                  boxShadow: p.isSpeaking ? '0 0 12px rgba(34, 197, 94, 0.5)' : '0 4px 12px rgba(0,0,0,0.4)',
                  transition: 'border 0.15s, transform 0.15s',
                }}
                title={`Click to focus on ${p.name}`}
              >
                {p.cameraTrack && !p.isVideoMuted ? (
                  <VideoTrackView
                    track={p.cameraTrack}
                    fit="cover"
                    mirrored={p.isLocal}
                  />
                ) : (
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--brand-primary)',
                    color: '#ffffff',
                    fontSize: '15px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                )}

                {/* Name Pill on Thumbnail */}
                <div style={{
                  position: 'absolute',
                  bottom: '6px',
                  left: '6px',
                  right: '6px',
                  backgroundColor: 'rgba(0,0,0,0.75)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  overflow: 'hidden',
                }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </span>
                  {p.isAudioMuted && <MicOff size={11} color="#c4314b" style={{ flexShrink: 0, marginLeft: '4px' }} />}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= 5. FLOATING BOTTOM CONTROL TOOLBAR ================= */}
      <div style={{
        position: 'absolute',
        bottom: '18px',
        left: '50%',
        transform: 'translateX(-50%)',
        height: '60px',
        backgroundColor: 'rgba(26, 26, 26, 0.88)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.15)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        borderRadius: '30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 16px',
        gap: '12px',
        zIndex: 35,
      }}>
        {/* Mic Button */}
        <button
          onClick={toggleMic}
          className="teams-btn"
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: isAudioEnabled ? 'rgba(255,255,255,0.1)' : '#c4314b',
            color: '#ffffff',
            padding: 0,
            transition: 'background-color 0.2s',
          }}
          title={isAudioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
        >
          {isAudioEnabled ? <Mic size={19} /> : <MicOff size={19} />}
        </button>

        {/* Cam Button */}
        <button
          onClick={toggleCam}
          className="teams-btn"
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: isVideoEnabled ? 'rgba(255,255,255,0.1)' : '#c4314b',
            color: '#ffffff',
            padding: 0,
            transition: 'background-color 0.2s',
          }}
          title={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
        >
          {isVideoEnabled ? <VideoIcon size={19} /> : <VideoOff size={19} />}
        </button>

        {/* Screen Share Button */}
        <button
          onClick={toggleScreenShare}
          className="teams-btn"
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: isScreenSharing ? 'var(--brand-primary)' : 'rgba(255,255,255,0.1)',
            color: '#ffffff',
            padding: 0,
            transition: 'background-color 0.2s',
          }}
          title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
        >
          <Monitor size={19} />
        </button>

        {/* Reactions Picker Button */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsReactionPickerOpen(!isReactionPickerOpen)}
            className="teams-btn"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: isReactionPickerOpen ? 'var(--brand-primary)' : 'rgba(255,255,255,0.1)',
              color: '#ffffff',
              padding: 0,
              transition: 'background-color 0.2s',
            }}
            title="React"
          >
            <Smile size={19} />
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
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              border: '1px solid rgba(255,255,255,0.15)',
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
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.1)',
            color: '#ffffff',
            padding: 0,
            transition: 'background-color 0.2s',
          }}
          title="Add People to Call"
        >
          <UserPlus size={19} />
        </button>

        {/* Share Files Button */}
        <button
          onClick={() => setIsFilesDrawerOpen(!isFilesDrawerOpen)}
          className="teams-btn"
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: isFilesDrawerOpen ? 'var(--brand-primary)' : 'rgba(255,255,255,0.1)',
            color: '#ffffff',
            padding: 0,
            position: 'relative',
            transition: 'background-color 0.2s',
          }}
          title="Meeting Files"
        >
          <Paperclip size={19} />
          {meetingFiles.length > 0 && (
            <span style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
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
            height: '40px',
            padding: '0 20px',
            borderRadius: '20px',
            fontWeight: 600,
            fontSize: '13px',
            backgroundColor: '#c4314b',
          }}
        >
          <PhoneOff size={16} />
          <span>Leave</span>
        </button>

        {/* End Meeting for all (Host only) */}
        {isHost && (
          <button
            onClick={endMeetingForAll}
            className="teams-btn"
            style={{
              height: '40px',
              padding: '0 18px',
              borderRadius: '20px',
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
            <PhoneOff size={15} />
            <span>End Meeting</span>
          </button>
        )}
      </div>

      {/* ================= MODAL: ADD PEOPLE DURING MEETING ================= */}
      {isAddPeopleOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
        }}>
          <div style={{
            backgroundColor: '#262626',
            borderRadius: '12px',
            width: '460px',
            maxHeight: '520px',
            padding: '24px',
            border: '1px solid #444444',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
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

      {/* ================= DRAWER: MEETING FILE SHARING ================= */}
      {isFilesDrawerOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '360px',
          backgroundColor: '#212121',
          borderLeft: '1px solid #333333',
          zIndex: 45,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.6)',
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
