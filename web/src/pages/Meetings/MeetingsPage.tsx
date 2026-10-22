import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../state/AuthContext';
import { api } from '../../services/api';
import { Meeting } from '../../types';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Video,
  Hash,
  Plus,
  Clock,
  Lock,
  Copy,
  Check,
  X,
  Users,
  Info,
  Trash2,
  ExternalLink,
  ChevronDown
} from 'lucide-react';

type CalendarViewMode = 'day' | 'work_week' | 'month';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 56; // px per hour

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WORK_WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export const MeetingsPage: React.FC = () => {
  const { user, activeOrganization } = useAuth();
  const navigate = useNavigate();

  // Calendar State
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('work_week');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modals state
  const [isNewMeetingOpen, setIsNewMeetingOpen] = useState(false);
  const [isJoinWithIdOpen, setIsJoinWithIdOpen] = useState(false);
  const [isMeetNowOpen, setIsMeetNowOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  // New Meeting Form state
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newStartTime, setNewStartTime] = useState('09:00');
  const [newEndDate, setNewEndDate] = useState('');
  const [newEndTime, setNewEndTime] = useState('10:00');
  const [newPasscode, setNewPasscode] = useState('');
  const [newAllowGuest, setNewAllowGuest] = useState(true);

  // Join With ID Form state
  const [joinMeetingId, setJoinMeetingId] = useState('');
  const [joinPasscode, setJoinPasscode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  // Meet Now state
  const [meetNowTitle, setMeetNowTitle] = useState('');
  const [meetNowLoading, setMeetNowLoading] = useState(false);

  // Copy Feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Scroll ref for 24-hour grid
  const timeGridScrollRef = useRef<HTMLDivElement>(null);

  // Load meetings
  const loadMeetings = async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const orgParam = activeOrganization ? `?organization_id=${activeOrganization.id}` : '';
      const resp = await api.get<any>(`/api/v1/meetings/${orgParam}`);
      const list = resp.results || resp;
      setMeetings(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error('Failed to load meetings', err);
      setActionError(err.message || 'Failed to fetch meetings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, [activeOrganization]);

  // Initial scroll to 08:00 AM in timeline views
  useEffect(() => {
    if (timeGridScrollRef.current && (viewMode === 'day' || viewMode === 'work_week')) {
      // Scroll to 8 AM (8 * HOUR_HEIGHT)
      timeGridScrollRef.current.scrollTop = 8 * HOUR_HEIGHT - 20;
    }
  }, [viewMode]);

  // Helper date calculations
  const getStartOfWeek = (d: Date): Date => {
    const date = new Date(d);
    const day = date.getDay(); // 0 is Sun, 1 is Mon...
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const isSameDay = (d1: Date, d2: Date): boolean => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  // Navigate dates
  const handlePrev = () => {
    const next = new Date(currentDate);
    if (viewMode === 'day') {
      next.setDate(next.getDate() - 1);
    } else if (viewMode === 'work_week') {
      next.setDate(next.getDate() - 7);
    } else {
      next.setMonth(next.getMonth() - 1);
    }
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewMode === 'day') {
      next.setDate(next.getDate() + 1);
    } else if (viewMode === 'work_week') {
      next.setDate(next.getDate() + 7);
    } else {
      next.setMonth(next.getMonth() + 1);
    }
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      const parts = e.target.value.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        setCurrentDate(d);
      }
    }
  };

  // Open New Meeting pre-filled with date and hour
  const openNewMeetingModal = (targetDate?: Date, hour?: number) => {
    const d = targetDate || currentDate;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const startH = hour !== undefined ? String(hour).padStart(2, '0') : '09';
    const endH = hour !== undefined ? String(Math.min(23, hour + 1)).padStart(2, '0') : '10';

    setNewTitle('');
    setNewDescription('');
    setNewStartDate(dateStr);
    setNewStartTime(`${startH}:00`);
    setNewEndDate(dateStr);
    setNewEndTime(`${endH}:00`);
    setNewPasscode('');
    setNewAllowGuest(true);
    setActionError(null);
    setIsNewMeetingOpen(true);
  };

  // Schedule Meeting handler
  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const now = new Date();
      const startDateTime = new Date(`${newStartDate}T${newStartTime}:00`);
      const endDateTime = new Date(`${newEndDate}T${newEndTime}:00`);

      if (startDateTime < new Date(now.getTime() - 2 * 60 * 1000)) {
        setActionError('Cannot schedule a meeting in the past. Please select a future date and time.');
        return;
      }

      if (endDateTime <= startDateTime) {
        setActionError('Meeting end time must be after the start time.');
        return;
      }

      const payload: any = {
        title: newTitle.trim(),
        description: newDescription.trim(),
        scheduled_start: startDateTime.toISOString(),
        scheduled_end: endDateTime.toISOString(),
        passcode: newPasscode.trim(),
        allow_guest: newAllowGuest,
        is_instant: false,
      };

      if (activeOrganization) {
        payload.organization = activeOrganization.id;
      }

      await api.post('/api/v1/meetings/', payload);
      setIsNewMeetingOpen(false);
      loadMeetings();
    } catch (err: any) {
      console.error('Failed to schedule meeting', err);
      setActionError(err.message || 'Could not schedule meeting. Check inputs.');
    }
  };

  // Join with ID handler
  const handleJoinWithId = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinMeetingId.trim()) return;

    setJoinLoading(true);
    setActionError(null);
    try {
      const resp = await api.post<any>('/api/v1/meetings/join/', {
        meeting_id: joinMeetingId.trim(),
        passcode: joinPasscode.trim(),
      });

      setIsJoinWithIdOpen(false);
      // Navigate to Call Room with real LiveKit credentials
      navigate('/call-room', {
        state: {
          meetingId: resp.meeting_id,
          meetingToken: resp.token,
          livekitUrl: resp.livekit_url,
          roomName: resp.room_name,
          title: resp.title,
          displayName: resp.display_name,
          isHost: resp.is_host,
        },
      });
    } catch (err: any) {
      console.error('Failed to join meeting', err);
      setActionError(err.message || 'Meeting not found or invalid passcode.');
    } finally {
      setJoinLoading(false);
    }
  };

  // Meet Now handler
  const handleStartMeetNow = async () => {
    setMeetNowLoading(true);
    setActionError(null);
    try {
      const title = meetNowTitle.trim() || `Instant Meeting - ${user?.first_name || user?.username || 'Host'}`;
      const payload: any = {
        title,
        is_instant: true,
        allow_guest: true,
      };
      if (activeOrganization) {
        payload.organization = activeOrganization.id;
      }

      const createResp = await api.post<any>('/api/v1/meetings/', payload);
      const meetingId = createResp.id;

      // Join immediately
      const joinResp = await api.post<any>('/api/v1/meetings/join/', {
        meeting_id: meetingId,
      });

      setIsMeetNowOpen(false);
      navigate('/call-room', {
        state: {
          meetingId: joinResp.meeting_id || meetingId,
          meetingToken: joinResp.token,
          livekitUrl: joinResp.livekit_url,
          roomName: joinResp.room_name,
          title: joinResp.title,
          displayName: joinResp.display_name,
          isHost: joinResp.is_host ?? true,
        },
      });
    } catch (err: any) {
      console.error('Failed to start instant meeting', err);
      setActionError(err.message || 'Could not start instant meeting.');
    } finally {
      setMeetNowLoading(false);
    }
  };

  // Join Existing Meeting (from details or calendar card)
  const handleJoinExistingMeeting = async (meeting: Meeting) => {
    setActionError(null);
    try {
      const resp = await api.post<any>('/api/v1/meetings/join/', {
        meeting_id: meeting.id,
        passcode: meeting.passcode || '',
      });

      setSelectedMeeting(null);
      navigate('/call-room', {
        state: {
          meetingId: resp.meeting_id || meeting.id,
          meetingToken: resp.token,
          livekitUrl: resp.livekit_url,
          roomName: resp.room_name,
          title: resp.title,
          displayName: resp.display_name,
          isHost: resp.is_host ?? (meeting.host?.id === user?.id),
        },
      });
    } catch (err: any) {
      console.error('Failed to join meeting', err);
      setActionError(err.message || 'Failed to join meeting. It may have ended.');
    }
  };

  // Cancel / End Meeting
  const handleCancelMeeting = async (meetingId: string) => {
    if (!confirm('Are you sure you want to cancel this meeting?')) return;
    try {
      await api.post(`/api/v1/meetings/${meetingId}/end/`);
      setSelectedMeeting(null);
      loadMeetings();
    } catch (err: any) {
      console.error('Failed to cancel meeting', err);
      setActionError(err.message || 'Failed to cancel meeting.');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Formatting helpers
  const formatTimeRange = (startStr?: string, endStr?: string) => {
    if (!startStr) return '';
    const start = new Date(startStr);
    const sStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (!endStr) return sStr;
    const end = new Date(endStr);
    const eStr = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${sStr} - ${eStr}`;
  };

  // Calculate day columns for Work Week (Mon - Fri)
  const startOfWeek = getStartOfWeek(currentDate);
  const workWeekDays = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    return d;
  });

  // Calculate Month Grid (Mon - Sun)
  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const daysInMonth = lastDayOfMonth.getDate();
    // In JS 0 is Sunday, 1 is Monday. Convert so Monday is 0.
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Preceding month trailing days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Trailing next month days to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  };

  // Header Title
  const getHeaderTitle = () => {
    const month = MONTH_NAMES[currentDate.getMonth()];
    const year = currentDate.getFullYear();
    if (viewMode === 'month') {
      return `${month} ${year}`;
    }
    if (viewMode === 'day') {
      return `${currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`;
    }
    // Work week
    const first = workWeekDays[0];
    const last = workWeekDays[4];
    if (first.getMonth() === last.getMonth()) {
      return `${MONTH_NAMES[first.getMonth()]} ${first.getDate()} - ${last.getDate()}, ${first.getFullYear()}`;
    }
    return `${MONTH_NAMES[first.getMonth()].slice(0, 3)} ${first.getDate()} - ${MONTH_NAMES[last.getMonth()].slice(0, 3)} ${last.getDate()}, ${last.getFullYear()}`;
  };

  // Same-Day meetings sorted chronologically for selected date sidebar
  const selectedDateMeetings = meetings.filter((m) => {
    if (!m.scheduled_start) return false;
    return isSameDay(new Date(m.scheduled_start), currentDate);
  }).sort((a, b) => new Date(a.scheduled_start || 0).getTime() - new Date(b.scheduled_start || 0).getTime());

  // Current time marker offset (in px from top)
  const now = new Date();
  const currentMinutesFromMidnight = now.getHours() * 60 + now.getMinutes();
  const currentTimeTopOffset = (currentMinutesFromMidnight / 60) * HOUR_HEIGHT;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-primary)', overflow: 'hidden' }}>
      {/* Microsoft Teams Top Command Header */}
      <div style={{
        height: '56px',
        borderBottom: '1px solid var(--border-color)',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'var(--bg-secondary)',
        gap: '16px',
      }}>
        {/* Left side: Navigation & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: 600, fontSize: '18px' }}>
            <CalendarIcon size={22} color="var(--brand-primary)" />
            <span>Calendar</span>
          </div>

          <div style={{ height: '20px', width: '1px', backgroundColor: 'var(--border-color)' }} />

          <button
            onClick={handleToday}
            className="teams-btn teams-btn-secondary"
            style={{ fontSize: '13px', padding: '4px 12px', height: '32px' }}
          >
            Today
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <button
              onClick={handlePrev}
              className="teams-btn teams-btn-secondary"
              style={{ width: '32px', height: '32px', padding: 0 }}
              title="Previous"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={handleNext}
              className="teams-btn teams-btn-secondary"
              style={{ width: '32px', height: '32px', padding: 0 }}
              title="Next"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {getHeaderTitle()}
          </div>

          {/* Direct Date Picker Jump */}
          <input
            type="date"
            aria-label="Select Date"
            value={`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`}
            onChange={handleDateSelect}
            style={{
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              padding: '3px 8px',
              fontSize: '12px',
              outline: 'none',
              cursor: 'pointer',
            }}
          />
        </div>

        {/* Right side: Action Buttons & View Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Meet Now */}
          <button
            onClick={() => {
              setMeetNowTitle(`Instant Meeting - ${user?.first_name || user?.username || 'Host'}`);
              setIsMeetNowOpen(true);
            }}
            className="teams-btn teams-btn-secondary"
            style={{ height: '34px', fontSize: '13px' }}
          >
            <Video size={16} color="var(--brand-primary)" />
            <span>Meet now</span>
          </button>

          {/* Join with an ID */}
          <button
            onClick={() => {
              setJoinMeetingId('');
              setJoinPasscode('');
              setIsJoinWithIdOpen(true);
            }}
            className="teams-btn teams-btn-secondary"
            style={{ height: '34px', fontSize: '13px' }}
          >
            <Hash size={16} />
            <span>Join with an ID</span>
          </button>

          {/* New meeting button */}
          <button
            onClick={() => openNewMeetingModal()}
            className="teams-btn teams-btn-primary"
            style={{ height: '34px', fontSize: '13px', fontWeight: 600 }}
          >
            <Plus size={16} />
            <span>New meeting</span>
          </button>

          <div style={{ height: '20px', width: '1px', backgroundColor: 'var(--border-color)' }} />

          {/* View Selector (Day / Work week / Month) */}
          <div style={{
            display: 'flex',
            backgroundColor: 'var(--bg-tertiary)',
            borderRadius: '4px',
            padding: '2px',
            border: '1px solid var(--border-color)',
          }}>
            <button
              onClick={() => setViewMode('day')}
              style={{
                background: viewMode === 'day' ? 'var(--brand-primary)' : 'transparent',
                color: viewMode === 'day' ? '#ffffff' : 'var(--text-secondary)',
                border: 'none',
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: viewMode === 'day' ? 600 : 400,
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            >
              Day
            </button>
            <button
              onClick={() => setViewMode('work_week')}
              style={{
                background: viewMode === 'work_week' ? 'var(--brand-primary)' : 'transparent',
                color: viewMode === 'work_week' ? '#ffffff' : 'var(--text-secondary)',
                border: 'none',
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: viewMode === 'work_week' ? 600 : 400,
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            >
              Work week
            </button>
            <button
              onClick={() => setViewMode('month')}
              style={{
                background: viewMode === 'month' ? 'var(--brand-primary)' : 'transparent',
                color: viewMode === 'month' ? '#ffffff' : 'var(--text-secondary)',
                border: 'none',
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: viewMode === 'month' ? 600 : 400,
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* Global Error Banner if any */}
      {actionError && (
        <div style={{
          padding: '8px 20px',
          backgroundColor: 'rgba(196, 49, 75, 0.15)',
          borderBottom: '1px solid var(--danger)',
          color: '#ff6b6b',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            style={{ background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main Calendar View Area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          {/* VIEW 1 & 2: DAY & WORK WEEK (24-Hour Timeline Ruler) */}
        {(viewMode === 'day' || viewMode === 'work_week') && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Column Headers (Days) */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
            }}>
              {/* Ruler header corner */}
              <div style={{
                width: '64px',
                minWidth: '64px',
                borderRight: '1px solid var(--border-color)',
                padding: '12px 8px',
                fontSize: '11px',
                color: 'var(--text-muted)',
                textAlign: 'center',
              }}>
                GMT
              </div>

              {/* Day headers */}
              {(viewMode === 'day' ? [currentDate] : workWeekDays).map((day, idx) => {
                const isToday = isSameDay(day, now);
                const isSelected = isSameDay(day, currentDate);
                return (
                  <div
                    key={idx}
                    onClick={() => setCurrentDate(day)}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRight: idx < (viewMode === 'day' ? 0 : 4) ? '1px solid var(--border-color)' : 'none',
                      backgroundColor: isSelected ? 'rgba(91, 95, 199, 0.08)' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span style={{ fontSize: '13px', color: isToday ? 'var(--brand-primary)' : 'var(--text-secondary)', fontWeight: 500 }}>
                      {day.toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: isToday ? 'var(--brand-primary)' : 'transparent',
                      color: isToday ? '#ffffff' : 'var(--text-primary)',
                      fontSize: '15px',
                      fontWeight: isToday ? 700 : 500,
                    }}>
                      {day.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Scrollable 24-Hour Timeline Grid */}
            <div
              ref={timeGridScrollRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                position: 'relative',
                display: 'flex',
              }}
            >
              {/* 24-Hour Left Ruler (00:00 through 23:00) */}
              <div style={{
                width: '64px',
                minWidth: '64px',
                borderRight: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                userSelect: 'none',
              }}>
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    style={{
                      height: `${HOUR_HEIGHT}px`,
                      borderBottom: '1px solid var(--border-color)',
                      padding: '4px 8px',
                      textAlign: 'right',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      boxSizing: 'border-box',
                    }}
                  >
                    {String(hour).padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {/* Day Columns Container */}
              <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
                {(viewMode === 'day' ? [currentDate] : workWeekDays).map((day, colIdx) => {
                  const isToday = isSameDay(day, now);
                  const daysMeetings = meetings.filter((m) => {
                    if (!m.scheduled_start) return false;
                    const mDate = new Date(m.scheduled_start);
                    return isSameDay(mDate, day);
                  });

                  return (
                    <div
                      key={colIdx}
                      style={{
                        flex: 1,
                        position: 'relative',
                        borderRight: colIdx < (viewMode === 'day' ? 0 : 4) ? '1px solid var(--border-color)' : 'none',
                        minWidth: '140px',
                      }}
                    >
                      {/* 24 Hour slot grid backgrounds (click to add meeting) */}
                      {HOURS.map((hour) => (
                        <div
                          key={hour}
                          onClick={() => openNewMeetingModal(day, hour)}
                          title={`Click to schedule a meeting at ${String(hour).padStart(2, '0')}:00 on ${day.toDateString()}`}
                          style={{
                            height: `${HOUR_HEIGHT}px`,
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            cursor: 'pointer',
                            transition: 'background-color 0.1s ease',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(91, 95, 199, 0.06)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                          }}
                        />
                      ))}

                      {/* Current Time Horizontal Line Marker if Today */}
                      {isToday && (
                        <div
                          style={{
                            position: 'absolute',
                            top: `${currentTimeTopOffset}px`,
                            left: 0,
                            right: 0,
                            height: '2px',
                            backgroundColor: '#c4314b',
                            zIndex: 10,
                            pointerEvents: 'none',
                          }}
                        >
                          <div style={{
                            position: 'absolute',
                            left: '-5px',
                            top: '-4px',
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: '#c4314b',
                          }} />
                        </div>
                      )}

                      {/* Render Scheduled Meeting Cards */}
                      {daysMeetings.map((m) => {
                        const start = new Date(m.scheduled_start!);
                        const end = m.scheduled_end ? new Date(m.scheduled_end) : new Date(start.getTime() + 60 * 60 * 1000);

                        const startMin = start.getHours() * 60 + start.getMinutes();
                        let durationMin = (end.getTime() - start.getTime()) / (60 * 1000);
                        if (durationMin < 25) durationMin = 25; // minimum readable height

                        const top = (startMin / 60) * HOUR_HEIGHT;
                        const height = (durationMin / 60) * HOUR_HEIGHT - 2;

                        return (
                          <div
                            key={m.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMeeting(m);
                            }}
                            style={{
                              position: 'absolute',
                              top: `${top}px`,
                              height: `${height}px`,
                              left: '4px',
                              right: '4px',
                              backgroundColor: 'rgba(91, 95, 199, 0.22)',
                              borderLeft: '4px solid var(--brand-primary)',
                              borderRadius: '4px',
                              padding: '6px 8px',
                              cursor: 'pointer',
                              overflow: 'hidden',
                              zIndex: 5,
                              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(91, 95, 199, 0.35)';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(91, 95, 199, 0.22)';
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {m.title}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                {formatTimeRange(m.scheduled_start, m.scheduled_end)}
                              </div>
                            </div>

                            {/* Quick Join on card hover/action */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: '4px' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleJoinExistingMeeting(m);
                                }}
                                className="teams-btn teams-btn-primary"
                                style={{
                                  fontSize: '11px',
                                  padding: '2px 8px',
                                  height: '24px',
                                  borderRadius: '3px',
                                }}
                              >
                                Join
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: FULL MONTH GRID */}
        {viewMode === 'month' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Weekday headers: Mon - Sun */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
            }}>
              {WEEKDAY_NAMES.map((name, i) => (
                <div
                  key={i}
                  style={{
                    padding: '10px 8px',
                    textAlign: 'center',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    borderRight: i < 6 ? '1px solid var(--border-color)' : 'none',
                  }}
                >
                  {name}
                </div>
              ))}
            </div>

            {/* Month Days Grid */}
            <div style={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gridAutoRows: '1fr',
              overflowY: 'auto',
              backgroundColor: 'var(--bg-primary)',
            }}>
              {getMonthDays().map((cell, idx) => {
                const isToday = isSameDay(cell.date, now);
                const dayMeetings = meetings.filter((m) => {
                  if (!m.scheduled_start) return false;
                  return isSameDay(new Date(m.scheduled_start), cell.date);
                });

                const isSelectedDay = isSameDay(cell.date, currentDate);

                return (
                  <div
                    key={idx}
                    onClick={() => setCurrentDate(cell.date)}
                    onDoubleClick={() => openNewMeetingModal(cell.date)}
                    style={{
                      borderRight: '1px solid var(--border-color)',
                      borderBottom: '1px solid var(--border-color)',
                      outline: isSelectedDay ? '2px solid var(--brand-primary)' : 'none',
                      outlineOffset: '-2px',
                      padding: '6px 8px',
                      display: 'flex',
                      flexDirection: 'column',
                      backgroundColor: cell.isCurrentMonth ? 'var(--bg-primary)' : 'rgba(0,0,0,0.15)',
                      cursor: 'pointer',
                      minHeight: '90px',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = cell.isCurrentMonth ? 'rgba(91, 95, 199, 0.04)' : 'rgba(0,0,0,0.2)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = cell.isCurrentMonth ? 'var(--bg-primary)' : 'rgba(0,0,0,0.15)';
                    }}
                  >
                    {/* Day number */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: isToday ? 'var(--brand-primary)' : 'transparent',
                        color: isToday ? '#ffffff' : cell.isCurrentMonth ? 'var(--text-primary)' : 'var(--text-muted)',
                        fontSize: '12px',
                        fontWeight: isToday ? 700 : 500,
                      }}>
                        {cell.date.getDate()}
                      </span>
                    </div>

                    {/* Day events pills */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflowY: 'auto' }}>
                      {dayMeetings.map((m) => {
                        const s = m.scheduled_start ? new Date(m.scheduled_start) : null;
                        const timeStr = s ? s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                        return (
                          <div
                            key={m.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMeeting(m);
                            }}
                            style={{
                              backgroundColor: 'rgba(91, 95, 199, 0.25)',
                              borderLeft: '3px solid var(--brand-primary)',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              fontSize: '11px',
                              color: 'var(--text-primary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              cursor: 'pointer',
                            }}
                            title={`${m.title} (${timeStr})`}
                          >
                            <span style={{ fontWeight: 600, marginRight: '4px', color: 'var(--brand-light)' }}>{timeStr}</span>
                            <span>{m.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>

        {/* Right Sidebar: Same-Day Scheduled Meetings */}
        <div style={{
          width: '320px',
          minWidth: '320px',
          borderLeft: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '16px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                {currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {selectedDateMeetings.length} {selectedDateMeetings.length === 1 ? 'meeting' : 'meetings'} scheduled
              </span>
            </div>
            <button
              onClick={() => openNewMeetingModal(currentDate)}
              className="teams-btn teams-btn-primary"
              style={{ padding: '4px 10px', fontSize: '12px' }}
              title="Schedule meeting on this day"
            >
              <Plus size={14} />
              <span>Add</span>
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {selectedDateMeetings.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '36px 12px', fontSize: '13px' }}>
                <CalendarIcon size={36} style={{ opacity: 0.35, margin: '0 auto 8px', display: 'block' }} />
                <p style={{ margin: 0, fontWeight: 600 }}>No meetings scheduled</p>
                <p style={{ margin: '4px 0 0', fontSize: '12px' }}>Click "Add" to schedule a meeting for this date.</p>
              </div>
            ) : (
              selectedDateMeetings.map((m) => {
                const startTime = m.scheduled_start ? new Date(m.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                const endTime = m.scheduled_end ? new Date(m.scheduled_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                const isLive = !m.is_ended && m.is_instant;

                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMeeting(m)}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-tertiary)',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.title}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: m.is_ended ? 'rgba(138, 138, 138, 0.2)' : isLive ? 'rgba(35, 123, 75, 0.2)' : 'rgba(91, 95, 199, 0.2)',
                        color: m.is_ended ? '#8a8a8a' : isLive ? '#237b4b' : 'var(--brand-light)',
                        fontWeight: 600,
                      }}>
                        {m.is_ended ? 'Ended' : isLive ? 'Live' : 'Scheduled'}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      🕒 {startTime} {endTime ? `- ${endTime}` : ''}
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                      Room ID: <code style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '1px 4px', borderRadius: '3px' }}>{m.room_name}</code>
                    </div>

                    {!m.is_ended && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJoinExistingMeeting(m);
                        }}
                        className="teams-btn teams-btn-primary"
                        style={{ width: '100%', padding: '6px 0', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        <Video size={14} />
                        <span>Join Meeting</span>
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ================= MODAL 1: JOIN WITH AN ID ================= */}
      {isJoinWithIdOpen && (
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
            width: '420px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '16px' }}>
                <Hash size={18} color="var(--brand-primary)" />
                <span>Join a meeting with an ID</span>
              </div>
              <button
                onClick={() => setIsJoinWithIdOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleJoinWithId} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                  Meeting ID or Room Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. room_a1b2c3d4 or UUID"
                  value={joinMeetingId}
                  onChange={(e) => setJoinMeetingId(e.target.value)}
                  className="teams-input"
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                  Meeting Passcode (if required)
                </label>
                <input
                  type="password"
                  placeholder="Optional passcode"
                  value={joinPasscode}
                  onChange={(e) => setJoinPasscode(e.target.value)}
                  className="teams-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsJoinWithIdOpen(false)}
                  className="teams-btn teams-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joinLoading}
                  className="teams-btn teams-btn-primary"
                >
                  {joinLoading ? 'Joining...' : 'Join meeting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: MEET NOW ================= */}
      {isMeetNowOpen && (
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
            width: '440px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '16px' }}>
                <Video size={18} color="var(--brand-primary)" />
                <span>Meet now</span>
              </div>
              <button
                onClick={() => setIsMeetNowOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                  Meeting Name
                </label>
                <input
                  type="text"
                  value={meetNowTitle}
                  onChange={(e) => setMeetNowTitle(e.target.value)}
                  className="teams-input"
                  placeholder="Instant Meeting"
                />
              </div>

              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Start an instant audio/video conference room now. You can invite other participants and share your screen once joined.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsMeetNowOpen(false)}
                  className="teams-btn teams-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartMeetNow}
                  disabled={meetNowLoading}
                  className="teams-btn teams-btn-primary"
                >
                  <Video size={16} />
                  <span>{meetNowLoading ? 'Starting...' : 'Start meeting'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: NEW / SCHEDULE MEETING ================= */}
      {isNewMeetingOpen && (
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
            width: '520px',
            maxHeight: '90vh',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            border: '1px solid var(--border-color)',
            overflowY: 'auto',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '16px' }}>
                <Plus size={18} color="var(--brand-primary)" />
                <span>New meeting</span>
              </div>
              <button
                onClick={() => setIsNewMeetingOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateMeeting} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                  Add title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Product Review & Sprint Sync"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="teams-input"
                  autoFocus
                />
              </div>

              {/* Date & Time range row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Start Date & Time
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().split('T')[0]}
                      value={newStartDate}
                      onChange={(e) => {
                        setNewStartDate(e.target.value);
                        if (!newEndDate) setNewEndDate(e.target.value);
                      }}
                      className="teams-input"
                      style={{ flex: 1.3 }}
                    />
                    <input
                      type="time"
                      required
                      value={newStartTime}
                      onChange={(e) => setNewStartTime(e.target.value)}
                      className="teams-input"
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    End Date & Time
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="date"
                      required
                      min={newStartDate || new Date().toISOString().split('T')[0]}
                      value={newEndDate}
                      onChange={(e) => setNewEndDate(e.target.value)}
                      className="teams-input"
                      style={{ flex: 1.3 }}
                    />
                    <input
                      type="time"
                      required
                      value={newEndTime}
                      onChange={(e) => setNewEndTime(e.target.value)}
                      className="teams-input"
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                  Passcode (optional)
                </label>
                <input
                  type="text"
                  placeholder="Optional passcode protection"
                  value={newPasscode}
                  onChange={(e) => setNewPasscode(e.target.value)}
                  className="teams-input"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="allowGuestCheck"
                  checked={newAllowGuest}
                  onChange={(e) => setNewAllowGuest(e.target.checked)}
                  style={{ accentColor: 'var(--brand-primary)', width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="allowGuestCheck" style={{ fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Allow guests without an account to join with display name
                </label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                  Meeting Description / Agenda
                </label>
                <textarea
                  rows={3}
                  placeholder="Share details or agenda for this meeting..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="teams-input"
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsNewMeetingOpen(false)}
                  className="teams-btn teams-btn-secondary"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  className="teams-btn teams-btn-primary"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 4: MEETING DETAILS & ACTIONS ================= */}
      {selectedMeeting && (
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
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {selectedMeeting.title}
              </div>
              <button
                onClick={() => setSelectedMeeting(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Date and time */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <Clock size={16} color="var(--brand-primary)" />
                <span>
                  {selectedMeeting.scheduled_start
                    ? `${new Date(selectedMeeting.scheduled_start).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} • ${formatTimeRange(selectedMeeting.scheduled_start, selectedMeeting.scheduled_end)}`
                    : 'Instant Meeting'}
                </span>
              </div>

              {/* Host info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <Users size={16} color="var(--brand-primary)" />
                <span>
                  Host: {selectedMeeting.host ? `${selectedMeeting.host.first_name || ''} ${selectedMeeting.host.last_name || ''}`.trim() || selectedMeeting.host.username : 'Unknown'}
                </span>
              </div>

              {/* Room Name / Meeting ID */}
              <div style={{
                backgroundColor: 'var(--bg-primary)',
                padding: '10px 14px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Meeting Room ID</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {selectedMeeting.room_name}
                  </div>
                </div>
                <button
                  onClick={() => copyToClipboard(selectedMeeting.room_name, selectedMeeting.id)}
                  className="teams-btn teams-btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                >
                  {copiedId === selectedMeeting.id ? <Check size={14} color="#237b4b" /> : <Copy size={14} />}
                  <span>{copiedId === selectedMeeting.id ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Passcode if present */}
              {selectedMeeting.passcode && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <Lock size={14} color="var(--warning)" />
                  <span>Passcode: <strong style={{ color: 'var(--text-primary)' }}>{selectedMeeting.passcode}</strong></span>
                </div>
              )}

              {/* Description if present */}
              {selectedMeeting.description && (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-primary)', padding: '10px', borderRadius: '4px' }}>
                  {selectedMeeting.description}
                </div>
              )}

              {/* Actions Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                {/* Host cancel meeting option */}
                {user && (selectedMeeting.host?.id === user.id || selectedMeeting.host?.username === user.username) ? (
                  <button
                    onClick={() => handleCancelMeeting(selectedMeeting.id)}
                    className="teams-btn teams-btn-secondary"
                    style={{ color: 'var(--danger)', fontSize: '12px', padding: '6px 10px' }}
                  >
                    <Trash2 size={14} />
                    <span>Cancel meeting</span>
                  </button>
                ) : <div />}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setSelectedMeeting(null)}
                    className="teams-btn teams-btn-secondary"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => handleJoinExistingMeeting(selectedMeeting)}
                    className="teams-btn teams-btn-primary"
                    style={{ fontWeight: 600 }}
                  >
                    <Video size={16} />
                    <span>Join</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
