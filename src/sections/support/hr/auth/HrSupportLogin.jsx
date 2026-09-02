import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useHrSupportAuth } from './HrSupportAuthProvider';
import { checkHrAppVersion } from '../api/hrSupportVersionApi';
import { getOtpBypassMobile, setOtpBypassMobileFromVersionCheck } from '../utils/otpBypassConfig';
import '../../../../styles/hrSupportShell.css';

const COUNTRY_CODE = '+94';

function sanitizePhone(text) {
  return text.replace(/\D/g, '').replace(/^0/, '').slice(0, 9);
}

function eligibilityError(reason) {
  if (reason === 'missing_employee_link') return 'Your account is not linked to employee records. Please contact administration.';
  if (reason === 'pending_approval') return 'Your account is pending approval.';
  if (reason === 'not_registered') return 'No internal account found for this mobile number.';
  if (reason === 'not_internal_user') return 'This account is marked as external.';
  return 'Not eligible for HR access.';
}

export default function HrSupportLogin() {
  const {
    isAuthenticated,
    login,
    checkEligibility,
    loginWithoutOtp,
    requestOtp,
    verifyOtp,
  } = useHrSupportAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/support/hr/home';
  const otpInputRef = useRef(null);

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, navigate, from]);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = setInterval(() => setResendSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  const handlePhoneChange = (e) => setPhone(sanitizePhone(e.target.value));

  const resolveOtpBypassMobile = async () => {
    let bypass = getOtpBypassMobile();
    if (bypass) return bypass;
    try {
      const versionResult = await checkHrAppVersion('android');
      setOtpBypassMobileFromVersionCheck(versionResult);
      bypass = getOtpBypassMobile();
    } catch {
      // Continue with OTP flow if version check fails.
    }
    return bypass;
  };

  const handleContinue = async (e) => {
    e.preventDefault();
    if (phone.length !== 9) {
      setError('Enter your 9-digit mobile number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const eligibility = await checkEligibility(phone);
      if (!eligibility?.eligible) {
        setError(eligibilityError(String(eligibility?.reason || '')));
        return;
      }

      const bypass = await resolveOtpBypassMobile();
      if (bypass && phone === bypass) {
        const loginRes = await loginWithoutOtp(phone);
        if (loginRes?.login_status === true && loginRes?.token) {
          login(loginRes.token, phone, loginRes.token_created_at || null, {
            name: loginRes.name,
            email: loginRes.email,
          });
          return;
        }
        setError(loginRes?.message || 'Test login failed. Ensure this mobile is registered and activated.');
        return;
      }

      const otpRes = await requestOtp(phone);
      if (otpRes?.status !== true) {
        setError(otpRes?.message || 'Failed to send OTP. Please try again.');
        return;
      }
      setResendSeconds(Number(otpRes?.cooldown_seconds || otpRes?.data?.cooldown_seconds || 60));
      setOtp('');
      setStep('otp');
      setTimeout(() => otpInputRef.current?.focus(), 150);
    } catch (err) {
      setError(err?.message || 'Login failed. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const otpVal = otp.trim();
    if (otpVal.length !== 6) {
      setError('Enter the 6-digit OTP');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await verifyOtp(phone, otpVal);
      if (!res?.login_status || !res?.token) {
        setError(res?.message || 'OTP verification failed. Please try again.');
        return;
      }
      login(res.token, phone, res.token_created_at || null, {
        name: res.name,
        email: res.email,
      });
    } catch (err) {
      setError(err?.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendSeconds > 0 || loading) return;
    setLoading(true);
    setError('');
    try {
      const otpRes = await requestOtp(phone);
      if (otpRes?.status === true) {
        setOtp('');
        setResendSeconds(Number(otpRes?.cooldown_seconds || otpRes?.data?.cooldown_seconds || 60));
      } else {
        setError(otpRes?.message || 'Failed to resend OTP.');
      }
    } catch (err) {
      setError(err?.message || 'Unable to resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  const otpDigits = otp.padEnd(6, ' ').split('').slice(0, 6);

  return (
    <div className="hrsup-login-page">
      <div className="hrsup-login-top">
        <div className="hrsup-login-top-badge">Internal access</div>
        <h1 className="hrsup-login-top-title">DSMS HR</h1>
        <p className="hrsup-login-top-sub">Employee self-service when mobile app is unavailable</p>
      </div>

      <div className="hrsup-login-sheet">
        <div className="hrsup-login-sheet-brand">
          <div className="hrsup-login-brand-icon">HR</div>
          <div>
            <div className="hrsup-login-brand-title">DSMS HR</div>
            <div className="hrsup-login-brand-sub">Employee self-service</div>
          </div>
        </div>

        {step === 'phone' ? (
          <form onSubmit={handleContinue} className="hrsup-login-form">
            <h2 className="hrsup-login-heading">Sign in</h2>
            <p className="hrsup-login-hint">
              Enter your registered mobile number. Same rules as the DSMS HR mobile app — the ICT test number in App Versions can skip OTP.
            </p>
            <div className="hrsup-login-field">
              <label className="hrsup-login-label" htmlFor="hrsup-phone">Mobile number</label>
              <div className="hrsup-login-phone-wrap">
                <span className="hrsup-login-country-code">{COUNTRY_CODE}</span>
                <span className="hrsup-login-divider" aria-hidden="true" />
                <input
                  id="hrsup-phone"
                  className="hrsup-login-input"
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="7XXXXXXXX"
                  maxLength={9}
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>
            {error && <p className="hrsup-login-error">{error}</p>}
            <button
              type="submit"
              className={`hrsup-login-btn${phone.length === 9 ? ' hrsup-login-btn--active' : ''}`}
              disabled={loading || phone.length !== 9}
            >
              {loading ? 'Checking…' : 'Continue'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="hrsup-login-form">
            <h2 className="hrsup-login-heading">Enter OTP</h2>
            <p className="hrsup-login-hint">
              Code sent to {COUNTRY_CODE} {phone}.{' '}
              <button type="button" className="hrsup-login-link" onClick={() => { setStep('phone'); setError(''); }}>
                Change number
              </button>
            </p>
            <div
              className="hrsup-login-otp-row"
              onClick={() => otpInputRef.current?.focus()}
              onKeyDown={() => {}}
              role="presentation"
            >
              {otpDigits.map((digit, idx) => (
                <span
                  key={idx}
                  className={`hrsup-login-otp-box${digit.trim() ? ' hrsup-login-otp-box--filled' : ''}`}
                >
                  {digit.trim() || ''}
                </span>
              ))}
            </div>
            <input
              id="hrsup-otp"
              ref={otpInputRef}
              className="hrsup-login-otp-hidden"
              type="tel"
              inputMode="numeric"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              disabled={loading}
              autoComplete="one-time-code"
              aria-label="One-time password"
              autoFocus
            />
            <div className="hrsup-login-otp-resend">
              {resendSeconds > 0 ? (
                <span className="hrsup-login-otp-resend-text">Resend in {resendSeconds}s</span>
              ) : (
                <button type="button" className="hrsup-login-link" onClick={handleResend} disabled={loading}>
                  Resend OTP
                </button>
              )}
            </div>
            {error && <p className="hrsup-login-error">{error}</p>}
            <button
              type="submit"
              className={`hrsup-login-btn${otp.trim().length === 6 ? ' hrsup-login-btn--active' : ''}`}
              disabled={loading || otp.trim().length !== 6}
            >
              {loading ? 'Verifying…' : 'Verify & continue'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
