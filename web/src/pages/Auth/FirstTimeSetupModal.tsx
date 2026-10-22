import React, { useState } from 'react';
import { api } from '../../services/api';
import { X, CheckCircle2, ShieldCheck, Key } from 'lucide-react';

interface FirstTimeSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
  onSuccess: (email: string) => void;
}

export const FirstTimeSetupModal: React.FC<FirstTimeSetupModalProps> = ({
  isOpen,
  onClose,
  initialEmail = '',
  onSuccess,
}) => {
  const [step, setStep] = useState<'check' | 'otp' | 'password' | 'done'>('check');
  const [email, setEmail] = useState(initialEmail);
  const [orgName, setOrgName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const checkResp = await api.post<any>('/api/v1/auth/work-setup-check/', { email: email.trim() });
      setOrgName(checkResp.organization_name);

      // Send OTP
      const otpResp = await api.post<any>('/api/v1/auth/send-otp/', {
        email: email.trim(),
        purpose: 'work_setup',
      });

      if (otpResp.debug_code) {
        setDebugOtp(otpResp.debug_code);
      }

      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Account not eligible or provisioned.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const resp = await api.post<any>('/api/v1/auth/verify-otp/', {
        email: email.trim(),
        code: otpCode.trim(),
        purpose: 'work_setup',
      });

      setResetToken(resp.reset_token);
      setStep('password');
    } catch (err: any) {
      setError(err.message || 'Invalid or expired OTP code.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await api.post<any>('/api/v1/auth/set-initial-password/', {
        email: email.trim(),
        reset_token: resetToken,
        password,
      });

      setStep('done');
    } catch (err: any) {
      setError(err.message || 'Failed to set password.');
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
        width: '440px',
        padding: '28px',
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '6px',
            backgroundColor: 'var(--brand-primary)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Work Account Setup</h2>
            <p style={{ fontSize: '12px', color: '#616161' }}>Activate account provisioned by Admin Centre</p>
          </div>
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

        {debugOtp && step === 'otp' && (
          <div style={{
            backgroundColor: '#e7f3fd',
            color: '#0f548c',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            marginBottom: '16px',
          }}>
            Demo/Dev Notice: Verification OTP code is <strong>{debugOtp}</strong>
          </div>
        )}

        {step === 'check' && (
          <form onSubmit={handleCheckEmail} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                Provisioned Work Email *
              </label>
              <input
                type="email"
                className="teams-input"
                style={{ backgroundColor: '#f9f9f9', color: '#242424', borderColor: '#d1d1d1' }}
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="teams-btn teams-btn-primary"
              style={{ padding: '10px' }}
            >
              {loading ? 'Validating Directory...' : 'Verify Work Account'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '13px', color: '#616161' }}>
              We found your employee profile at <strong>{orgName}</strong>. A 6-digit verification code has been dispatched to <strong>{email}</strong>.
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                6-Digit Verification Code *
              </label>
              <input
                type="text"
                maxLength={6}
                className="teams-input"
                style={{ backgroundColor: '#f9f9f9', color: '#242424', borderColor: '#d1d1d1', letterSpacing: '4px', fontSize: '18px', textAlign: 'center' }}
                placeholder="••••••"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="teams-btn teams-btn-primary"
              style={{ padding: '10px' }}
            >
              {loading ? 'Verifying Code...' : 'Confirm Verification Code'}
            </button>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={handleSetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '13px', color: '#616161' }}>
              Identity verified! Create your LetsConnect login password below.
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
                Create Password *
              </label>
              <input
                type="password"
                className="teams-input"
                style={{ backgroundColor: '#f9f9f9', color: '#242424', borderColor: '#d1d1d1' }}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
                Confirm Password *
              </label>
              <input
                type="password"
                className="teams-input"
                style={{ backgroundColor: '#f9f9f9', color: '#242424', borderColor: '#d1d1d1' }}
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="teams-btn teams-btn-primary"
              style={{ padding: '10px' }}
            >
              {loading ? 'Saving Password...' : 'Complete Account Setup'}
            </button>
          </form>
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <CheckCircle2 size={48} color="#237b4b" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Account Ready!</h3>
            <p style={{ fontSize: '13px', color: '#616161', marginBottom: '20px' }}>
              Your work account has been activated. You can now sign in with your email and new password.
            </p>
            <button
              type="button"
              onClick={() => {
                onSuccess(email);
                onClose();
              }}
              className="teams-btn teams-btn-primary"
              style={{ width: '100%', padding: '10px' }}
            >
              Proceed to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
