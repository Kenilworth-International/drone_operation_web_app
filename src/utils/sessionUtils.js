import { logout } from '../store/slices/authSlice';

let forceLogoutInProgress = false;

if (typeof window !== 'undefined') {
  forceLogoutInProgress = false;
}

export function clearAuthSessionStorage() {
  localStorage.removeItem('userData');
  localStorage.removeItem('token');
  localStorage.removeItem('activeLink');
  localStorage.removeItem('leftnav_expanded');
  localStorage.removeItem('leftnav_expanded_subitems');
}

export function resolveLogoutReason(error) {
  const payload = error?.data || {};
  const message = String(payload?.message || payload?.error || '').toLowerCase();
  if (payload?.code === 'ACCOUNT_DEACTIVATED' || message.includes('deactivat')) {
    return 'deactivated';
  }
  if (payload?.code === 'TOKEN_EXPIRED' || message.includes('expired')) {
    return 'session_expired';
  }
  if (payload?.code === 'UNAUTHORIZED' || message.includes('access denied')) {
    return 'session_expired';
  }
  return 'session_expired';
}

export function isSessionExpiredError(error) {
  if (!error) return false;
  const status = Number(error?.status);
  if (status === 401) return true;
  const payload = error?.data || {};
  const code = String(payload?.code || '').toUpperCase();
  const message = String(payload?.message || payload?.error || '').toLowerCase();
  return (
    code === 'TOKEN_EXPIRED' ||
    code === 'UNAUTHORIZED' ||
    message.includes('expired') ||
    message.includes('access denied') ||
    message.includes('invalid or expired token')
  );
}

export function isWingHubLandingRoute() {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash || '';
  const path = hash.replace(/^#/, '').split('?')[0].replace(/\/$/, '') || '/';
  return path === '/home' || path === 'home';
}

/**
 * Clear session and hard-navigate to login (full page reload resets Redux).
 */
export function redirectToLogin(reason = 'session_expired', dispatch = null) {
  if (forceLogoutInProgress) return;
  forceLogoutInProgress = true;
  clearAuthSessionStorage();

  try {
    dispatch?.(logout());
  } catch (_) {
    // ignore dispatch issues during hard redirect
  }

  sessionStorage.setItem('logoutReason', reason);
  window.location.replace(`/#/login?reason=${encodeURIComponent(reason)}`);
}

/**
 * Clear client session and send the user to login after a 401 from an authenticated API call.
 */
export function forceLogoutFromApi(api, error) {
  if (forceLogoutInProgress || !isSessionExpiredError(error)) return false;
  redirectToLogin(resolveLogoutReason(error), api?.dispatch);
  return true;
}

export function consumeLogoutReason() {
  const reason = sessionStorage.getItem('logoutReason');
  if (reason) sessionStorage.removeItem('logoutReason');
  return reason;
}

export function logoutReasonMessage(reason) {
  if (reason === 'deactivated') {
    return 'Your account has been deactivated. Please contact administration.';
  }
  if (reason === 'session_expired') {
    return 'Your session has expired. Please sign in again.';
  }
  return '';
}
