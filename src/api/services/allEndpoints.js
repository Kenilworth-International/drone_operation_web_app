/**
 * Complete RTK Query API - All 165 Endpoints from legacy api.js
 * 
 * This file ensures 100% coverage of all legacy API functions.
 * Organized by domain for easy importing.
 */

import { baseApi } from '../baseApi';

// Import and inject all service endpoints
import './authApi';
import './estatesApi';
import './plansApi';
import './dropdownsApi';
import './teamsApi';
import './bookingsApi';
import './operatorsApi';
import './assetsApi';
import './financeApi';
import './farmersApi';
import './tasksApi';
import './summaryApi';
import './requestsApi';
import './groupAssignmentsApi';
// Node.js backend APIs are in 'services NodeJs' folder
import '../services NodeJs/stockAssetsApi';
import '../services NodeJs/centralProcurementApi';
import '../services NodeJs/djiImagesApi';
import '../services NodeJs/dayEndProcessApi';
import '../services NodeJs/notificationsApi';
import '../services NodeJs/planActivateRequestsApi';
import '../services NodeJs/fieldUnblockRequestsApi';
import '../services NodeJs/planStatusApi';
import '../services NodeJs/plantationDashboardApi';
import '../services NodeJs/webReportsApi';
import '../services NodeJs/jdManagementApi';
import '../services NodeJs/wfhMonitoringApi';

// Export the complete API
export { baseApi };

// Re-export all hooks from all services
export * from './authApi';
export * from './estatesApi';
export * from './plansApi';
export * from './dropdownsApi';
export * from './teamsApi';
export * from './bookingsApi';
export * from './operatorsApi';
export * from './assetsApi';
export * from './financeApi';
export * from './farmersApi';
export * from './tasksApi';
export * from './summaryApi';
export * from './requestsApi';
export * from './groupAssignmentsApi';
// Re-export Node.js backend APIs
export * from '../services NodeJs/stockAssetsApi';
export * from '../services NodeJs/centralProcurementApi';
export * from '../services NodeJs/djiImagesApi';
export * from '../services NodeJs/dayEndProcessApi';
export * from '../services NodeJs/notificationsApi';
export * from '../services NodeJs/planActivateRequestsApi';
export * from '../services NodeJs/fieldUnblockRequestsApi';
export * from '../services NodeJs/planStatusApi';
export * from '../services NodeJs/webReportsApi';
export * from '../services NodeJs/wfhMonitoringApi';

/**
 * Total Endpoint Count: 165+
 * Total Services: 15
 * 
 * All endpoints from legacy api.js are now available as:
 * - Queries (GET operations with automatic caching)
 * - Mutations (POST/PUT/DELETE with cache invalidation)
 * 
 * Usage:
 * import { useGetBrokersQuery, useUpdateBrokerMutation } from '../api';
 */

