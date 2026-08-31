export function fieldUsableForMission(f, missionTypeId) {
  const mt = String(missionTypeId || '').toLowerCase();
  if (Number(f.activated) !== 1) return false;
  if (mt === 'spy') return Number(f.can_spray) === 1;
  if (mt === 'spd') return Number(f.can_spread) === 1;
  return false;
}

export function computeSelectedFieldArea(fields, selectedFieldIds) {
  let sum = 0;
  for (const f of fields || []) {
    if (selectedFieldIds.has(f.id)) sum += Number(f.area) || 0;
  }
  return sum;
}

export function getEstateAreaLimits(estate) {
  const minRaw = estate?.min_plan_size;
  const maxRaw = estate?.max_plan_size;
  const min = minRaw != null && minRaw !== '' ? Number(minRaw) : null;
  const max = maxRaw != null && maxRaw !== '' ? Number(maxRaw) : null;
  const hasAreaLimits =
    min != null && max != null && Number.isFinite(min) && Number.isFinite(max);
  return { min, max, hasAreaLimits };
}

export function isAreaWithinLimits(selectedSum, min, max, hasAreaLimits) {
  if (!hasAreaLimits) return true;
  return selectedSum >= min && selectedSum <= max;
}

export function formatAreaLimitsHint(min, max, selectedSum) {
  return `Estate limits: ${min}–${max} Ha (selected ${selectedSum.toFixed(2)} Ha)`;
}

export function groupFieldsByDivision(fields, divisions) {
  const map = new Map();
  for (const f of fields || []) {
    const div = Number(f.division) || 0;
    if (!map.has(div)) map.set(div, []);
    map.get(div).push(f);
  }
  if (divisions?.length) {
    return divisions
      .map((d) => ({
        id: d.id,
        label: d.division || `Division ${d.id}`,
        fields: map.get(Number(d.id)) || [],
      }))
      .filter((g) => g.fields.length > 0);
  }
  if (map.size === 0) return [];
  return [...map.entries()].map(([id, list]) => ({
    id,
    label: `Division ${id}`,
    fields: list,
  }));
}
