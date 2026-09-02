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
  const [loginUser, setLoginUser] = useState(null);

  const logout = useCallback(() => {
    clearHrSupportSession();
    setToken(null);
    setPhone(null);
    setTokenCreatedAt(null);
    setLoginUser(null);
    setIsAuthenticated(false);
  }, []);

  useEffect(() => {
    registerHrSupportUnauthorizedHandler(logout);
  }, [logout]);

  const login = useCallback((newToken, loginPhone, createdAt, userSnapshot = null) => {
    saveHrSupportSession(newToken, loginPhone, createdAt || null);
    setToken(newToken);
    setPhone(loginPhone);
    setTokenCreatedAt(createdAt || null);
    setLoginUser(userSnapshot);
    setIsAuthenticated(true);
  }, []);

  const base = getNodeBackendUrl();

  const checkEligibility = useCallback(async (mobileNo) => {
    const res = await fetch(`${base}/api/public/hr-user-login-eligibility`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile_no: mobileNo, system_code: 'dsms_hr' }),
    });
    return res.json();
  }, [base]);

  const loginWithoutOtp = useCallback(async (mobileNo) => {
    const res = await fetch(`${base}/api/public/login/hr-dev`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile_no: mobileNo, system_code: 'dsms_hr' }),
    });
    return res.json();
  }, [base]);

  const requestOtp = useCallback(async (mobileNo) => {
    const res = await fetch(`${base}/api/public/login/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile_no: mobileNo, system_code: 'dsms_hr' }),
    });
    return res.json();
  }, [base]);

  const verifyOtp = useCallback(async (mobileNo, otp) => {
    const res = await fetch(`${base}/api/public/login/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile_no: mobileNo, otp, system_code: 'dsms_hr' }),
    });
    return res.json();
  }, [base]);

  const value = useMemo(
    () => ({
      token,
      phone,
      tokenCreatedAt,
      loginUser,
      isAuthenticated,
      login,
      logout,
      checkEligibility,
      loginWithoutOtp,
      requestOtp,
      verifyOtp,
      hrRequest: (path, options) => hrSupportRequest(path, token, options),
    }),
    [token, phone, tokenCreatedAt, loginUser, isAuthenticated, login, logout, checkEligibility, loginWithoutOtp, requestOtp, verifyOtp],
  );

  return <HrSupportAuthContext.Provider value={value}>{children}</HrSupportAuthContext.Provider>;
}

export function useHrSupportAuth() {
  const ctx = useContext(HrSupportAuthContext);
  if (!ctx) throw new Error('useHrSupportAuth must be used inside HrSupportAuthProvider');
  return ctx;
}
