import { getNodeBackendUrl } from '../../../../api/services NodeJs/nodeBackendUrl';

export const HR_SUPPORT_TOKEN_KEY = 'dsms_hr_support_token';
export const HR_SUPPORT_PHONE_KEY = 'dsms_hr_support_phone';
export const HR_SUPPORT_TOKEN_CREATED_AT_KEY = 'dsms_hr_support_token_created_at';

let onUnauthorized = null;

export function registerHrSupportUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export function getHrSupportToken() {
  return localStorage.getItem(HR_SUPPORT_TOKEN_KEY) || null;
}

export function getHrSupportPhone() {
  return localStorage.getItem(HR_SUPPORT_PHONE_KEY) || null;
}

export function saveHrSupportSession(token, phone, tokenCreatedAt) {
  localStorage.setItem(HR_SUPPORT_TOKEN_KEY, token);
  if (phone) localStorage.setItem(HR_SUPPORT_PHONE_KEY, phone);
  if (tokenCreatedAt) localStorage.setItem(HR_SUPPORT_TOKEN_CREATED_AT_KEY, tokenCreatedAt);
}

export function clearHrSupportSession() {
  localStorage.removeItem(HR_SUPPORT_TOKEN_KEY);
  localStorage.removeItem(HR_SUPPORT_PHONE_KEY);
  localStorage.removeItem(HR_SUPPORT_TOKEN_CREATED_AT_KEY);
}

export async function hrSupportRequest(path, token, options = {}) {
  const base = getNodeBackendUrl();
  const activeToken = token || getHrSupportToken();
  if (!activeToken) {
    const err = new Error('Session expired. Please login again.');
    err.status = 401;
    err.isAuthError = true;
    throw err;
  }

  let res;
  try {
    res = await fetch(`${base}${path}`, {
      ...options,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeToken}`,
        ...(options.headers || {}),
      },
    });
  } catch (networkErr) {
    if (networkErr?.name === 'AbortError') {
      throw networkErr;
    }
    const err = new Error(
      networkErr?.message === 'Failed to fetch'
        ? `Unable to reach the server (${path}). Check your connection and try again.`
        : (networkErr?.message || 'Network request failed'),
    );
    err.isNetworkError = true;
    throw err;
  }

  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (res.status === 401) {
    if (onUnauthorized) await onUnauthorized();
    const err = new Error(String(json?.message || 'Session expired. Please login again.'));
    err.status = 401;
    err.isAuthError = true;
    throw err;
  }

  if (!res.ok || json?.status === false) {
    throw new Error(String(json?.error || json?.message || 'Request failed'));
  }
  return json?.data ?? json;
}

export async function hrSupportUpload(path, token, formData) {
  const base = getNodeBackendUrl();
  const activeToken = token || getHrSupportToken();
  if (!activeToken) {
    throw new Error('Session expired');
  }
  let res;
  try {
    res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${activeToken}` },
      body: formData,
      cache: 'no-store',
    });
  } catch (networkErr) {
    throw new Error(
      networkErr?.message === 'Failed to fetch'
        ? `Unable to reach the server (${path}). Check your connection and try again.`
        : (networkErr?.message || 'Network request failed'),
    );
  }
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  if (res.status === 401) {
    if (onUnauthorized) await onUnauthorized();
    throw new Error('Session expired');
  }
  if (!res.ok || json?.status === false) throw new Error(json?.message || 'Upload failed');
  return json?.data ?? json;
}
