import { getNodeBackendUrl } from '../api/services NodeJs/nodeBackendUrl';
import { ensureHttps } from './urlUtils';

/**
 * Public URL paths for Node uploads (mirrors dsms_backend_dev/shared/config/resourceLocations.js RESOURCE_URLS).
 * Base: getNodeBackendUrl() + path + /{filename}
 */
export const RESOURCE_URL_PATHS = {
  ACCIDENT_IMAGE: '/uploads/images/accident_image',
  ACCIDENT_VIDEO: '/uploads/images/accident_image',
  ACCIDENT_VOICE: '/uploads/images/accident_voice',
  USER_PROFILE_IMAGE: '/uploads/images/user',
  DJI_SCREEN_IMAGE: '/uploads/images/screen/dji',
  WAYPOINT_IMAGE: '/uploads/images/screen/waypoint',
  PILOT_IMAGE: '/uploads/images/screen/task',
  GROUP_LOGO_IMAGE: '/uploads/images/logo',
  HIERARCHY_MAP_IMAGE: '/uploads/images/hierarchy_maps',

  VEHICLE_DAY: '/uploads/vehicle_day',
  MAINTENANCE_REQUEST_IMAGE: '/uploads/maintenance_requests',
  TRANSACTION_IMAGE: '/uploads/transactions',

  EMPLOYEE_EDUCATION_CERTIFICATES: '/documents/employees/education_certificates',
  EMPLOYEE_BIRTH_CERTIFICATE: '/documents/employees/birth_certificate',
  EMPLOYEE_HEALTH_REPORT: '/documents/employees/health_report',
  EMPLOYEE_SERVICE_LETTERS: '/documents/employees/service_letters',
  EMPLOYEE_MARRIED_CERTIFICATE: '/documents/employees/married_certificate',
  EMPLOYEE_POLICE_REPORT: '/documents/employees/police_report',
  EMPLOYEE_GND_CERTIFICATE: '/documents/employees/gnd_certificate',
  EMPLOYEE_PHOTO: '/documents/employees/photos',
  EMPLOYEE_DOCUMENT: '/documents/employees/documents',

  VEHICLE_DRIVER_LICENSE_FRONT: '/documents/vehicles/driver_license_front',
  VEHICLE_DRIVER_LICENSE_BACK: '/documents/vehicles/driver_license_back',
  VEHICLE_REGISTRATION_DOCUMENT: '/documents/vehicles/registration',
  VEHICLE_REVENUE_LICENSE: '/documents/vehicles/revenue_license',
  VEHICLE_SMOKE_TEST: '/documents/vehicles/smoke_test',
  VEHICLE_INSURANCE: '/documents/vehicles/insurance',
  VEHICLE_IMAGE: '/documents/vehicles/vehicle_image',

  SUB_CATEGORY_IMAGE: '/uploads/sub_categories',
  SUB_SUB_CATEGORY_IMAGE: '/uploads/sub_sub_categories',

  QUOTATION_DOCUMENT: '/uploads/documents/quotations',
  LEAVE_ATTACHMENT: '/uploads/documents/leave_attachments',
  QA_BUG_REPORT_IMAGE: '/uploads/qa_bug_reports',
};

/** UI field keys → RESOURCE_URL_PATHS keys (employee registration / profile) */
export const EMPLOYEE_DOCUMENT_RESOURCE_TYPES = {
  educationCertificates: 'EMPLOYEE_EDUCATION_CERTIFICATES',
  birthCertificate: 'EMPLOYEE_BIRTH_CERTIFICATE',
  healthReport: 'EMPLOYEE_HEALTH_REPORT',
  serviceLetters: 'EMPLOYEE_SERVICE_LETTERS',
  marriedCertificate: 'EMPLOYEE_MARRIED_CERTIFICATE',
  policeReport: 'EMPLOYEE_POLICE_REPORT',
  gndCertificate: 'EMPLOYEE_GND_CERTIFICATE',
  employeePhoto: 'EMPLOYEE_PHOTO',
};

function normalizeBackendBaseUrl() {
  return String(getNodeBackendUrl() || '').replace(/\/$/, '');
}

function basename(filename) {
  const value = String(filename || '').trim();
  if (!value) return '';
  return value.split(/[/\\]/).pop();
}

/**
 * Build a full resource URL from type + filename.
 * @param {string} resourceType - Key from RESOURCE_URL_PATHS
 * @param {string} filename
 * @returns {string|null}
 */
export function getResourceUrl(resourceType, filename) {
  const resourcePath = RESOURCE_URL_PATHS[resourceType];
  const safeFilename = basename(filename);
  if (!resourcePath || !safeFilename) return null;
  return `${normalizeBackendBaseUrl()}${resourcePath}/${safeFilename}`;
}

/** Base URL for group logo images, e.g. .../uploads/images/logo/ */
export function getGroupLogoBaseUrl() {
  return `${normalizeBackendBaseUrl()}${RESOURCE_URL_PATHS.GROUP_LOGO_IMAGE}/`;
}

/**
 * Resolve API media values: full URLs pass through; filenames/relative paths map to Node storage.
 * @param {string} value
 * @param {string} resourceType
 * @returns {string|null}
 */
export function resolveMediaUrl(value, resourceType = 'ACCIDENT_IMAGE') {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return ensureHttps(trimmed);
  }
  const withoutLeadingSlash = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  if (withoutLeadingSlash.includes('/')) {
    return ensureHttps(`${normalizeBackendBaseUrl()}/${withoutLeadingSlash}`);
  }
  return getResourceUrl(resourceType, trimmed);
}

/**
 * When only a filename is known, try common transport/maintenance storage folders.
 * @param {string} filename
 * @param {string[]} [resourceTypes]
 * @returns {string[]}
 */
export function getFilenameResourceUrlCandidates(
  filename,
  resourceTypes = ['MAINTENANCE_REQUEST_IMAGE', 'VEHICLE_DAY', 'TRANSACTION_IMAGE']
) {
  const safeFilename = basename(filename);
  if (!safeFilename) return [];
  return resourceTypes
    .map((type) => getResourceUrl(type, safeFilename))
    .filter(Boolean);
}
