const POLICY_CODE_TO_KEY = {
  annual_leave: 'annual',
  casual_leave: 'casual',
  sick_leave: 'sick',
};

const POLICY_FALLBACK_TITLES = {
  annual_leave: 'Annual Leave',
  casual_leave: 'Casual Leave',
  sick_leave: 'Sick Leave',
};

function readBalanceRow(row) {
  const opening = Number(row?.opening_balance ?? row?.openingBalance ?? 0);
  const allocated = Number(row?.allocated ?? 0);
  const carryForward = Number(row?.carry_forward ?? row?.carryForward ?? 0);
  const used = Number(row?.used ?? 0);
  const pending = Number(row?.pending ?? 0);
  const quota = opening + allocated + carryForward;
  const available = Math.max(0, quota - used - pending);
  return { quota, used, pending, available };
}

function buildCardFromLeaveType(type, policySummary, balanceByCode) {
  const code = String(type?.code || '').trim().toLowerCase();
  if (!code) return null;
  const title = String(type?.name || type?.leaveTypeName || POLICY_FALLBACK_TITLES[code] || code);
  const policyKey = POLICY_CODE_TO_KEY[code];
  if (policyKey && policySummary?.[policyKey]) {
    const summary = policySummary[policyKey];
    return { code, title, kind: 'policy', quota: Number(summary.entitlement ?? 0), used: Number(summary.used ?? 0), pending: Number(summary.pending ?? 0), available: Number(summary.available ?? 0) };
  }
  const row = balanceByCode.get(code);
  if (row) return { code, title, kind: 'balance', ...readBalanceRow(row) };
  return { code, title, kind: policyKey ? 'policy' : 'balance', quota: 0, used: 0, pending: 0, available: 0 };
}

export function buildEmployeeLeaveBalanceCards(leaveTypes = [], policySummary = null, balances = []) {
  const balanceByCode = new Map();
  (balances || []).forEach((row) => {
    const code = String(row?.leave_type_code || row?.code || '').trim().toLowerCase();
    if (code) balanceByCode.set(code, row);
  });

  if (leaveTypes.length > 0) {
    return leaveTypes.map((type) => buildCardFromLeaveType(type, policySummary, balanceByCode)).filter(Boolean);
  }

  const cards = [];
  Object.entries(POLICY_CODE_TO_KEY).forEach(([code, key]) => {
    const summary = policySummary?.[key];
    if (!summary) return;
    cards.push({ code, title: POLICY_FALLBACK_TITLES[code] || code, kind: 'policy', quota: Number(summary.entitlement ?? 0), used: Number(summary.used ?? 0), pending: Number(summary.pending ?? 0), available: Number(summary.available ?? 0) });
  });
  const policyCodes = new Set(Object.keys(POLICY_CODE_TO_KEY));
  (balances || []).forEach((row) => {
    const code = String(row?.leave_type_code || row?.code || '').trim().toLowerCase();
    if (!code || policyCodes.has(code)) return;
    cards.push({ code, title: String(row?.leaveTypeName || row?.leave_type_name || code), kind: 'balance', ...readBalanceRow(row) });
  });
  return cards;
}

export function sumLeaveBalanceTotals(cards) {
  return cards.reduce((acc, card) => ({
    used: acc.used + Number(card.used || 0),
    pending: acc.pending + Number(card.pending || 0),
    available: acc.available + Number(card.available || 0),
  }), { used: 0, pending: 0, available: 0 });
}
