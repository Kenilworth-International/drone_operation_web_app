import React from 'react';
import {
  FaChartLine,
  FaChartBar,
  FaChartPie,
  FaFileInvoiceDollar,
  FaPlane,
  FaTasks,
  FaCalendarCheck,
  FaTimesCircle,
  FaComments,
  FaSeedling,
  FaCheckCircle,
  FaUserFriends,
  FaUsers,
} from 'react-icons/fa';
import '../styles/modernreport.css';

import EstateSprayedAreaReport from '../sections/finance/reports/EstateSprayedAreaReport';
import PlantationCoveredAreaReport from '../sections/finance/reports/PlantationCoveredAreaReport';
import DailyCoveredAreaSummary from '../sections/finance/reports/DailyCoveredAreaSummary';
import OperationsReportPlanWise from '../sections/opsroom/reports/OperationsReportPlanWise';
import CanceledByPilots from '../sections/opsroom/reports/CanceledByPilots';
import CanceledByOpsRoom from '../sections/opsroom/reports/CanceledByOpsRoom';
import PilotFeedbacks from '../sections/opsroom/reports/PilotFeedbacks';
import MonthlyPlantationReport from '../sections/opsroom/reports/MonthlyPlantationReport';
import BillableExtentsReport from '../sections/opsroom/reports/BillableExtentsReport';
import OpsroomDailyPerformanceSummary from '../sections/opsroom/reports/OpsroomDailyPerformanceSummary';
import OpsroomPilotDailyPerformanceSummary from '../sections/opsroom/reports/OpsroomPilotDailyPerformanceSummary';
import OpsroomMonthlyAchievementSummary from '../sections/opsroom/reports/OpsroomMonthlyAchievementSummary';
import ChemicalsReport from '../features/plantation/ChemicalsReport';
import PlanExecutionReasonReport from '../sections/management/reports/PlanExecutionReasonReport';
import DailyDronePerformanceReport from '../sections/management/reports/DailyDronePerformanceReport';
import DailyDroneOperationsSummaryReport from '../sections/management/reports/DailyDroneOperationsSummaryReport';
import DeactivatedPlansReport from '../sections/corporate/reports/DeactivatedPlansReport';
import ManagerApprovedCanceledReport from '../sections/corporate/reports/ManagerApprovedCanceledReport';
import ReportsDecisionShell from '../sections/management/reports/ReportsDecisionShell';
import PilotPerformanceCombined from '../sections/management/reports/merged/PilotPerformanceCombined';
import PilotSummaryCombined from '../sections/management/reports/merged/PilotSummaryCombined';
import PilotPerformanceByDateCombined from '../sections/management/reports/merged/PilotPerformanceByDateCombined';

const ModernReportSection = ({ category = null }) => {
  const reportCatalog = {
    management: {
      title: 'Management Reports',
      reports: [
        {
          id: 'finance_field',
          name: 'Field Wise Report',
          description: 'Covered area analysis by field',
          icon: FaChartBar,
          uiKind: 'ui-dense',
          component: EstateSprayedAreaReport,
        },
        {
          id: 'finance_plantation_date',
          name: 'Date Wise Report by Plantation',
          description: 'Breakdown by plantation over time',
          icon: FaCalendarCheck,
          uiKind: 'ui-dense',
          component: PlantationCoveredAreaReport,
        },
        {
          id: 'finance_plantation',
          name: 'Plantation Wise Report by Date',
          description: 'Compare plantations by date',
          icon: FaFileInvoiceDollar,
          uiKind: 'ui-dense',
          component: DailyCoveredAreaSummary,
        },
        {
          id: 'plan_execution_reasons',
          name: 'Plan Execution Reasons Report',
          description: 'Plan-wise covered and cancellation reasons',
          icon: FaTasks,
          uiKind: 'ui-dense',
          component: PlanExecutionReasonReport,
        },
        {
          id: 'deactivated_plans_reason',
          name: 'Deactivated with Reason',
          description: 'Plans deactivated in the period, with deactivate reason',
          icon: FaTimesCircle,
          uiKind: 'ui-dense',
          component: DeactivatedPlansReport,
        },
        {
          id: 'daily_drone_performance_month',
          name: 'Daily Drone Performance (Month-wise)',
          description: 'Drone × pilot DJI area, flight time and flights by day',
          icon: FaPlane,
          uiKind: 'ui-board',
          component: DailyDronePerformanceReport,
        },
        {
          id: 'daily_drone_operations_summary',
          name: 'Daily Drone Operations Summary',
          description: 'Day-wise KPIs, major issues and cancellation summary',
          icon: FaChartPie,
          uiKind: 'ui-board',
          component: DailyDroneOperationsSummaryReport,
        },
      ],
    },
    ops: {
      title: 'Operations Room Reports',
      reports: [
        {
          id: 'pilot_performance_combined',
          name: 'Pilot Performance',
          description: 'Field-level assigned vs Pilot / OpsRoom Ha with completion %',
          icon: FaPlane,
          uiKind: 'ui-board',
          component: PilotPerformanceCombined,
        },
        {
          id: 'pilot_summary_combined',
          name: 'Pilot Summary',
          description: 'Ranked pilot rollup with dual completion and %',
          icon: FaUsers,
          uiKind: 'ui-board',
          component: PilotSummaryCombined,
        },
        {
          id: 'pilot_date_combined',
          name: 'Pilot Performance by Date',
          description: 'Daily Pilot and OpsRoom completed Ha side by side',
          icon: FaCalendarCheck,
          uiKind: 'ui-board',
          component: PilotPerformanceByDateCombined,
        },
        {
          id: 'ops_plan',
          name: 'Operations Report (Plan wise)',
          description: 'Analysis by operational plans',
          icon: FaTasks,
          uiKind: 'ui-board',
          component: OperationsReportPlanWise,
        },
        {
          id: 'canceled_pilot',
          name: 'Canceled by Pilots',
          description: 'Pilot canceled and partially completed tasks with reasons',
          icon: FaTimesCircle,
          uiKind: 'ui-board',
          component: CanceledByPilots,
        },
        {
          id: 'canceled_ops_room',
          name: 'Canceled by Ops Room',
          description: 'Tasks canceled by ops room in day end process',
          icon: FaTimesCircle,
          uiKind: 'ui-board',
          component: CanceledByOpsRoom,
        },
        {
          id: 'deactivated_plans_reason_ops',
          name: 'Deactivated with Reason',
          description: 'Plans deactivated in the period, with deactivate reason',
          icon: FaTimesCircle,
          uiKind: 'ui-board',
          component: DeactivatedPlansReport,
        },
        {
          id: 'pilot_feedback',
          name: 'Pilot Feedbacks',
          description: 'Pilot feedback and comments',
          icon: FaComments,
          uiKind: 'ui-board',
          component: PilotFeedbacks,
        },
        {
          id: 'monthly_plantation',
          name: 'Monthly Plantation Report',
          description: 'Planned, Assigned & Covered by estate per month',
          icon: FaSeedling,
          uiKind: 'ui-board',
          component: MonthlyPlantationReport,
        },
        {
          id: 'billable_extents',
          name: 'Billable Extents',
          description: 'Field Ha vs DJI sprayed Ha vs Billing Ha, with chargeable reasons',
          icon: FaFileInvoiceDollar,
          uiKind: 'ui-board',
          component: BillableExtentsReport,
        },
        {
          id: 'daily_performance_summary',
          name: 'Daily Performance Summary',
          description: 'Daily targets, assigned, attended, completed (Ha)',
          icon: FaCalendarCheck,
          uiKind: 'ui-board',
          component: OpsroomDailyPerformanceSummary,
        },
        {
          id: 'pilot_daily_performance_summary',
          name: 'Pilot Daily Performance Summary',
          description: 'Daily metrics broken down pilot by pilot',
          icon: FaUserFriends,
          uiKind: 'ui-board',
          component: OpsroomPilotDailyPerformanceSummary,
        },
        {
          id: 'monthly_achievement_summary',
          name: 'Monthly Achievement Data',
          description: 'Month-wise target, assigned, attended, completed and achievement %',
          icon: FaChartBar,
          uiKind: 'ui-board',
          component: OpsroomMonthlyAchievementSummary,
        },
      ],
    },
    plantation: {
      title: 'Plantation Reports',
      reports: [
        {
          id: 'finance_date_plantation',
          name: 'Date Wise by Plantation',
          description: 'Timeline by plantation',
          icon: FaChartLine,
          uiKind: 'ui-editorial',
          component: PlantationCoveredAreaReport,
        },
        {
          id: 'finance_plantation_date',
          name: 'Plantation Wise by Date',
          description: 'Plantation comparison by date',
          icon: FaChartBar,
          uiKind: 'ui-editorial',
          component: DailyCoveredAreaSummary,
        },
        {
          id: 'chemicals',
          name: 'Chemicals Report',
          description: 'Chemical usage and analysis',
          icon: FaSeedling,
          uiKind: 'ui-editorial',
          component: ChemicalsReport,
        },
        {
          id: 'manager_approved_canceled',
          name: 'Manager Approved / Canceled',
          description: 'Manager field approvals and cancel reasons',
          icon: FaCheckCircle,
          uiKind: 'ui-editorial',
          component: ManagerApprovedCanceledReport,
        },
      ],
    },
  };

  return (
    <div className="modern-report-container modern-report-decision">
      <ReportsDecisionShell category={category} reportCatalog={reportCatalog} />
    </div>
  );
};

export default ModernReportSection;
