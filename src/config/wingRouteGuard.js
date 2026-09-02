/**
 * Enforce ?wing= on wing-scoped /home routes (legacy bookmarks without wing → hub).
 */

export const WING_HUB_PATH = '/home';

/** Old paths → canonical route (search/query preserved separately). */
export const LEGACY_HOME_PATH_ALIASES = {
  '/home/planActivateRequest': '/home/planActivateRequests',
};

/** Routes that may load without ?wing= */
const WING_EXEMPT_EXACT = new Set(['/home/comb']);

const WING_EXEMPT_PREFIXES = ['/home/plantation-dashboard'];

export function isWingHubLandingPath(pathname) {
  return pathname === WING_HUB_PATH || pathname === WING_HUB_PATH + '/';
}

export function isCombMode(search) {
  return new URLSearchParams(search || '').get('comb') === '1';
}

export function hasWingQuery(search) {
  const wing = new URLSearchParams(search || '').get('wing');
  return wing != null && String(wing).trim() !== '';
}

function isWingExemptPath(pathname) {
  if (WING_EXEMPT_EXACT.has(pathname)) return true;
  return WING_EXEMPT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * @returns {boolean} true when navigation must include ?wing=
 */
export function requiresWingQuery(pathname, search) {
  if (!pathname.startsWith(WING_HUB_PATH)) return false;
  if (isWingHubLandingPath(pathname)) return false;
  if (isWingExemptPath(pathname)) return false;
  if (isCombMode(search)) return false;
  return true;
}

export function resolveLegacyHomePath(pathname) {
  return LEGACY_HOME_PATH_ALIASES[pathname] || null;
}

/** Routes where ?employee= is meaningful (deep-link to selected employee). */
const EMPLOYEE_QUERY_ROUTE_PREFIXES = [
  '/home/employeeProfileDetails',
  '/home/employees',
  '/home/employeeAssignment',
];

export function isEmployeeQueryRoute(pathname) {
  if (!pathname) return false;
  return EMPLOYEE_QUERY_ROUTE_PREFIXES.some(
    (base) => pathname === base || pathname.startsWith(`${base}/`),
  );
}

/** Preserve wing (and comb) when navigating in-app. */
export function withCurrentWingSearch(pathname, currentSearch, currentPathname = '') {
  const params = new URLSearchParams(currentSearch || '');
  const next = new URLSearchParams();
  const wing = params.get('wing');
  if (wing != null && String(wing).trim() !== '') {
    next.set('wing', wing);
  }
  if (params.get('comb') === '1') {
    next.set('comb', '1');
  }
  const employee = params.get('employee');
  if (
    employee
    && isEmployeeQueryRoute(pathname)
    && isEmployeeQueryRoute(currentPathname)
  ) {
    next.set('employee', employee);
  }
  const q = next.toString();
  return q ? { pathname, search: `?${q}` } : { pathname };
}

/** Remove route-specific query keys when the current path does not use them. */
export function sanitizeSearchForPath(pathname, search) {
  const params = new URLSearchParams(search || '');
  let changed = false;
  if (!isEmployeeQueryRoute(pathname) && params.has('employee')) {
    params.delete('employee');
    changed = true;
  }
  if (!changed) return search || '';
  const q = params.toString();
  return q ? `?${q}` : '';
}
