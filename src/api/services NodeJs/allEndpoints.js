/**
 * Node.js Backend API Services
 * 
 * This file imports and exports all Node.js backend API endpoints.
 * These APIs use a custom base query that points to the Node.js backend server.
 */

import { baseApi } from '../baseApi';

// Import and inject Node.js backend service endpoints
import './stockAssetsApi';
import './centralProcurementApi';
import './fleetEquipmentApi';
import './pilotAssignmentApi';
import './accidentReportsApi';
import './jdManagementApi';
import './plantationDashboardApi';
import './plantationEstateManagerApi';
import './accountApi';
import './fieldUnblockRequestsApi';
import './planActivateRequestsApi';
import './fieldSizeAdjustmentsApi';
import './mappingHierarchyApi';
import './fieldHistoryApi';
import './vehicleAppApi';
import './poolVehicleTaskApi';
import './financeReportApi';
import './plantationInvoiceApi';
import './chemicalsApi';
import './timeOfDaysApi';
import './hrMasterOptionsApi';
import './bookingCreationApi';
import './opsroomPlanCalendarApi';
import './financeWorkSummaryBillingApi';
import './opsroomPerformanceSummaryApi';
import './fuelTransportVoucherApi';
import './maintenanceVoucherApi';
import './strategicFinanceApprovalsApi';
import './empOrgStructureApi';
import './systemMaintenanceApi';

// Export the complete API
export { baseApi };

// Re-export all hooks from Node.js backend services
export * from './stockAssetsApi';
export * from './centralProcurementApi';
export * from './fleetEquipmentApi';
export * from './pilotAssignmentApi';
export * from './accidentReportsApi';
export * from './jdManagementApi';
export * from './plantationDashboardApi';
export * from './plantationEstateManagerApi';
export * from './accountApi';
export * from './fieldUnblockRequestsApi';
export * from './planActivateRequestsApi';
export * from './fieldSizeAdjustmentsApi';
export * from './mappingHierarchyApi';
export * from './fieldHistoryApi';
export * from './vehicleAppApi';
export * from './poolVehicleTaskApi';
export * from './financeReportApi';
export * from './plantationInvoiceApi';
export * from './chemicalsApi';
export * from './timeOfDaysApi';
export * from './hrMasterOptionsApi';
export * from './bookingCreationApi';
export * from './opsroomPlanCalendarApi';
export * from './financeWorkSummaryBillingApi';
export * from './opsroomPerformanceSummaryApi';
export * from './fuelTransportVoucherApi';
export * from './maintenanceVoucherApi';
export * from './strategicFinanceApprovalsApi';
export * from './empOrgStructureApi';
export * from './systemMaintenanceApi';

/**
 * Node.js Backend Services:
 * - Stock Assets Management (Suppliers, Categories, Inventory Items)
 * - Fleet Equipment Management (Remote Controls, Batteries, Generators, Drones)
 * - Temporary Equipment Allocations
 * - Accident Reports Management
 * 
 * Usage:
 * import { useGetSuppliersQuery, useGetFleetRemoteControlsQuery, useGetFleetPilotsWithTeamsQuery, useGetAccidentReportsQuery } from '../api/services NodeJs/allEndpoints';
 */

