import { useCallback, useRef, useState } from 'react';
import { hrSupportRequest } from '../api/hrSupportApi';
import { splitApprovalsInbox } from '../utils/hrApprovals';

export default function useHrSupportSession(token) {
  const [homeData, setHomeData] = useState(null);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [attendanceLog, setAttendanceLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const loadingRef = useRef(false);

  const loadHome = useCallback(async (tok) => {
    const t = tok ?? token;
    if (!t || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError('');
    try {
      const [dashboard, types, requests, tasks, attendance] = await Promise.all([
        hrSupportRequest('/api/hr/dashboard', t, { method: 'POST', body: JSON.stringify({}) }),
        hrSupportRequest('/api/hr/leave/types', t, { method: 'POST', body: JSON.stringify({}) }),
        hrSupportRequest('/api/hr/leave/my-requests', t, { method: 'POST', body: JSON.stringify({}) }),
        hrSupportRequest('/api/hr/leave/approvals', t, { method: 'POST', body: JSON.stringify({}) }),
        hrSupportRequest('/api/hr/attendance/log', t, { method: 'POST', body: JSON.stringify({}) }),
      ]);
      const requestableTypes = (types || []).filter((type) => {
        const isRequestable = Number(type?.employee_requestable ?? type?.employeeRequestable ?? 1) === 1;
        return isRequestable && String(type?.code || '') !== 'bulk_leave';
      });
      setHomeData(dashboard || null);
      setLeaveTypes(requestableTypes);
      setMyRequests(requests || []);
      setApprovals(tasks || []);
      setAttendanceLog(attendance || []);
    } catch (err) {
      setError(err?.message || 'Failed to load data.');
      throw err;
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [token]);

  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await loadHome();
      setError('');
    } catch (err) {
      setError(err?.message || 'Refresh failed.');
    } finally {
      setRefreshing(false);
    }
  }, [loadHome, refreshing]);

  const profile = homeData?.profile ?? null;
  const balances = homeData?.balances ?? homeData?.effectiveBalances ?? [];
  const policySummary = homeData?.policySummary ?? homeData?.policy ?? null;
  const overlookingInbox = homeData?.overlookingInbox ?? [];
  const totalLeaveAvailable = homeData?.totalLeaveAvailable ?? 0;
  const totalLeaveUsed = homeData?.totalLeaveUsed ?? 0;

  const { reportingApprovals, hodApprovals } = splitApprovalsInbox(approvals);
  const isReportingOfficer = Boolean(profile?.isReportingOfficer || profile?.is_reporting_officer);
  const isHod = Boolean(profile?.isHod || profile?.is_hod || profile?.canAccessHodTab);
  const canApproveLeaves = isReportingOfficer || reportingApprovals.length > 0;
  const canAccessHodTab = isHod || hodApprovals.length > 0;
  const canAccessHrManagement = Boolean(
    profile?.canAccessHrManagement ||
    profile?.hrManagementAccess ||
  false,
  );
  const canRequestLeave = Boolean(
    profile?.leaveRequestAllowed ??
    profile?.leaveApproverMappingComplete ??
    profile?.isSeniorManagement ??
    profile?.is_senior_management ??
    (
      (profile?.reportingOfficerId || profile?.reporting_officer_id) &&
      (profile?.hodId || profile?.hod_id)
    ),
  );
  const departmentEmployees = homeData?.departmentEmployees ?? [];

  return {
    homeData,
    profile,
    balances,
    policySummary,
    overlookingInbox,
    totalLeaveAvailable,
    totalLeaveUsed,
    leaveTypes,
    myRequests,
    approvals,
    reportingApprovals,
    hodApprovals,
    attendanceLog,
    loading,
    refreshing,
    error,
    setError,
    loadHome,
    refresh,
    canApproveLeaves,
    canAccessHodTab,
    canAccessHrManagement,
    canRequestLeave,
    departmentEmployees,
  };
}
