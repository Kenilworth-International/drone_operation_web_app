export const DEFAULT_MAX_CHEMICAL_KG_PER_HA = 12;

export function isSpreadMission(missionTypeId) {
  return String(missionTypeId || '').toLowerCase() === 'spd';
}

export function isChemicalAllowanceEnforced(missionTypeId) {
  return !isSpreadMission(missionTypeId);
}

export function filterChemicalsForMission(catalog, missionTypeId) {
  const mt = String(missionTypeId || '').toLowerCase();
  if (mt !== 'spy' && mt !== 'spd') return catalog;
  return (catalog || []).filter((c) => String(c.category || '').toLowerCase() === mt);
}

export function sumChemicalKgPerHa(lines) {
  let total = 0;
  for (const line of lines || []) {
    const id = Number(line.chemicalId);
    const qty = Number(line.quantity);
    if (id > 0 && Number.isFinite(qty) && qty > 0) total += qty;
  }
  return total;
}

export function getMaxChemicalKgPerHa(plantation, missionTypeId) {
  if (!isChemicalAllowanceEnforced(missionTypeId)) return null;
  const n = Number(plantation?.spray_max_chemical);
  if (Number.isFinite(n) && n > 0) return n;
  return DEFAULT_MAX_CHEMICAL_KG_PER_HA;
}

export function getMissionBillingRate(plantation, missionTypeId) {
  const spread = isSpreadMission(missionTypeId);
  const rate = spread
    ? Number(plantation?.spread_rate)
    : Number(plantation?.spray_rate);
  return {
    rate: Number.isFinite(rate) ? rate : null,
  };
}

export function computeOverageCharge(rate, totalKgPerHa, maxKgPerHa) {
  if (
    maxKgPerHa == null ||
    !Number.isFinite(maxKgPerHa) ||
    maxKgPerHa <= 0 ||
    rate == null ||
    !Number.isFinite(rate) ||
    totalKgPerHa <= maxKgPerHa
  ) {
    return null;
  }
  return (rate / maxKgPerHa) * totalKgPerHa;
}

export function formatCharge(n) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}
