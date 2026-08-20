/**
 * Wings that may use Plans forecast (/home/create) and the Forecast left-nav item.
 * Must match `title` in navbarCategories.js exactly.
 */
export const FORECAST_ALLOWED_WING_TITLES = [
  'Strategic Planning and Monitoring wing',
  'Field Operations Wing',
  'Operation Digitalization & Digital Monitoring & Evaluation Wing',
  'Geo Spatial Management',
];

export const FORECAST_PATH = '/home/create';

export function normalizeWingTitle(wingTitle) {
  if (wingTitle == null || wingTitle === '') return null;
  const title = String(wingTitle).trim();
  return title === 'Management' ? 'Field Operations Wing' : title;
}

export function isForecastAllowedWing(wingTitle) {
  const normalized = normalizeWingTitle(wingTitle);
  if (!normalized) return false;
  return FORECAST_ALLOWED_WING_TITLES.includes(normalized);
}

/**
 * User may open forecast if any of the three wings is visible or has a granted child path.
 */
export function hasForecastWingAccess(visibility = {}, pathPermissions = {}, allCategoryPaths = {}) {
  return FORECAST_ALLOWED_WING_TITLES.some((title) => {
    if (visibility[title] === true) return true;
    const paths = allCategoryPaths[title] || [];
    return paths.some((p) => pathPermissions[p] === true);
  });
}

/**
 * Wings that may use Plan calendar (/home/opsroomPlanCalendar) and the Calendar left-nav item.
 * Geo Spatial Management is intentionally excluded.
 */
export const CALENDAR_ALLOWED_WING_TITLES = [
  'Strategic Planning and Monitoring wing',
  'Field Operations Wing',
  'Operation Digitalization & Digital Monitoring & Evaluation Wing',
  'Human Resource Management',
  'Administration Wing',
];

export const CALENDAR_PATH = '/home/opsroomPlanCalendar';
export const GEO_SPATIAL_WING_TITLE = 'Geo Spatial Management';
export const GEO_SPATIAL_DASHBOARD_PATH = '/home/geo-spatial/dashboard';
export const GEO_SPATIAL_WEATHER_PREDICTION_PATH = '/home/geo-spatial/weather-prediction';

export function isCalendarAllowedWing(wingTitle) {
  const normalized = normalizeWingTitle(wingTitle);
  if (!normalized) return false;
  return CALENDAR_ALLOWED_WING_TITLES.includes(normalized);
}

export function isGeoSpatialWing(wingTitle) {
  return normalizeWingTitle(wingTitle) === GEO_SPATIAL_WING_TITLE;
}

export function hasCalendarWingAccess(visibility = {}, pathPermissions = {}, allCategoryPaths = {}) {
  return CALENDAR_ALLOWED_WING_TITLES.some((title) => {
    if (visibility[title] === true) return true;
    const paths = allCategoryPaths[title] || [];
    return paths.some((p) => pathPermissions[p] === true);
  });
}

/**
 * Display metadata for wing hub cards (matches navbar category titles in navbarCategories.js).
 * Keys must match `title` strings exactly.
 */
export const WING_HUB_META = {
  'Strategic Planning and Monitoring wing': {
    abbr: 'SPMW',
    label: 'Strategic Planning & Monitoring Wing',
    color: '#1e3a5f',
  },
  'Field Operations Wing': {
    abbr: 'FOW',
    label: 'Field Operations Wing',
    color: '#0f766e',
  },
  'Operation Digitalization & Digital Monitoring & Evaluation Wing': {
    abbr: 'ODDME',
    label: 'Operation Digitalization & Digital Monitoring & Evaluation Wing',
    color: '#4b5563',
  },
  Finance: {
    abbr: 'FMW',
    label: 'Finance Management Wing',
    color: '#c67a2e',
  },
  'ICT Wing': {
    abbr: 'ICTW',
    label: 'Information Communication & Technology Wing',
    color: '#3b82c4',
  },
  'Human Resource Management': {
    abbr: 'HRMW',
    label: 'Human Resource Management Wing',
    color: '#6b4c8a',
  },
  'Administration Wing': {
    abbr: 'AW',
    label: 'Administration Wing',
    color: '#111827',
  },
  'Geo Spatial Management': {
    abbr: 'GSTW',
    label: 'GEO Spatial Technology Wing',
    color: '#5a2622',
  },
  'Fleet Management Wing': {
    abbr: 'FLMW',
    label: 'Fleet Management Wing',
    color: '#1e4d8c',
  },
  'Sales and Marketing Wing': {
    abbr: 'SMW',
    label: 'Sales and Marketing Wing',
    color: '#9a3412',
  },
};

/**
 * Resolve ?wing= query value to hub meta (for theming nav to match the wing card color).
 * @param {string|null|undefined} wingParam - Raw search param (still encoded)
 * @returns {{ title: string, abbr: string, label: string, color: string } | null}
 */
export function resolveWingNavTheme(wingParam) {
  if (wingParam == null || wingParam === '') return null;
  let title;
  try {
    title = decodeURIComponent(wingParam);
  } catch {
    return null;
  }
  const normalized = normalizeWingTitle(title);
  const meta = WING_HUB_META[normalized];
  if (!meta?.color) return null;
  return { title: normalized, ...meta };
}
