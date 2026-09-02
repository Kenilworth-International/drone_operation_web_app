import { getNodeBackendUrl } from '../../../../api/services NodeJs/nodeBackendUrl';

export const HR_APP_ID = 'com.kenilworth.dsms_hr';
export const HR_APP_VERSION = '1.2';

export async function checkHrAppVersion(platform = 'android') {
  const base = getNodeBackendUrl();
  const res = await fetch(`${base}/api/public/app-version/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: HR_APP_ID,
      version: HR_APP_VERSION,
      platform,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!json?.status) {
    throw new Error(json?.message || 'Version check failed');
  }
  return json.data || {};
}
