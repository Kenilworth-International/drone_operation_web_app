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
    return {
      code,
      title,
      kind: 'policy',
      quota: Number(summary.entitlement ?? 0),
      used: Number(summary.used ?? 0),
      pending: Number(summary.pending ?? 0),
      available: Number(summary.available ?? 0),
    };
  }
  const row = balanceByCode.get(code);
  if (row) return { code, title, kind: 'balance', ...readBalanceRow(row) };
  return { code, title, kind: policyKey ? 'policy' : 'balance', quota: 0, used: 0, pending: 0, available: 0 };
}

/**
 * Leave Availability + Leave Policy.
 * Empty availability → no cards (HR must assign leave types first).
 */
export function buildEmployeeLeaveBalanceCards(
  leaveTypes = [],
  policySummary = null,
  balances = [],
  allowedLeaveTypeCodes = null,
) {
  const leaveTypeByCode = new Map();
  (leaveTypes || []).forEach((type) => {
    const code = String(type?.code || '').trim().toLowerCase();
    if (code) leaveTypeByCode.set(code, type);
  });

  const balanceByCode = new Map();
  (balances || []).forEach((row) => {
    const code = String(row?.leave_type_code || row?.code || '').trim().toLowerCase();
    if (code) balanceByCode.set(code, row);
  });

  const normalizedAccess = (allowedLeaveTypeCodes || [])
    .map((code) => String(code || '').trim().toLowerCase())
    .filter(Boolean);

  if (normalizedAccess.length === 0) {
    return [];
  }

  const cards = [];
  const seen = new Set();

  normalizedAccess.forEach((code) => {
    if (seen.has(code)) return;
    const type = leaveTypeByCode.get(code) || {
      code,
      name: POLICY_FALLBACK_TITLES[code] || balanceByCode.get(code)?.leaveTypeName || code,
    };
    const card = buildCardFromLeaveType(type, policySummary, balanceByCode);
    if (card) {
      cards.push(card);
      seen.add(code);
    }
  });

  balanceByCode.forEach((row, code) => {
    if (seen.has(code) || !normalizedAccess.includes(code)) return;
    const type = leaveTypeByCode.get(code) || {
      code,
      name: row?.leaveTypeName || row?.leave_type_name || code,
    };
    const card = buildCardFromLeaveType(type, policySummary, balanceByCode);
    if (card) {
      cards.push(card);
      seen.add(code);
    }
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
