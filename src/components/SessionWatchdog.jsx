import { useEffect } from 'react';
import { getNodeBackendUrl, getToken } from '../api/services NodeJs/nodeBackendConfig';
import { redirectToLogin, resolveLogoutReason } from '../utils/sessionUtils';

const SESSION_CHECK_MS = 2 * 60 * 1000;

/**
 * Periodically validates the bearer token so deactivated users are signed out
 * even when they are not triggering other API calls.
 */
export default function SessionWatchdog() {
  useEffect(() => {
    const token = getToken();
    if (!token) return undefined;

    let cancelled = false;

    const checkSession = async () => {
      if (cancelled) return;
      const activeToken = getToken();
      if (!activeToken) return;
      try {
        const response = await fetch(`${getNodeBackendUrl()}/api/feature-permissions/my-permissions`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${activeToken}`,
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });

        if (response.status === 401) {
          const data = await response.json().catch(() => ({}));
          redirectToLogin(resolveLogoutReason({ status: 401, data }), null);
        }
      } catch (_) {
        // network blips should not force logout
      }
    };

    checkSession();
    const intervalId = window.setInterval(checkSession, SESSION_CHECK_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') checkSession();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
