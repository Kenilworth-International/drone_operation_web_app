import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearHrSupportSession,
  getHrSupportPhone,
  getHrSupportToken,
  hrSupportRequest,
  registerHrSupportUnauthorizedHandler,
  saveHrSupportSession,
  HR_SUPPORT_TOKEN_CREATED_AT_KEY,
} from '../api/hrSupportApi';
import { getNodeBackendUrl } from '../../../../api/services NodeJs/nodeBackendUrl';

const HrSupportAuthContext = createContext(null);

export function HrSupportAuthProvider({ children }) {
  const [token, setToken] = useState(() => getHrSupportToken());
  const [phone, setPhone] = useState(() => getHrSupportPhone());
  const [tokenCreatedAt, setTokenCreatedAt] = useState(
    () => localStorage.getItem(HR_SUPPORT_TOKEN_CREATED_AT_KEY) || null,
  );
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getHrSupportToken()));

  const logout = useCallback(() => {
    clearHrSupportSession();
    setToken(null);
    setPhone(null);
    setTokenCreatedAt(null);
    setIsAuthenticated(false);
  }, []);

  useEffect(() => {
    registerHrSupportUnauthorizedHandler(logout);
  }, [logout]);

  const login = useCallback((newToken, loginPhone, createdAt) => {
    saveHrSupportSession(newToken, loginPhone, createdAt || null);
    setToken(newToken);
    setPhone(loginPhone);
    setTokenCreatedAt(createdAt || null);
    setIsAuthenticated(true);
  }, []);

  const base = getNodeBackendUrl();

  const loginWithEligibility = useCallback(async (mobileNo) => {
    const res = await fetch(`${base}/api/public/login/hr-web-support`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile_no: mobileNo, system_code: 'dsms_hr' }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.message || 'Sign in failed. Please try again.');
      err.reason = data?.reason;
      throw err;
    }
    return data;
  }, [base]);

  const value = useMemo(
    () => ({
      token,
      phone,
      tokenCreatedAt,
      isAuthenticated,
      login,
      logout,
      loginWithEligibility,
      hrRequest: (path, options) => hrSupportRequest(path, token, options),
    }),
    [token, phone, tokenCreatedAt, isAuthenticated, login, logout, loginWithEligibility],
  );

  return <HrSupportAuthContext.Provider value={value}>{children}</HrSupportAuthContext.Provider>;
}

export function useHrSupportAuth() {
  const ctx = useContext(HrSupportAuthContext);
  if (!ctx) throw new Error('useHrSupportAuth must be used inside HrSupportAuthProvider');
  return ctx;
}
