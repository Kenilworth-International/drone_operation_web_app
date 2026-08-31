import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { getNodeBackendUrl } from './services NodeJs/nodeBackendUrl';
import { logger } from '../utils/logger';
import { forceLogoutFromApi } from '../utils/sessionUtils';

/** Legacy PHP-compat paths are served by Node at /api/<path> (see dsms_backend_dev legacyPhpCompat). */
const LEGACY_API_BASE = (() => {
  const nodeRoot = getNodeBackendUrl();
  return nodeRoot ? `${nodeRoot}/api/` : '/api/';
})();

// Helper function to get token
const getToken = () => {
  const storedUser = JSON.parse(localStorage.getItem('userData'));
  return storedUser?.token || null;
};

const baseQueryWithAuth = fetchBaseQuery({
  baseUrl: LEGACY_API_BASE,
  fetchFn: (input, init) =>
    fetch(input, {
      ...init,
      cache: 'no-store',
    }),
  prepareHeaders: (headers) => {
    const token = getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    headers.set('Content-Type', 'application/json');
    return headers;
  },
});

// Base query with error handling and logging
const baseQueryWithLogging = async (args, api, extraOptions) => {
  const result = await baseQueryWithAuth(args, api, extraOptions);
  
  if (result.error) {
    forceLogoutFromApi(api, result.error);
    logger.error('API Error:', {
      endpoint: typeof args === 'string' ? args : args.url,
      status: result.error.status,
      data: result.error.data
    });
  }
  
  return result;
};

// Create the base API
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithLogging,
  tagTypes: [
    // Authentication
    'Auth',
    // Estates & Geography
    'Groups', 'Plantations', 'Regions', 'Estates', 'Divisions', 'Fields', 'MappingDashboard',
    // Plans & Missions
    'Plans', 'Missions', 'PlanDetails', 'MissionDetails',
    // Teams & Resources
    'Teams', 'Pilots', 'Drones', 'Operators',
    // Bookings
    'Bookings', 'ASCBookings', 'Farmers',
    // Reports
    'Reports', 'ChartData', 'TaskReports', 'PilotPerformance',
    // Assets
    'Assets', 'Vehicles', 'Generators', 'Batteries', 'RemoteControls', 'Insurance',
    // Stock and Assets Management
    'Suppliers', 'MainCategories', 'SubCategories', 'InventoryItems',
    // Finance
    'Brokers', 'PilotRevenue', 'DefaultValues', 'PlantationInvoices',
    // Dropdowns
    'Sectors', 'Crops', 'MissionTypes', 'TimeSlots', 'ChemicalTypes', 'Stages',
    // Notifications
    'Notifications',
    // Emergency Moving
    'EmergencyMoving',
    // HR & JD Management
    'UserLevels', 'UserMemberTypes', 'UserJobRoles', 'UserJobDescriptions', 'Departments', 'EmployeeAssignment',
    // HR Employee Profile (Phases 2-7)
    'EmployeeProfile', 'EmployeeDocuments', 'Organization',
    // Plantation Dashboard
    'PlantationCalendarPlans', 'PlantationUpcomingPlans', 'PlantationCharts', 'PlantationMissionReports', 'PlantationDashboardSummary', 'PlantationPlanRequests', 'PlantationPlanRescheduleRequests', 'PlantationMonthlyPlanRequests', 'PlantationEstateManager', 'PlantationSession', 'PlantationFieldAvailability', 'PlantationPlans', 'FieldUnblockRequests', 'PlanActivateRequests',
    // Field Size Adjustments
    'FieldSizeAdjustments',
    // Field History
    'FieldHistoryEstates', 'FieldHistoryFields', 'FieldHistoryData',
    // App Versions
    'AppVersions',
    // Task Cancel Status
    'TaskCancelStatus',
    // Others
    'Calendar', 'Reasons', 'ASC', 'Chemicals', 'TimeOfDays', 'HrMasterOptions',
    // HR Leave and Attendance
    'HrLeave', 'HrLeaveAdmin', 'HrAttendance', 'HrRoster', 'KpiDefinitions', 'KpiRatingBands', 'KpiLeaderboard', 'SmartKpiTemplates', 'SmartKpiFieldTypes', 'SmartKpiReviews', 'SmartKpiScopeStatus', 'HrmDashboard',
    // Financial cards / fuel approvals
    'FinancialCards', 'FinancialCardTransactions', 'Transactions', 'FuelApprovals', 'FuelTransportVouchers',
    'GeneratorFuelApprovals', 'FuelGeneratorVouchers', 'FinanceMasterData', 'StrategicFinanceApprovals',
    'VehicleApp', 'PoolVehicleTasks',
    'EmpOrgStructure',
    'SystemMaintenance',
    // Auth Controls / feature permissions
    'FeaturePermissions', 'FeatureDefinitions', 'GroupedPermissions', 'MyPermissions',
    'JobRoles', 'FeatureEligibleUsers', 'UserFeaturePermissions',
  ],
  endpoints: () => ({}),
});

export default baseApi;

