/**
 * Authentication and Authorization Utilities
 * 
 * This file contains reusable functions for checking user permissions,
 * category visibility, and allowed paths based on user authentication levels.
 */
import navbarCategories from '../config/navbarCategories';
import {
  CALENDAR_PATH,
  FORECAST_PATH,
  hasCalendarWingAccess,
  hasForecastWingAccess,
} from '../config/wingHubDisplay';

/** Collect every routable path declared under a navbar category (including sub-items). */
export const collectCategoryPaths = (category) => {
  const paths = [];
  (category?.children || []).forEach((child) => {
    if (child?.path) paths.push(child.path);
    (child?.subItems || []).forEach((sub) => {
      if (sub?.path) paths.push(sub.path);
    });
  });
  return paths;
};

/**
 * Wing/category visibility from explicit path grants (matches Access Control Navigation Bar tab).
 * A wing is visible when the user has at least one granted path in that category.
 */
export const getCategoryVisibilityFromPaths = (pathPermissions = {}, categories = navbarCategories) => {
  return categories.reduce((acc, cat) => {
    const catPaths = collectCategoryPaths(cat);
    acc[cat.title] = catPaths.some((p) => pathPermissions[p] === true);
    return acc;
  }, {});
};

/**
 * True when every path in the category is explicitly granted (Entire Category checked in Auth Controls).
 */
export const getCategoryFullAccessFromPaths = (pathPermissions = {}, categories = navbarCategories) => {
  return categories.reduce((acc, cat) => {
    const catPaths = collectCategoryPaths(cat);
    acc[cat.title] = catPaths.length > 0 && catPaths.every((p) => pathPermissions[p] === true);
    return acc;
  }, {});
};

/**
 * Get category visibility based on user data and permissions
 * @param {Object} userData - User data object from localStorage
 * @param {Object} permissions - Permissions object (can be from Redux state or backend API)
 * @param {Array} categories - Array of category objects with title property
 * @param {Object} [pathPermissions] - When provided, path grants are the source of truth (Access Control)
 * @returns {Object} Object mapping category titles to boolean visibility
 */
export const getCategoryVisibility = (userData, permissions, categories, pathPermissions = null) => {
  const memberType = userData?.member_type || '';
  const userLevel = userData?.user_level || '';
  const jobRole = userData?.job_role || '';

  // Use the provided categories array to determine available category titles
  const categoryTitles = categories.map((c) => c.title);

  // ONLY Developers (internal with user_level = 'i' AND job_role = 'dev') get everything automatically
  // All other users must have permissions set in Access Control Management
  if (memberType === 'i' && userLevel === 'i' && jobRole === 'dev') {
    return categoryTitles.reduce((acc, title) => {
      acc[title] = true;
      return acc;
    }, {});
  }

  // Path grants from Access Control are authoritative for wing visibility
  if (pathPermissions && typeof pathPermissions === 'object') {
    return getCategoryVisibilityFromPaths(pathPermissions, categories);
  }

  // For all other users (including internal non-developers), use backend permissions only
  // Backend format: permissions[category] = true/false (boolean)
  // If no permissions object or category not found, default to false (no access)
  const result = categoryTitles.reduce((acc, title) => {
    // Check if permissions exist and category is explicitly granted
    if (permissions && permissions.hasOwnProperty(title)) {
      acc[title] = permissions[title] === true;
    } else {
      // No permission set = no access (default deny)
      acc[title] = false;
    }
    return acc;
  }, {});

  // Legacy ACL: stock/assets category; items now under Administration Wing
  if (
    permissions &&
    permissions['Stock and Assets Management'] === true &&
    Object.prototype.hasOwnProperty.call(result, 'Administration Wing')
  ) {
    result['Administration Wing'] = true;
  }

  // Legacy ACL: Fleet Management items moved under Administration Wing
  if (
    permissions &&
    permissions['Fleet Management'] === true &&
    Object.prototype.hasOwnProperty.call(result, 'Administration Wing')
  ) {
    result['Administration Wing'] = true;
  }

  // Legacy ACL: single "HR and Admin" category split into two nav groups
  if (permissions && permissions['HR and Admin'] === true) {
    if (Object.prototype.hasOwnProperty.call(result, 'Human Resource Management')) {
      result['Human Resource Management'] = true;
    }
    if (Object.prototype.hasOwnProperty.call(result, 'Administration Wing')) {
      result['Administration Wing'] = true;
    }
  }

  // Legacy ACL keys for ICT area (merged under ICT Wing)
  if (
    permissions &&
    permissions['ICT - System Admin'] === true &&
    Object.prototype.hasOwnProperty.call(result, 'ICT Wing')
  ) {
    result['ICT Wing'] = true;
  }
  if (
    permissions &&
    permissions['System Administration'] === true &&
    Object.prototype.hasOwnProperty.call(result, 'ICT Wing')
  ) {
    result['ICT Wing'] = true;
  }
  if (
    permissions &&
    permissions['ICT - Development'] === true &&
    Object.prototype.hasOwnProperty.call(result, 'ICT Wing')
  ) {
    result['ICT Wing'] = true;
  }

  // Legacy ACL: Central Operation Management renamed to Operation Digitalization & Digital Monitoring & Evaluation Wing
  if (
    permissions &&
    permissions['Central Operation Management'] === true &&
    Object.prototype.hasOwnProperty.call(result, 'Operation Digitalization & Digital Monitoring & Evaluation Wing')
  ) {
    result['Operation Digitalization & Digital Monitoring & Evaluation Wing'] = true;
  }

  // Legacy ACL: Management renamed to Field Operations Wing
  if (
    permissions &&
    permissions.Management === true &&
    Object.prototype.hasOwnProperty.call(result, 'Field Operations Wing')
  ) {
    result['Field Operations Wing'] = true;
  }

  return result;
};

/**
 * Get allowed paths based on category visibility and path-level permissions
 * @param {Object} visibility - Object mapping category titles to boolean visibility
 * @param {Object} pathPermissions - Object mapping paths to boolean permissions (from backend)
 * @param {Object} userData - User data object (optional, for developer check)
 * @returns {Array} Array of allowed path strings
 */
export const getAllowedPaths = (visibility = {}, pathPermissions = {}, userData = null) => {
  // Build allCategoryPaths dynamically from shared navbarCategories config
  const allCategoryPaths = {};
  const allDevPaths = ['/home/create', '/home/corporate-customers', CALENDAR_PATH];
  navbarCategories.forEach(cat => {
    const paths = [];
    (cat.children || []).forEach(child => {
      if (child.path) {
        paths.push(child.path);
        allDevPaths.push(child.path);
      }
      if (child.subItems) {
        child.subItems.forEach(sub => {
          if (sub.path) {
            paths.push(sub.path);
            allDevPaths.push(sub.path);
          }
        });
      }
    });
    allCategoryPaths[cat.title] = paths;
  });

  // If user is a developer, return all paths automatically
  if (userData && userData.member_type === 'i' && userData.user_level === 'i' && userData.job_role === 'dev') {
    return allDevPaths;
  }

  const allowedPaths = [];

  if (hasForecastWingAccess(visibility, pathPermissions, allCategoryPaths)) {
    allowedPaths.push(FORECAST_PATH);
  }

  if (hasCalendarWingAccess(visibility, pathPermissions, allCategoryPaths)) {
    allowedPaths.push(CALENDAR_PATH);
  }

  const mergedPathPermissions = { ...pathPermissions };
  if (mergedPathPermissions['/home/fleet-update'] === true) {
    mergedPathPermissions['/home/transport/hr'] = true;
  }
  if (mergedPathPermissions['/home/reports/finance'] === true) {
    mergedPathPermissions['/home/finance/work-summary'] = true;
  }

  // Check all paths - if path has explicit permission set to true, allow it
  Object.values(allCategoryPaths).flat().forEach(path => {
    if (mergedPathPermissions[path] === true && !allowedPaths.includes(path)) {
      allowedPaths.push(path);
    }
  });

  return allowedPaths;
};

/**
 * Check if user has access to a specific path
 * @param {string} path - Path to check
 * @param {Object} userData - User data object from localStorage
 * @param {Object} permissions - Permissions object from Redux state or backend
 * @param {Array} categories - Array of category objects with title property
 * @param {Object} pathPermissions - Object mapping paths to boolean permissions (from backend)
 * @returns {boolean} True if user has access to the path
 */
export const hasPathAccess = (path, userData, permissions, categories, pathPermissions = {}) => {
  const visibility = getCategoryVisibility(userData, permissions, categories, pathPermissions);
  const allowedPaths = getAllowedPaths(visibility, pathPermissions, userData);
  return allowedPaths.includes(path);
};

/**
 * Check if user is an internal developer/admin
 * @param {Object} userData - User data object from localStorage
 * @returns {boolean} True if user is internal developer/admin
 */
export const isInternalDeveloper = (userData) => {
  return userData?.member_type === 'i' && userData?.user_level === 'i' && userData?.job_role === 'dev';
};

/**
 * Check if user is an internal member
 * @param {Object} userData - User data object from localStorage
 * @returns {boolean} True if user is internal member
 */
export const isInternalMember = (userData) => {
  return userData?.member_type === 'i';
};

/**
 * Get user data from localStorage
 * @returns {Object} User data object or empty object
 */
export const getUserData = () => {
  try {
    const userDataStr = localStorage.getItem('userData');
    return userDataStr ? JSON.parse(userDataStr) : {};
  } catch (error) {
    console.error('Error parsing userData from localStorage:', error);
    return {};
  }
};

/**
 * Plantation calendar plan requests require Group, Plantation, Region, and Estate.
 * Users with only part of the hierarchy (e.g. no estate) cannot submit requests.
 * @param {Object} userData - Typically from getUserData()
 * @returns {boolean}
 */
/** null, 0, and '0' are the same — field not set (estate, region, etc.). */
const isUnsetHierarchyValue = (v) => {
  if (v == null || v === '' || v === false) return true;
  if (v === 0 || v === '0') return true;
  const s = String(v).trim().toLowerCase();
  if (s === '' || s === '0' || s === 'null' || s === 'undefined') return true;
  return false;
};

const hierarchyFieldSet = (userData, key) => {
  if (!userData) return false;
  return !isUnsetHierarchyValue(userData[key]);
};

/** Deepest hierarchy level on profile (calendar plan scope). */
export const getPlantationCalendarHierarchyLevel = (userData) => {
  if (!userData || typeof userData !== 'object') return 'none';
  if (hierarchyFieldSet(userData, 'estate')) return 'estate';
  if (hierarchyFieldSet(userData, 'region')) return 'region';
  if (hierarchyFieldSet(userData, 'plantation')) return 'plantation';
  if (hierarchyFieldSet(userData, 'group')) return 'group';
  return 'none';
};

const parsePositiveHierarchyId = (userData, key) => {
  if (!hierarchyFieldSet(userData, key)) return null;
  const n = parseInt(String(userData[key]).trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
};

/** Group, plantation, region, and estate — each valid id (0/null = not set). */
export const hasFullPlantationHierarchy = (userData) => {
  if (!userData || typeof userData !== 'object') return false;
  return (
    parsePositiveHierarchyId(userData, 'group') != null &&
    parsePositiveHierarchyId(userData, 'plantation') != null &&
    parsePositiveHierarchyId(userData, 'region') != null &&
    parsePositiveHierarchyId(userData, 'estate') != null
  );
};

export const getPlantationCalendarScopeDescription = (level, userData) => {
  const canRequest = userData ? hasFullPlantationHierarchy(userData) : false;
  switch (level) {
    case 'estate':
      return canRequest
        ? 'Showing plans for your estate. You can view plans and submit new plan requests.'
        : 'Showing plans for your estate.';
    case 'region':
      return 'Showing plans for your region.';
    case 'plantation':
      return 'Showing plans for your plantation.';
    case 'group':
      return 'Showing all plans under your group.';
    default:
      return 'Your profile is not linked to a group. Contact admin to view plans on the calendar.';
  }
};

export const hasHierarchyForPlantationPlanRequest = (userData) => {
  return hasFullPlantationHierarchy(userData);
};

/**
 * Get navbar color based on user type
 * @param {Object} userData - User data object from localStorage
 * @returns {string} Navbar color string
 */
export const getNavbarColor = (userData) => {
  const userType = userData?.member_type_name || '';

  switch (userType) {
    case 'Internal User':
      return 'darkblue';
    case 'manager':
      return 'green';
    case 'pilot':
      return 'blue';
    default:
      return 'green';
  }
};

