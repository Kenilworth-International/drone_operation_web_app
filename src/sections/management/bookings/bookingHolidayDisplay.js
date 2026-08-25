const HOLIDAY_TYPES = new Set(['mercantile', 'poya', 'special']);

export function extractHolidayRows(holidayResponse) {
  if (Array.isArray(holidayResponse?.data)) return holidayResponse.data;
  if (Array.isArray(holidayResponse)) return holidayResponse;
  return [];
}

export function buildHolidayMetaByDate(rows) {
  const map = {};
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = String(row?.holiday_date || '').slice(0, 10);
    if (!key) return;
    const type = String(row?.holiday_type || '').toLowerCase();
    if (!HOLIDAY_TYPES.has(type)) return;
    map[key] = {
      type,
      description: row.description != null ? String(row.description).trim() : '',
    };
  });
  return map;
}

export function holidayTypeShortLabel(type) {
  if (type === 'mercantile') return 'Statutory';
  if (type === 'poya') return 'Poya';
  if (type === 'special') return 'Special';
  return 'Holiday';
}

export function holidayTypeFullLabel(type) {
  if (type === 'mercantile') return 'Statutory holiday';
  if (type === 'poya') return 'Poya holiday';
  if (type === 'special') return 'Special holiday';
  return 'Holiday';
}

export function holidayCellClass(type) {
  if (!HOLIDAY_TYPES.has(type)) return '';
  return `booking-calender-day-holiday booking-calender-day-holiday-${type}`;
}

export function holidayHoverText(meta) {
  if (!meta?.type) return '';
  const kind = holidayTypeFullLabel(meta.type);
  return meta.description ? `${kind}: ${meta.description}` : kind;
}
