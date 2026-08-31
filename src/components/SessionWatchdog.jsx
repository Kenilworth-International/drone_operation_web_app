import { useEffect } from 'react';
import { getNodeBackendUrl, getToken } from '../api/services NodeJs/nodeBackendConfig';
import { forceLogoutFromApi, isWingHubLandingRoute, redirectToLogin } from '../utils/sessionUtils';

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
      try {
        const response = await fetch(`${getNodeBackendUrl()}/api/feature-permissions/my-permissions`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });

        if (response.status === 401) {
          const data = await response.json().catch(() => ({}));
          if (isWingHubLandingRoute()) {
            window.setTimeout(() => redirectToLogin('session_expired', null), 1000);
          } else {
            forceLogoutFromApi(null, { status: 401, data });
          }
        }
      } catch (_) {
        // network blips should not force logout
      }
    };

    checkSession();
    const intervalId = window.setInterval(checkSession, SESSION_CHECK_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return null;
}
