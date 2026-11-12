/** Stable palette for hierarchy field map coloring. */
const MAP_PALETTE = [
  '#0f766e',
  '#1d4ed8',
  '#b45309',
  '#be123c',
  '#7c3aed',
  '#047857',
  '#c2410c',
  '#0369a1',
  '#a21caf',
  '#4d7c0f',
  '#b91c1c',
  '#0e7490',
];

/**
 * Color dimension under the current map scope (matches card drill-down).
 * all → group, group → plantation, plantation → region, region → estate, estate → division
 */
export function colorDimensionForScope(scope) {
  switch (scope) {
    case 'all':
      return 'group';
    case 'group':
      return 'plantation';
    case 'plantation':
      return 'region';
    case 'region':
      return 'estate';
    case 'estate':
      return 'division';
    case 'division':
    default:
      return 'division';
  }
}

export function colorDimensionLabel(dimension) {
  if (dimension === 'group') return 'Groups';
  if (dimension === 'plantation') return 'Plantations';
  if (dimension === 'estate') return 'Estates';
  if (dimension === 'division') return 'Divisions';
  return 'Regions';
}

function dimensionKeys(dimension) {
  if (dimension === 'group') {
    return { idKey: 'group_id', nameKey: 'group_name', fallback: 'Unknown group' };
  }
  if (dimension === 'plantation') {
    return { idKey: 'plantation_id', nameKey: 'plantation_name', fallback: 'Unknown plantation' };
  }
  if (dimension === 'estate') {
    return { idKey: 'estate_id', nameKey: 'estate_name', fallback: 'Unknown estate' };
  }
  if (dimension === 'division') {
    return { idKey: 'division_id', nameKey: 'division_name', fallback: 'Unknown division' };
  }
  return { idKey: 'region_id', nameKey: 'region_name', fallback: 'Unknown region' };
}

export function colorForMapKey(id) {
  const n = Number(id);
  if (!Number.isFinite(n)) return MAP_PALETTE[0];
  const idx = Math.abs(Math.trunc(n)) % MAP_PALETTE.length;
  return MAP_PALETTE[idx];
}

export function buildMapLegend(fields, dimension = 'region') {
  const { idKey, nameKey, fallback } = dimensionKeys(dimension);
  const map = new Map();
  for (const f of fields || []) {
    const key = f[idKey] == null ? 'unknown' : String(f[idKey]);
    if (map.has(key)) continue;
    map.set(key, {
      id: f[idKey],
      name: f[nameKey] || fallback,
      color: colorForMapKey(f[idKey]),
    });
  }
  return Array.from(map.values()).sort((a, b) =>
    String(a.name).localeCompare(String(b.name))
  );
}

export function colorForField(field, dimension = 'region') {
  const { idKey } = dimensionKeys(dimension);
  return colorForMapKey(field?.[idKey]);
}

export function popupSecondaryLabel(field, dimension = 'region') {
  const { nameKey, fallback } = dimensionKeys(dimension);
  return field?.[nameKey] || fallback;
}
