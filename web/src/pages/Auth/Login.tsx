import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../state/AuthContext';
import { api } from '../../services/api';
import { Eye, EyeOff, Video, ShieldCheck, Mail, Lock } from 'lucide-react';
import { FirstTimeSetupModal } from './FirstTimeSetupModal';
import { JoinMeetingModal } from './JoinMeetingModal';

declare global {
  interface Window {
    google?: any;
  }
}

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [context, setContext] = useState<'work' | 'personal'>('work');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [googleClientId, setGoogleClientId] = useState<string>('');
  const [googleReady, setGoogleReady] = useState(false);
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isJoinMeetingOpen, setIsJoinMeetingOpen] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const resp = await api.post<any>('/api/v1/auth/login/', {
        email: email.trim(),
        password,
        context: 'work',
      });

      await login(resp);
      navigate('/chat');
    } catch (err: any) {
      if (err.message && err.message.includes('first-time setup')) {
        setIsSetupOpen(true);
      }
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredentialResponse = async (response: any) => {
    if (!response || !response.credential) {
      setError('Google sign-in did not return a valid credential.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const resp = await api.post<any>('/api/v1/auth/google/', {
        id_token: response.credential,
        context: 'personal',
      });
      await login(resp);
      navigate('/chat');
    } catch (err: any) {
      setError(err.message || 'Google authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchConfig = async () => {
      try {
        const configResp = await api.get<{ client_id: string; configured: boolean }>('/api/v1/auth/google/config/');
        const cid = configResp.client_id || (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || '';
        if (isMounted && cid) {
          setGoogleClientId(cid);
        }
      } catch {
        const cid = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || '';
        if (isMounted && cid) {
          setGoogleClientId(cid);
        }
      }
    };
    fetchConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!googleClientId) return;

    let isMounted = true;
    let timer: any = null;

    const initGsi = () => {
      if (!isMounted) return;
      if (window.google?.accounts?.id && googleBtnContainerRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
          });

          // Clear any nodes in this dedicated DOM container (safe because React has no children inside it)
          googleBtnContainerRef.current.innerHTML = '';

          window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
            theme: 'outline',
            size: 'large',
            type: 'standard',
            shape: 'rectangular',
            text: 'continue_with',
            logo_alignment: 'left',
            width: 368,
          });

          if (isMounted) {
            setGoogleReady(true);
          }
        } catch (e) {
          console.error('Failed to initialize Google Identity Services:', e);
        }
      } else if (isMounted) {
        timer = setTimeout(initGsi, 250);
      }
    };

    initGsi();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [googleClientId]);

  const handleGoogleSignInFallback = () => {
    setError('');
    if (!googleClientId) {
      setError('Google OAuth is not configured on the server. Please ensure GOOGLE_CLIENT_ID is set in the backend environment.');
      return;
    }
    if (!window.google?.accounts?.id) {
      setError('Google Identity Services library failed to load or is blocked by your browser extensions.');
      return;
    }
    try {
      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          const reason = notification.getNotDisplayedReason?.() || notification.getSkippedReason?.() || '';
          if (reason === 'opt_out_or_no_session') {
            setError('Please sign into your Google account in this browser to continue with Google.');
          }
        }
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to open Google Sign-In.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      backgroundColor: '#f3f4f8', // Light, subtle background for authentication
      color: '#242424',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
    }}>
      {/* Centred Login Card */}
      <div style={{
        backgroundColor: '#ffffff',
        width: '100%',
        maxWidth: '440px',
        borderRadius: '12px',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
        border: '1px solid #e1e4ea',
        padding: '36px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* LetsConnect Branding */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            backgroundColor: '#5b5fc7',
            borderRadius: '10px',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '22px',
            marginBottom: '12px',
          }}>
            LC
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f1f1f', letterSpacing: '-0.3px' }}>
            LetsConnect
          </h1>
          <p style={{ fontSize: '13px', color: '#616161', marginTop: '4px', fontWeight: 500 }}>
            Empower Your Future With Expertise
          </p>
        </div>

        {/* Heading */}
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#242424' }}>
            Welcome back
          </h2>
          <p style={{ fontSize: '13px', color: '#616161', marginTop: '2px' }}>
            Sign in to access your collaboration workspace
          </p>
        </div>

        {/* Error notification */}
        {error && (
          <div style={{
            backgroundColor: '#fde7e9',
            color: '#c4314b',
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '13px',
            marginBottom: '18px',
            border: '1px solid #f8b4bc',
          }}>
            {error}
          </div>
        )}

        {/* Work Account Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#f5f6fa',
          padding: '8px 12px',
          borderRadius: '6px',
          marginBottom: '18px',
          border: '1px solid #e1e4ea',
        }}>
          <ShieldCheck size={16} color="#5b5fc7" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#323130' }}>
            Work Account Sign-In
          </span>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#3b3b3b', marginBottom: '6px' }}>
              Email address
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                required
                className="teams-input"
                style={{
                  backgroundColor: '#f9f9fb',
                  color: '#242424',
                  borderColor: '#d1d1d6',
                  paddingLeft: '34px',
                  height: '38px',
                }}
                placeholder="e.g. employee@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Mail size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#757575' }} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#3b3b3b' }}>
                Password
              </label>
              <button
                type="button"
                onClick={() => setError('Password reset instructions: enter email in First-Time Setup to verify OTP and reset password.')}
                style={{ background: 'none', border: 'none', color: '#5b5fc7', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
              >
                Forgot password?
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="teams-input"
                style={{
                  backgroundColor: '#f9f9fb',
                  color: '#242424',
                  borderColor: '#d1d1d6',
                  paddingLeft: '34px',
                  paddingRight: '36px',
                  height: '38px',
                }}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Lock size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#757575' }} />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#757575',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="teams-btn teams-btn-primary"
            style={{
              height: '40px',
              fontSize: '14px',
              fontWeight: 600,
              backgroundColor: '#5b5fc7',
              borderRadius: '6px',
              marginTop: '4px',
            }}
          >
            {loading ? 'Signing in...' : 'Sign in to Work Account'}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', color: '#8a8a8a', fontSize: '12px' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e1e4ea' }} />
          <span style={{ padding: '0 10px', fontWeight: 500, color: '#616161' }}>or personal account</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e1e4ea' }} />
        </div>

        {/* Secondary Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Continue with Google */}
          {/* Dedicated container managed ONLY by Google Identity Services */}
          <div
            ref={googleBtnContainerRef}
            style={{
              display: googleReady ? 'flex' : 'none',
              justifyContent: 'center',
              minHeight: '38px',
              width: '100%',
            }}
          />

          {/* Fallback button managed strictly by React when GIS has not rendered */}
          {!googleReady && (
            <button
              type="button"
              onClick={handleGoogleSignInFallback}
              className="teams-btn"
              style={{
                backgroundColor: '#ffffff',
                color: '#3c4043',
                border: '1px solid #d1d5db',
                height: '38px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                width: '100%',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Continue with Google
            </button>
          )}

          {/* First-time account setup */}
          <button
            type="button"
            onClick={() => setIsSetupOpen(true)}
            className="teams-btn"
            style={{
              backgroundColor: '#f7f8fa',
              color: '#3b3b3b',
              border: '1px solid #e1e4ea',
              height: '38px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            <ShieldCheck size={16} color="#5b5fc7" />
            First-time work account setup
          </button>

          {/* Join a meeting */}
          <button
            type="button"
            onClick={() => setIsJoinMeetingOpen(true)}
            className="teams-btn"
            style={{
              backgroundColor: '#f7f8fa',
              color: '#3b3b3b',
              border: '1px solid #e1e4ea',
              height: '38px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            <Video size={16} color="#237b4b" />
            Join a meeting as guest
          </button>
        </div>
      </div>

      {/* Modals */}
      <FirstTimeSetupModal
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
        initialEmail={email}
        onSuccess={(activatedEmail) => {
          setEmail(activatedEmail);
          setError('');
        }}
      />

      <JoinMeetingModal
        isOpen={isJoinMeetingOpen}
        onClose={() => setIsJoinMeetingOpen(false)}
      />
    </div>
  );
};
