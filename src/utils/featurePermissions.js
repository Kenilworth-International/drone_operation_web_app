import { getUserData, isInternalDeveloper } from './authUtils';

/**
 * Feature Permission Utilities
 * Functions to check if a user has access to specific features
 */

/**
 * Get user's feature permissions from backend
 * @param {Object} userData - User data object from localStorage
 * @returns {Promise<Object>} Object mapping feature codes to boolean access
 */
export async function getUserFeaturePermissions(userData) {
  try {
    // Import dynamically to avoid circular dependencies
    const { featurePermissionsApi } = await import('../api/services NodeJs/featurePermissionsApi');
    const { getMyPermissions } = featurePermissionsApi.endpoints;
    
    // Get permissions from backend
    const result = await getMyPermissions.initiate().unwrap();
    
    // Convert to feature code mapping
    const permissions = {};
    if (result && typeof result === 'object') {
      // Backend returns permissions grouped by category
      // We need to check if user has access to specific features
      // For now, we'll use a simplified approach and check via API
      return result;
    }
    
    return permissions;
  } catch (error) {
    console.error('Error fetching user feature permissions:', error);
    return {};
  }
}

/**
 * Check if user has access to a specific feature
 * @param {string} featureCode - Feature code (e.g., 'FEAT_WORKFLOW_QUICK_EMERGENCY_MOVING')
 * @param {Object} userData - User data object from localStorage
 * @param {Object} featurePermissions - Optional cached permissions object
 * @returns {Promise<boolean>} True if user has access
 */
export async function hasFeatureAccess(featureCode, userData = null, featurePermissions = null) {
  // Get user data if not provided
  if (!userData) {
    userData = getUserData();
  }

  // Developers (internal + job_role dev): same rule as navbar — all feature flags allowed
  if (isInternalDeveloper(userData)) {
    return true;
  }

  // Non-internal members don't have access by default
  if (userData?.member_type !== 'i') {
    return false;
  }

  // Get permissions if not provided
  if (!featurePermissions) {
    featurePermissions = await getUserFeaturePermissions(userData);
  }

  // Check if feature is in permissions
  // Backend returns permissions grouped by category with feature codes
  // We need to check if the feature code exists in any category
  if (featurePermissions && typeof featurePermissions === 'object') {
    // Check all categories for the feature code
    for (const category in featurePermissions) {
      if (Array.isArray(featurePermissions[category])) {
        if (featurePermissions[category].includes(featureCode)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Check multiple feature permissions at once
 * @param {Array<string>} featureCodes - Array of feature codes
 * @param {Object} userData - User data object from localStorage
 * @returns {Promise<Object>} Object mapping feature codes to boolean access
 */
export async function checkMultipleFeatures(featureCodes, userData = null) {
  if (!userData) {
    userData = getUserData();
  }

  const permissions = await getUserFeaturePermissions(userData);
  const results = {};

  for (const featureCode of featureCodes) {
    results[featureCode] = await hasFeatureAccess(featureCode, userData, permissions);
  }

  return results;
}

/**
 * Feature codes constants
 */
export const FEATURE_CODES = {
  /** Kept for DB / Auth Controls compatibility; workflow dashboard no longer reads this flag (date/revenue UI removed). */
  WORKFLOW_DASHBOARD_CONTROLS: 'FEAT_WORKFLOW_DASHBOARD_CONTROLS',

  /** Ops Room — Action needed */
  WORKFLOW_ACTION_ADHOC_PLANS: 'FEAT_WORKFLOW_ACTION_ADHOC_PLANS',
  WORKFLOW_ACTION_RESCHEDULE_REQUESTS: 'FEAT_WORKFLOW_ACTION_RESCHEDULE_REQUESTS',
  WORKFLOW_ACTION_MANAGER_APPROVAL: 'FEAT_WORKFLOW_ACTION_MANAGER_APPROVAL',
  WORKFLOW_ACTION_RESOURCE_ASSIGNMENT: 'FEAT_WORKFLOW_ACTION_RESOURCE_ASSIGNMENT',
  WORKFLOW_ACTION_PENDING_PAYMENT: 'FEAT_WORKFLOW_ACTION_PENDING_PAYMENT',
  WORKFLOW_ACTION_DRONE_UNLOCKING: 'FEAT_WORKFLOW_ACTION_DRONE_UNLOCKING',
  WORKFLOW_ACTION_OPS_ASSIGNMENT: 'FEAT_WORKFLOW_ACTION_OPS_ASSIGNMENT',
  WORKFLOW_ACTION_DAY_END: 'FEAT_WORKFLOW_ACTION_DAY_END',
  WORKFLOW_ACTION_DJI_MAP_UPLOAD: 'FEAT_WORKFLOW_ACTION_DJI_MAP_UPLOAD',

  /** Ops Room — Quick access */
  WORKFLOW_QUICK_PLAN_CALENDAR: 'FEAT_WORKFLOW_QUICK_PLAN_CALENDAR',
  WORKFLOW_QUICK_TODAYS_PLANS: 'FEAT_WORKFLOW_QUICK_TODAYS_PLANS',
  WORKFLOW_QUICK_EMERGENCY_MOVING: 'FEAT_WORKFLOW_QUICK_EMERGENCY_MOVING',
  WORKFLOW_QUICK_FIELD_HISTORY: 'FEAT_WORKFLOW_QUICK_FIELD_HISTORY',
  WORKFLOW_QUICK_REPORTS: 'FEAT_WORKFLOW_QUICK_REPORTS',
  WORKFLOW_QUICK_FIELD_SIZE_ADJUSTMENTS: 'FEAT_WORKFLOW_QUICK_FIELD_SIZE_ADJUSTMENTS',
  WORKFLOW_QUICK_PLAN_CUSTOMIZATION: 'FEAT_WORKFLOW_QUICK_PLAN_CUSTOMIZATION',

  /** Day end process: show and toggle Dir-Ops Approval checkbox (user grant; no longer hardcoded to DOPS role) */
  DAY_END_DIR_OPS_APPROVAL: 'FEAT_DAY_END_DIR_OPS_APPROVAL',
  /** Pilot assignment: resource assignment queue (plans/missions, deploy, teams modal) */
  PILOT_ASSIGNMENT_RESOURCE_QUEUE: 'FEAT_PILOT_ASSIGNMENT_RESOURCE_QUEUE',
  /** Pilot assignment: Arrange transport page and header button */
  PILOT_ASSIGNMENT_ARRANGE_TRANSPORT: 'FEAT_PILOT_ASSIGNMENT_ARRANGE_TRANSPORT',
  /** Pilot assignment: right-click Reschedule on plan cards */
  PILOT_ASSIGNMENT_RESCHEDULE: 'FEAT_PILOT_ASSIGNMENT_RESCHEDULE',
  /** Pilot assignment: right-click Deactivate on plan cards */
  PILOT_ASSIGNMENT_DEACTIVATE: 'FEAT_PILOT_ASSIGNMENT_DEACTIVATE',

  /** Financial Cards: Create Voucher button */
  FINANCIAL_CARDS_CREATE_VOUCHER: 'FEAT_FINANCIAL_CARDS_CREATE_VOUCHER',
  /** Financial Cards: Settle Fuel Bill button */
  FINANCIAL_CARDS_SETTLE_FUEL_BILL: 'FEAT_FINANCIAL_CARDS_SETTLE_FUEL_BILL',

  /** Field unblock requests: Approve action */
  FIELD_UNBLOCK_APPROVE: 'FEAT_FIELD_UNBLOCK_APPROVE',
  /** Field unblock requests: Reject action */
  FIELD_UNBLOCK_REJECT: 'FEAT_FIELD_UNBLOCK_REJECT',

  /** Mapping Update: Add hierarchy items / fields */
  MAPPING_UPDATE_ADD: 'FEAT_MAPPING_UPDATE_ADD',
  /** Mapping Update: Edit field / availability / estate-division settings */
  MAPPING_UPDATE_EDIT: 'FEAT_MAPPING_UPDATE_EDIT',
  /** Mapping Update: Activate / Deactivate toggles */
  MAPPING_UPDATE_ACTIVATE: 'FEAT_MAPPING_UPDATE_ACTIVATE',

  /** System Maintenance: View PM2 logs */
  SYSTEM_MAINTENANCE_VIEW_LOGS: 'FEAT_SYSTEM_MAINTENANCE_VIEW_LOGS',
  /** System Maintenance: Restart PM2 process */
  SYSTEM_MAINTENANCE_RESTART: 'FEAT_SYSTEM_MAINTENANCE_RESTART',
  /** System Maintenance: Run backup now */
  SYSTEM_MAINTENANCE_RUN_BACKUP: 'FEAT_SYSTEM_MAINTENANCE_RUN_BACKUP',
};

