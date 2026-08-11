/**
 * Operation Digitalization wing: minimal shell (no left nav) on workflow routes when ?wing= matches.
 * Title must match navbarCategories.js / wing hub card title exactly.
 */
export const OD_WING_OPERATION_DIGITALIZATION_TITLE =
  'Operation Digitalization & Digital Monitoring & Evaluation Wing';

/** Routes reachable from Workflow Dashboard / opsroom flows — same family as LeftNavBar workflow aliases. */
const OD_WORKFLOW_PATH_PREFIXES = [
  '/home/workflowDashboard',
  '/home/requestsQueue',
  '/home/managerApprovalQueue',
  '/home/pilotAssignment',
  '/home/pendingPaymentQueue',
  '/home/droneUnlockingQueue',
  '/home/opsAsign',
  '/home/dayEndProcess',
  '/home/djiMapUpload',
  '/home/opsroomPlanCalendar',
  '/home/todayPlans',
  '/home/emergencyMoving',
  '/home/fieldHistory',
  '/home/reports/ops',
  '/home/fieldSizeAdjustments',
  '/home/requestProceed',
  '/home/monthlyRequestProceed',
  '/home/planCustomization',
];

export function isOdWingWorkflowShellPath(pathname) {
  return OD_WORKFLOW_PATH_PREFIXES.some(
    (base) => pathname === base || pathname.startsWith(`${base}/`)
  );
}
