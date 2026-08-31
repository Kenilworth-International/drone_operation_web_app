import { withCurrentWingSearch } from './config/wingRouteGuard';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import WingHubHome from './pages/WingHubHome';
import CombHubPage from './pages/CombHubPage';
import UpdateServices from './features/misc/UpdateServices';
import CreateBookings from './sections/management/bookings/CreateBookings';
import Dashboard from './features/dashboard/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import ApiDocsPage from './pages/ApiDocsPage';
import ProceedPlan from './features/misc/ProceedPlan';
import TeamAllocation from './features/misc/teamAllocation';
import NonpTeamAllocation from './features/nonp/nonpTeamAllocation';
import SummeryView from './features/misc/SummeryView';
import CalenderView from './features/calendar/CalenderView';
import DeactivatePlan from './features/misc/DeactivatePlan';
import PlanActivateRequestsPage from './sections/management/plans/PlanActivateRequestsPage';
import ModernReportSection from './components/ModernReportSection';
import WorkSummaryPage from './sections/finance/reports/WorkSummaryPage';
import DayEndProcess from './sections/opsroom/dayend/DayEndProcess';
import Earnings from './sections/finance/PilotEarnings/Earnings';
import DayEndProcessAsc from './sections/opsroom/dayend/DayEndProcessAsc';
import PlanCustomization from './sections/opsroom/dayend/PlanCustomization';
// import ManagerRescheduler from './features/misc/ManagerRescheduler';
import Missions from './features/misc/Missions';
import BookingList from './sections/management/bookings/BookingList';
// import ProceedPlanAscNonp from './features/misc/ProceedPlanAscNonp';
import MDDashboard from './features/dashboard/MDDashboard';
import FieldHistory from './sections/management/ops/FieldHistory';
import DataViewer from './sections/corporate/chartView/DataViewer';
import FinancialCards from './sections/finance/financialCards/FinancialCards';
import FinanceApprovals from './sections/finance/financeApprovals/FinanceApprovals';
import VehicleRent from './sections/finance/vehicleRent/VehicleRent';
import VehicleRentApprovals from './sections/hr&admin/vehicleRentApprovals/VehicleRentApprovals';
import DriverAdvanceApprovals from './sections/hr&admin/driverAdvanceApprovals/DriverAdvanceApprovals';
import DriverAdvanceFinance from './sections/finance/driverAdvance/DriverAdvanceFinance';
import DriverLeaveDatesHr from './sections/hr&admin/driverLeaveDates/DriverLeaveDatesHr';
import TransportHrDashboard from './sections/transport/TransportHrDashboard';
import TransportFinanceDashboard from './sections/transport/TransportFinanceDashboard';
import CEODataViewer from './features/dashboard/CEODataViewer';
import OpsAssign from './sections/opsroom/operators/OpsAssign';
import ReportReview from './sections/corporate/charts/TaskReviewManagement';
import Brokers from './sections/finance/brokers/Brokers';
import WorkflowDashboard from './sections/opsroom/dashboard/WorkflowDashboard';
import MonitoringDashboard from './sections/opsroom/monitoring/MonitoringDashboard';
import PlanCalendar from './sections/opsroom/calendar/PlanCalendar';
import RequestsQueueMain from './sections/opsroom/requests/RequestsQueueMain';
import RequestProceed from './sections/opsroom/requests/RequestProceed';
import MonthlyRequestProceed from './sections/opsroom/requests/MonthlyRequestProceed';
import PlansWithWeather from './sections/opsroom/plans/PlansWithWeather';
import CorporateCustomers from './sections/strategic/corporateCustomers/CorporateCustomers';
import StrategicFinanceApprovals from './sections/strategic/StrategicFinanceApprovals';
import PilotAssignment from './sections/opsroom/pilot-assigment/PilotAssignment';
import TransportArrangePage from './sections/opsroom/pilot-assigment/TransportArrangePage';
import TodayPlans from './sections/opsroom/today-plans/TodayPlans';
import EmergencyMoving from './sections/opsroom/emergency/EmergencyMoving';
import FieldSizeAdjustments from './sections/opsroom/fieldSizeAdjustments/FieldSizeAdjustments';
import EmployeeProfileDetails from './sections/hr&admin/EmployeeProfileDetails';
import HrmDashboard from './sections/hr&admin/dashboard/HrmDashboard';
import OrganizationStructure from './sections/hr&admin/OrganizationStructure';
import EmpOrgMasterPage from './sections/hr&admin/EmpOrgMasterPage';
import Employees from './sections/hr&admin/Employees';
import JDManagement from './sections/hr&admin/JDManagement';
import EmployeeAssignment from './sections/hr&admin/EmployeeAssignment';
import MonthlyRoaster from './sections/hr&admin/roaster/MonthlyRoaster';
import AttendanceRoasterHub from './sections/hr&admin/roaster/AttendanceRoasterHub';
import LeaveManagement from './sections/hr&admin/leave/LeaveManagement';
import EmployeeKpiDashboard from './sections/hr&admin/kpi/EmployeeKpiDashboard';
import SmartKpiTemplatesPage from './sections/hr&admin/kpi/SmartKpiTemplatesPage';
import ResourceAllocation from './sections/administration/resource-allocation/ResourceAllocation';
import AccidentReports from './sections/administration/accident-reports/AccidentReports';
import Maintenance from './sections/administration/maintenance/Maintenance';
import GeneratorFuelApprovals from './sections/hr&admin/fuelApprovals/GeneratorFuelApprovals';
import DjiMapUpload from './sections/opsroom/dji/DjiMapUpload';
import ManagerApprovalQueue from './sections/opsroom/manager-approval/ManagerApprovalQueue';
import FieldUnblockRequestQueue from './sections/opsroom/field-unblock/FieldUnblockRequestQueue';
import PendingPaymentQueue from './sections/opsroom/pending-payment/PendingPaymentQueue';
import DroneUnlockingQueue from './sections/opsroom/drone-unlocking/DroneUnlockingQueue';
import IctUserManagement from './sections/ict/users/IctUserManagement';
import AuthControls from './sections/ict/authentication/AuthControls';
import AppVersionManagement from './sections/ict/appVersions/AppVersionManagement';
import LogsReportPage from './sections/ict/logsReport/LogsReportPage';
import SystemMaintenancePage from './sections/ict/systemMaintenance/SystemMaintenancePage';
import SprintPlanning from './sections/ict/development/SprintPlanning';
import DevelopmentBoard from './sections/ict/development/DevelopmentBoard';
import ExtraWorkQueue from './sections/ict/development/ExtraWorkQueue';
import MetricsDashboard from './sections/ict/development/MetricsDashboard';
import IctDevCenter from './sections/ict/development/DevCenter';
import SupplierRegistration from './sections/stock-assets/SupplierRegistration';
import InventoryItemsRegistration from './sections/stock-assets/InventoryItemsRegistration';
import ProcurementProcess from './sections/stock-assets/ProcurementProcess';
import CentralStores from './sections/stock-assets/CentralStores';
import AssetTransfer from './sections/stock-assets/AssetTransfer';
import AssetRequest from './sections/stock-assets/AssetRequest';
import MasterData from './sections/ict/masterData/MasterData';
import PlantationDashboard from './sections/plantation/plantationDashboard/PlantationDashboard';
import PlantationExternalShell from './sections/plantation/plantationDashboard/PlantationExternalShell';
import PlantationHomeTab from './sections/plantation/plantationDashboard/tabs/PlantationHomeTab';
import PlantationCalendarTab from './sections/plantation/plantationDashboard/tabs/PlantationCalendarTab';
import PlantationProfileTab from './sections/plantation/plantationDashboard/tabs/PlantationProfileTab';
import PlantationManagerTab from './sections/plantation/plantationDashboard/tabs/PlantationManagerTab';
import FieldAvailabilityPage from './sections/plantation/plantationDashboard/pages/FieldAvailabilityPage';
import ManagerPlanApprovePage from './sections/plantation/plantationDashboard/pages/ManagerPlanApprovePage';
import ManagerPlanEditPage from './sections/plantation/plantationDashboard/pages/ManagerPlanEditPage';
import PlantationChartsPage from './sections/plantation/plantationDashboard/pages/PlantationChartsPage';
import PlantationCalendarPage from './sections/plantation/plantationDashboard/pages/PlantationCalendarPage';
import PlantationUpcomingPage from './sections/plantation/plantationDashboard/pages/PlantationUpcomingPage';
import PlantationReportsPage from './sections/plantation/plantationDashboard/pages/PlantationReportsPage';
import ChartBreakdownPage from './sections/plantation/plantationDashboard/pages/ChartBreakdownPage';
import GlobalChartBreakdownPage from './sections/corporate/charts/GlobalChartBreakdownPage';
import MappingUpdatePage from './sections/geo-spatial/mapping/MappingUpdatePage';
import GeoSpatialDashboard from './sections/geo-spatial/dashboard/GeoSpatialDashboard';
import WeatherPredictionPage from './sections/geo-spatial/weather/WeatherPredictionPage';

import { useAppSelector } from './store/hooks';
import SessionWatchdog from './components/SessionWatchdog';

// ProtectedRoute component to check authentication
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

  if (!isAuthenticated) return <Navigate to="/login" />;

  return (
    <>
      <SessionWatchdog />
      {children}
    </>
  );
};


/** Legacy `#/home/fleet-update` → Transport HR vehicle management. */
function FleetUpdateRedirect() {
  const location = useLocation();
  const next = new URLSearchParams(location.search);
  if (!next.get('module')) {
    next.set('module', 'vehicleManagement');
  }
  const search = next.toString();
  return <Navigate to={`/home/transport/hr${search ? `?${search}` : ''}`} replace />;
}

/** Legacy `#/home/plantationPlanRequestQueue` → merged requests queue. */
function PlantationPlanRequestQueueRedirect() {
  const location = useLocation();
  return <Navigate to={withCurrentWingSearch('/home/requestsQueue', location.search)} replace />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/docs"
          element={
            <ProtectedRoute>
              <ApiDocsPage />
            </ProtectedRoute>
          }
        />

        {/* Wrap protected routes with ProtectedRoute */}
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={
              <ProtectedRoute>
                <WingHubHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="comb"
            element={
              <ProtectedRoute>
                <CombHubPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="dataViewer"
            element={
              <ProtectedRoute>
                <DataViewer />
              </ProtectedRoute>
            }
          />
          <Route
            path="dataViewer/chart-breakdown"
            element={
              <ProtectedRoute>
                <GlobalChartBreakdownPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="ceoDataViewer"
            element={
              <ProtectedRoute>
                <CEODataViewer />
              </ProtectedRoute>
            }
          />
          <Route
            path="mDDashboard"
            element={
              <ProtectedRoute>
                <MDDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="createBookings"
            element={
              <ProtectedRoute>
                <CreateBookings />
              </ProtectedRoute>
            }
          />
          <Route
            path="create"
            element={
              <ProtectedRoute>
                <PlansWithWeather />
              </ProtectedRoute>
            }
          />
          <Route
            path="corporate-customers"
            element={
              <ProtectedRoute>
                <CorporateCustomers />
              </ProtectedRoute>
            }
          />
          <Route
            path="strategic/finance-approvals"
            element={
              <ProtectedRoute>
                <StrategicFinanceApprovals />
              </ProtectedRoute>
            }
          />
          <Route
            path="updateservices"
            element={
              <ProtectedRoute>
                <UpdateServices />
              </ProtectedRoute>
            }
          />
          <Route
            path="missions"
            element={
              <ProtectedRoute>
                <Missions />
              </ProtectedRoute>
            }
          />
          <Route
            path="proceedPlan"
            element={
              <ProtectedRoute>
                <ProceedPlan />
              </ProtectedRoute>
            }
          />
          <Route
            path="teamAllocation"
            element={
              <ProtectedRoute>
                <TeamAllocation />
              </ProtectedRoute>
            }
          />
          <Route
            path="nonpTeamAllocation"
            element={
              <ProtectedRoute>
                <NonpTeamAllocation />
              </ProtectedRoute>
            }
          />
          <Route
            path="summeryView"
            element={
              <ProtectedRoute>
                <SummeryView />
              </ProtectedRoute>
            }
          />
          <Route
            path="calenderView"
            element={
              <ProtectedRoute>
                <Navigate to="/home/calenderView/corporate" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="calenderView/corporate"
            element={
              <ProtectedRoute>
                <CalenderView />
              </ProtectedRoute>
            }
          />
          <Route
            path="geo-spatial/dashboard"
            element={
              <ProtectedRoute>
                <GeoSpatialDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="geo-spatial/weather-prediction"
            element={
              <ProtectedRoute>
                <WeatherPredictionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="geo-spatial/mapping-update"
            element={
              <ProtectedRoute>
                <MappingUpdatePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="geo-spatial/field-unblock-requests"
            element={
              <ProtectedRoute>
                <FieldUnblockRequestQueue />
              </ProtectedRoute>
            }
          />
          <Route
            path="calenderView/management"
            element={
              <ProtectedRoute>
                <CalenderView />
              </ProtectedRoute>
            }
          />
          <Route
            path="calenderView/opsroom"
            element={
              <ProtectedRoute>
                <CalenderView />
              </ProtectedRoute>
            }
          />
          <Route
            path="deactivatePlan"
            element={
              <ProtectedRoute>
                <DeactivatePlan />
              </ProtectedRoute>
            }
          />
          <Route
            path="planActivateRequests"
            element={
              <ProtectedRoute>
                <PlanActivateRequestsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="reportSection"
            element={
              <ProtectedRoute>
                <ModernReportSection category={null} />
              </ProtectedRoute>
            }
          />
          <Route
            path="reports/corporate"
            element={
              <ProtectedRoute>
                <ModernReportSection category={null} />
              </ProtectedRoute>
            }
          />
          <Route
            path="reports/management"
            element={
              <ProtectedRoute>
                <ModernReportSection category="management" />
              </ProtectedRoute>
            }
          />
          <Route
            path="finance/work-summary"
            element={
              <ProtectedRoute>
                <WorkSummaryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="reports/finance"
            element={
              <ProtectedRoute>
                <ModernReportSection category="finance" />
              </ProtectedRoute>
            }
          />
          <Route
            path="reports/ops"
            element={
              <ProtectedRoute>
                <ModernReportSection category="ops" />
              </ProtectedRoute>
            }
          />
          <Route
            path="reports/plantation"
            element={
              <ProtectedRoute>
                <ModernReportSection category="plantation" />
              </ProtectedRoute>
            }
          />
          <Route
            path="dayEndProcess"
            element={
              <ProtectedRoute>
                <DayEndProcess />
              </ProtectedRoute>
            }
          />
          <Route
            path="dayEndProcessAsc"
            element={
              <ProtectedRoute>
                <DayEndProcessAsc />
              </ProtectedRoute>
            }
          />
          <Route
            path="planCustomization"
            element={
              <ProtectedRoute>
                <PlanCustomization />
              </ProtectedRoute>
            }
          />
          <Route
            path="fieldHistory"
            element={
              <ProtectedRoute>
                <FieldHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="fieldSizeAdjustments"
            element={
              <ProtectedRoute>
                <FieldSizeAdjustments />
              </ProtectedRoute>
            }
          />
          {/* <Route
            path="managerRescheduler"
            element={
              <ProtectedRoute>
                <ManagerRescheduler />
              </ProtectedRoute>
            }
          /> */}
          <Route
            path="bookingList"
            element={
              <ProtectedRoute>
                <BookingList />
              </ProtectedRoute>
            }
          />
          {/* <Route
            path="proceedPlanAsc"
            element={
              <ProtectedRoute>
                <ProceedPlanAscNonp />
              </ProtectedRoute>
            }
          /> */}
          <Route
            path="opsAsign"
            element={
              <ProtectedRoute>
                <OpsAssign />
              </ProtectedRoute>
            }
          />
          <Route
            path="reportReview"
            element={
              <ProtectedRoute>
                <ReportReview />
              </ProtectedRoute>
            }
          />
          <Route
            path="earnings"
            element={
              <ProtectedRoute>
                <Earnings />
              </ProtectedRoute>
            }
          />
          <Route
            path="brokers"
            element={
              <ProtectedRoute>
                <Brokers />
              </ProtectedRoute>
            }
          />
          <Route
            path="financial-cards"
            element={
              <ProtectedRoute>
                <FinancialCards />
              </ProtectedRoute>
            }
          />
          <Route
            path="finance-approvals"
            element={
              <ProtectedRoute>
                <FinanceApprovals />
              </ProtectedRoute>
            }
          />
          <Route
            path="vehicle-rent"
            element={
              <ProtectedRoute>
                <VehicleRent />
              </ProtectedRoute>
            }
          />
          <Route
            path="vehicle-rent-approvals"
            element={
              <ProtectedRoute>
                <VehicleRentApprovals />
              </ProtectedRoute>
            }
          />
          <Route
            path="driver-advance-approvals"
            element={
              <ProtectedRoute>
                <DriverAdvanceApprovals />
              </ProtectedRoute>
            }
          />
          <Route
            path="driver-leave-dates"
            element={
              <ProtectedRoute>
                <DriverLeaveDatesHr />
              </ProtectedRoute>
            }
          />
          <Route
            path="driver-advance-finance"
            element={
              <ProtectedRoute>
                <DriverAdvanceFinance />
              </ProtectedRoute>
            }
          />
          <Route
            path="transport/hr"
            element={
              <ProtectedRoute>
                <TransportHrDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="transport/finance"
            element={
              <ProtectedRoute>
                <TransportFinanceDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="monitoringDashboard"
            element={
              <ProtectedRoute>
                <MonitoringDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="workflowDashboard"
            element={
              <ProtectedRoute>
                <WorkflowDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="opsroomPlanCalendar"
            element={
              <ProtectedRoute>
                <PlanCalendar />
              </ProtectedRoute>
            }
          />
          <Route
            path="requestsQueue"
            element={
              <ProtectedRoute>
                <RequestsQueueMain />
              </ProtectedRoute>
            }
          />
          <Route
            path="pilotAssignment"
            element={
              <ProtectedRoute>
                <PilotAssignment />
              </ProtectedRoute>
            }
          />
          <Route
            path="pilotAssignment/transport-arrange"
            element={
              <ProtectedRoute>
                <TransportArrangePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="djiMapUpload"
            element={
              <ProtectedRoute>
                <DjiMapUpload />
              </ProtectedRoute>
            }
          />
          <Route
            path="managerApprovalQueue"
            element={
              <ProtectedRoute>
                <ManagerApprovalQueue />
              </ProtectedRoute>
            }
          />
          <Route
            path="plantationPlanRequestQueue"
            element={
              <ProtectedRoute>
                <PlantationPlanRequestQueueRedirect />
              </ProtectedRoute>
            }
          />
          <Route
            path="pendingPaymentQueue"
            element={
              <ProtectedRoute>
                <PendingPaymentQueue />
              </ProtectedRoute>
            }
          />
          <Route
            path="droneUnlockingQueue"
            element={
              <ProtectedRoute>
                <DroneUnlockingQueue />
              </ProtectedRoute>
            }
          />
          <Route
            path="todayPlans"
            element={
              <ProtectedRoute>
                <TodayPlans />
              </ProtectedRoute>
            }
          />
          <Route
            path="emergencyMoving"
            element={
              <ProtectedRoute>
                <EmergencyMoving />
              </ProtectedRoute>
            }
          />
          <Route
            path="requestProceed"
            element={
              <ProtectedRoute>
                <RequestProceed />
              </ProtectedRoute>
            }
          />
          <Route
            path="monthlyRequestProceed"
            element={
              <ProtectedRoute>
                <MonthlyRequestProceed />
              </ProtectedRoute>
            }
          />
          <Route
            path="hrm/dashboard"
            element={
              <ProtectedRoute>
                <HrmDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="employeeRegistration"
            element={
              <ProtectedRoute>
                <EmployeeProfileDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="employees"
            element={
              <ProtectedRoute>
                <Employees />
              </ProtectedRoute>
            }
          />
          <Route
            path="employeeProfileDetails"
            element={
              <ProtectedRoute>
                <EmployeeProfileDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="organizationStructure"
            element={
              <ProtectedRoute>
                <OrganizationStructure />
              </ProtectedRoute>
            }
          />
          <Route
            path="empOrgMaster"
            element={
              <ProtectedRoute>
                <EmpOrgMasterPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="jdManagement"
            element={
              <ProtectedRoute>
                <JDManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="employeeAssignment"
            element={
              <ProtectedRoute>
                <EmployeeAssignment />
              </ProtectedRoute>
            }
          />
          <Route
            path="attendance/monthly-roaster"
            element={
              <ProtectedRoute>
                <MonthlyRoaster />
              </ProtectedRoute>
            }
          />
          <Route
            path="attendance/roaster-planning"
            element={
              <ProtectedRoute>
                <AttendanceRoasterHub />
              </ProtectedRoute>
            }
          />
          <Route
            path="attendance/employee-kpi"
            element={
              <ProtectedRoute>
                <EmployeeKpiDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="attendance/smart-kpi-templates"
            element={
              <ProtectedRoute>
                <SmartKpiTemplatesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="attendance/leave-management"
            element={
              <ProtectedRoute>
                <LeaveManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="fleet"
            element={
              <ProtectedRoute>
                <ResourceAllocation />
              </ProtectedRoute>
            }
          />
          <Route
            path="accident-reports"
            element={
              <ProtectedRoute>
                <AccidentReports />
              </ProtectedRoute>
            }
          />
          <Route
            path="maintenance"
            element={
              <ProtectedRoute>
                <Maintenance />
              </ProtectedRoute>
            }
          />
          <Route
            path="generator-fuel-approvals"
            element={
              <ProtectedRoute>
                <GeneratorFuelApprovals />
              </ProtectedRoute>
            }
          />
          <Route
            path="fleet-update"
            element={<FleetUpdateRedirect />}
          />
          <Route
            path="ict/system-admin"
            element={
              <ProtectedRoute>
                <Navigate to="/home/ict/system-admin/system-maintenance" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="ict/system-admin/users"
            element={
              <ProtectedRoute>
                <IctUserManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="ict/system-admin/auth-controls"
            element={
              <ProtectedRoute>
                <AuthControls />
              </ProtectedRoute>
            }
          />
          <Route
            path="ict/system-admin/app-versions"
            element={
              <ProtectedRoute>
                <AppVersionManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="ict/system-admin/logs-report"
            element={
              <ProtectedRoute>
                <LogsReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="ict/system-admin/system-maintenance"
            element={
              <ProtectedRoute>
                <SystemMaintenancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="ict/system-admin/master-data-update"
            element={
              <ProtectedRoute>
                <MasterData mode="masters" />
              </ProtectedRoute>
            }
          />
          <Route
            path="ict/development"
            element={
              <ProtectedRoute>
                <Navigate to="/home/ict/development/dev-center" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="ict/development/dev-center"
            element={
              <ProtectedRoute>
                <IctDevCenter />
              </ProtectedRoute>
            }
          />
          <Route
            path="ict/development/workflow-dashboard"
            element={
              <ProtectedRoute>
                <Navigate to="/home/ict/development/dev-center" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="ict/development/sprints"
            element={
              <ProtectedRoute>
                <SprintPlanning />
              </ProtectedRoute>
            }
          />
          <Route
            path="ict/development/board"
            element={
              <ProtectedRoute>
                <DevelopmentBoard />
              </ProtectedRoute>
            }
          />
          <Route
            path="ict/development/extra-work"
            element={
              <ProtectedRoute>
                <ExtraWorkQueue />
              </ProtectedRoute>
            }
          />
          <Route
            path="ict/development/metrics"
            element={
              <ProtectedRoute>
                <MetricsDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="hr-admin/vehicle-app-admin"
            element={
              <ProtectedRoute>
                <MasterData mode="operations" />
              </ProtectedRoute>
            }
          />
          <Route
            path="stock-assets/supplier-registration"
            element={
              <ProtectedRoute>
                <SupplierRegistration />
              </ProtectedRoute>
            }
          />
          <Route
            path="stock-assets/inventory-items-registration"
            element={
              <ProtectedRoute>
                <InventoryItemsRegistration />
              </ProtectedRoute>
            }
          />
          <Route
            path="stock-assets/procurement-process/*"
            element={
              <ProtectedRoute>
                <ProcurementProcess />
              </ProtectedRoute>
            }
          />
          <Route
            path="stock-assets/central-stores/*"
            element={
              <ProtectedRoute>
                <CentralStores />
              </ProtectedRoute>
            }
          />
          <Route
            path="stock-assets/asset-transfer"
            element={
              <ProtectedRoute>
                <AssetTransfer />
              </ProtectedRoute>
            }
          />
          <Route
            path="stock-assets/asset-request"
            element={
              <ProtectedRoute>
                <AssetRequest />
              </ProtectedRoute>
            }
          />
          {/* Internal Plantation Dashboard */}
          <Route
            path="dashboard/charts"
            element={
              <ProtectedRoute>
                <PlantationChartsPage basePath="/home/dashboard" />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard/calendar"
            element={
              <ProtectedRoute>
                <PlantationCalendarPage basePath="/home/dashboard" />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard/upcoming"
            element={
              <ProtectedRoute>
                <PlantationUpcomingPage basePath="/home/dashboard" />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard/reports"
            element={
              <ProtectedRoute>
                <PlantationReportsPage basePath="/home/dashboard" />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard/chart-breakdown"
            element={
              <ProtectedRoute>
                <ChartBreakdownPage basePath="/home/dashboard" />
              </ProtectedRoute>
            }
          />
          <Route
            path="plantation-dashboard"
            element={
              <ProtectedRoute>
                <PlantationExternalShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<PlantationHomeTab />} />
            <Route path="calendar" element={<PlantationCalendarTab />} />
            <Route path="profile" element={<PlantationProfileTab />} />
            <Route path="manager" element={<PlantationManagerTab />} />
            <Route path="field-availability" element={<FieldAvailabilityPage />} />
            <Route path="manager/approve/:planId" element={<ManagerPlanApprovePage />} />
            <Route path="manager/edit/:planId" element={<ManagerPlanEditPage />} />
            <Route path="chart-breakdown" element={<ChartBreakdownPage basePath="/home/plantation-dashboard" />} />
            <Route path="charts" element={<Navigate to="/home/plantation-dashboard" replace />} />
            <Route path="upcoming" element={<Navigate to="/home/plantation-dashboard" replace />} />
            <Route path="reports" element={<Navigate to="/home/plantation-dashboard" replace />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
