import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useHrSupportAuth } from './HrSupportAuthProvider';
import '../../../../styles/hrSupportShell.css';

const COUNTRY_CODE = '+94';

function sanitizePhone(text) {
  return text.replace(/\D/g, '').replace(/^0/, '').slice(0, 9);
}

function eligibilityError(reason, fallbackMessage) {
  if (reason === 'missing_employee_link') return 'Your account is not linked to employee records. Please contact administration.';
  if (reason === 'pending_approval') return 'Your account is pending approval.';
  if (reason === 'not_registered') return 'No internal account found for this mobile number.';
  if (reason === 'not_internal_user') return 'This account is marked as external.';
  return fallbackMessage || 'Not eligible for HR access.';
}

export default function HrSupportLogin() {
  const { isAuthenticated, login, loginWithEligibility } = useHrSupportAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/support/hr/home';

  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, navigate, from]);

  const handlePhoneChange = (e) => setPhone(sanitizePhone(e.target.value));

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (phone.length !== 9) {
      setError('Enter your 9-digit mobile number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await loginWithEligibility(phone);
      if (!res?.login_status || !res?.token) {
        setError(res?.message || 'Sign in failed. Please try again.');
        return;
      }
      login(res.token, phone, res.token_created_at || null);
      navigate(from, { replace: true });
    } catch (err) {
      setError(eligibilityError(err?.reason, err?.message));
    } finally {
      setLoading(false);
    }
  };

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

        <form onSubmit={handleSignIn} className="hrsup-login-form">
          <h2 className="hrsup-login-heading">Sign in</h2>
          <p className="hrsup-login-hint">
            Enter your registered mobile number. Same access rules as the mobile app — no OTP required on web.
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
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
