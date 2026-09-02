let cachedOtpBypassMobile = null;

function normalizeMobile(value) {
  const raw = String(value ?? '').replace(/\D/g, '').replace(/^0/, '').slice(0, 9);
  return /^\d{9}$/.test(raw) ? raw : null;
}

export function setOtpBypassMobileFromVersionCheck(result) {
  if (!result || result.otpBypassMobile === undefined) return;
  cachedOtpBypassMobile = normalizeMobile(result.otpBypassMobile);
}

export function getOtpBypassMobile() {
  return cachedOtpBypassMobile;
}
