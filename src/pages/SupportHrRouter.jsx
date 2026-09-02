import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useHrSupportAuth } from '../sections/support/hr/auth/HrSupportAuthProvider';
import { hrSupportRequest, getHrSupportToken } from '../sections/support/hr/api/hrSupportApi';
import HrSupportShell from '../sections/support/hr/shell/HrSupportShell';
import RejectModal from '../sections/support/hr/components/RejectModal';

import HomeTab from '../sections/support/hr/tabs/HomeTab';
import AttendanceTab from '../sections/support/hr/tabs/AttendanceTab';
import LeaveTab from '../sections/support/hr/tabs/LeaveTab';
import GoalsTab from '../sections/support/hr/tabs/GoalsTab';
import TaskTab from '../sections/support/hr/tabs/TaskTab';
import HrAdminTab from '../sections/support/hr/tabs/HrAdminTab';
import ProfileTab from '../sections/support/hr/tabs/ProfileTab';

import '../styles/hrSupportShell.css';
import { splitApprovalsInbox } from '../sections/support/hr/utils/hrApprovals';

const DEFAULT_LEAVE_FORM = {
  leaveTypeCode: '',
  requestMode: 'full_day',
  startDate: '',
  endDate: '',
  shortLeaveMinutes: '120',
  halfDaySession: 'morning',
  shortLeaveSession: 'morning',
  reason: '',
  overlookingOfficerId: '',
};

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
}

function isAbortedRequestError(err) {
  return err?.name === 'AbortError' || /aborted|abort/i.test(String(err?.message || ''));
}

export default function SupportHrRouter() {
  const { token, logout, loginUser } = useHrSupportAuth();
  const navigate = useNavigate();

  // Session data state
  const [homeData, setHomeData] = useState(null);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [attendanceLog, setAttendanceLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [leaveForm, setLeaveForm] = useState(DEFAULT_LEAVE_FORM);
  const [rejectModal, setRejectModal] = useState(null); // { requestId, reason, kind }
  const [rejectLoading, setRejectLoading] = useState(false);

  const loadHome = useCallback(async () => {
    const activeToken = token || getHrSupportToken();
    if (!activeToken) return;
    setLoading(true);
    setError('');
    try {
      const runDashboard = () => hrSupportRequest('/api/hr/dashboard', activeToken, { method: 'POST', body: JSON.stringify({}) });

      const requests = [
        { key: 'dashboard', run: runDashboard },
        { key: 'types', run: () => hrSupportRequest('/api/hr/leave/types', activeToken, { method: 'POST', body: JSON.stringify({}) }) },
        { key: 'requests', run: () => hrSupportRequest('/api/hr/leave/my-requests', activeToken, { method: 'POST', body: JSON.stringify({}) }) },
        { key: 'tasks', run: () => hrSupportRequest('/api/hr/leave/approvals', activeToken, { method: 'POST', body: JSON.stringify({}) }) },
        { key: 'attendance', run: () => hrSupportRequest('/api/hr/attendance/log', activeToken, { method: 'POST', body: JSON.stringify({}) }) },
      ];

      let results = await Promise.allSettled(requests.map((item) => item.run()));
      const data = {};
      const failures = [];

      results.forEach((result, index) => {
        const { key } = requests[index];
        if (result.status === 'fulfilled') {
          data[key] = result.value;
          return;
        }
        if (key === 'dashboard' && result.reason?.isNetworkError) {
          failures.push({ key, message: result.reason?.message || 'Request failed', retry: true });
          return;
        }
        failures.push({ key, message: result.reason?.message || 'Request failed' });
      });

      if (!data.dashboard && failures.some((f) => f.key === 'dashboard' && f.retry)) {
        await new Promise((resolve) => { setTimeout(resolve, 400); });
        try {
          data.dashboard = await runDashboard();
          const retryIdx = failures.findIndex((f) => f.key === 'dashboard' && f.retry);
          if (retryIdx >= 0) failures.splice(retryIdx, 1);
        } catch (retryErr) {
          if (!isAbortedRequestError(retryErr)) {
            failures.push({ key: 'dashboard', message: retryErr?.message || 'Request failed' });
          }
        }
      }

      if (!data.dashboard) {
        const dashboardFailure = failures.find((f) => f.key === 'dashboard');
        const message = dashboardFailure?.message || failures[0]?.message || 'Failed to load HR data.';
        if (/employee profile not found|not linked to employee/i.test(message)) {
          throw new Error('Your account is not linked to employee records. Please contact administration.');
        }
        throw new Error(message);
      }

      const types = data.types || [];
      const requestableTypes = (types || []).filter((t) => {
        const isRequestable = Number(t?.employee_requestable ?? t?.employeeRequestable ?? 1) === 1;
        return isRequestable && String(t?.code || '') !== 'bulk_leave';
      });
      setHomeData(data.dashboard || null);
      setLeaveTypes(requestableTypes);
      setMyRequests(data.requests || []);
      setApprovals(data.tasks || []);
      setAttendanceLog(data.attendance || []);
      if (requestableTypes.length > 0) {
        setLeaveForm((f) => ({ ...f, leaveTypeCode: f.leaveTypeCode || requestableTypes[0]?.code || '' }));
      }
      if (failures.length > 0) {
        setError(failures.map((f) => f.message).join(' · '));
      }
    } catch (err) {
      if (isAbortedRequestError(err)) return;
      if (err?.status === 401 || err?.isAuthError) { logout(); return; }
      setError(err?.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [token, logout]);

  useEffect(() => { loadHome(); }, [loadHome]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadHome(); } catch { /* ignore */ } finally { setRefreshing(false); }
  }, [loadHome]);

  const profile = homeData?.profile ?? null;
  const balances = homeData?.balances ?? homeData?.effectiveBalances ?? [];
  const policySummary = homeData?.policySummary ?? homeData?.policy ?? null;
  const overlookingInbox = homeData?.overlookingInbox ?? [];
  const attendancePolicy = profile?.attendancePolicy ?? homeData?.attendancePolicy ?? null;
  const todayLeaveContext = homeData?.todayLeaveContext ?? null;
  const todayLateDeparture = homeData?.todayLateDeparture ?? null;
  const departmentEmployees = homeData?.departmentEmployees ?? [];

  const { reportingApprovals, hodApprovals } = useMemo(
    () => splitApprovalsInbox(approvals),
    [approvals],
  );

  const isReportingOfficer = Boolean(profile?.isReportingOfficer || profile?.is_reporting_officer);
  const isHod = Boolean(profile?.isHod || profile?.is_hod || profile?.canAccessHodTab);
  const canApproveLeaves = isReportingOfficer || reportingApprovals.length > 0;
  const canAccessHodTab = isHod || hodApprovals.length > 0;
  const canAccessHrManagement = Boolean(profile?.canAccessHrManagement || profile?.hrManagementAccess);
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

  const submitLeaveRequest = useCallback(async ({ attachmentUrls = [] } = {}) => {
    if (!token) return;
    const form = leaveForm;
    const requestMode = form.leaveTypeCode === 'short_leave'
      ? 'short'
      : (form.requestMode === 'short' ? 'full_day' : form.requestMode || 'full_day');
    const payload = {
      ...form,
      requestMode,
      shortLeaveMinutes: requestMode === 'short'
        ? Number(form.shortLeaveMinutes || 120)
        : Number(form.shortLeaveMinutes || 0),
      endDate: form.endDate || form.startDate,
      attachmentUrls,
      overlookingOfficerId: form.overlookingOfficerId ? Number(form.overlookingOfficerId) : null,
    };
    await hrSupportRequest('/api/hr/leave/request', token, { method: 'POST', body: JSON.stringify(payload) });
    const firstType = leaveTypes[0]?.code || '';
    setLeaveForm({ ...DEFAULT_LEAVE_FORM, leaveTypeCode: firstType });
    await loadHome();
  }, [token, leaveForm, leaveTypes, loadHome]);

  const markAttendance = useCallback(async (mode, lat, lng) => {
    if (!token) return;
    const payload = { mode };
    if (lat != null) payload.latitude = lat;
    if (lng != null) payload.longitude = lng;
    const result = await hrSupportRequest('/api/hr/attendance/mark', token, { method: 'POST', body: JSON.stringify(payload) });
    await loadHome();
    return result;
  }, [token, loadHome]);

  const submitLateDepartureRequest = useCallback(async (requestedUntilTime, reason) => {
    if (!token) return;
    await hrSupportRequest('/api/hr/attendance/late-departure/request', token, { method: 'POST', body: JSON.stringify({ requestedUntilTime, reason }) });
    await loadHome();
  }, [token, loadHome]);

  const actApproval = useCallback(async (requestId, action, rejectReason, approvalKind = 'leave') => {
    if (!token) return;
    if (action === 'reject' && !rejectReason) {
      setRejectModal({ requestId, reason: '', kind: approvalKind });
      return;
    }
    const endpoint = approvalKind === 'late_departure' ? '/api/hr/attendance/late-departure/decide' : '/api/hr/leave/decide';
    await hrSupportRequest(endpoint, token, { method: 'POST', body: JSON.stringify({ requestId, action, rejectReason: rejectReason || null }) });
    await loadHome();
  }, [token, loadHome]);

  const actOverlookingDecision = useCallback(async (requestId, action, rejectReason) => {
    if (!token) return;
    if (action === 'decline' && !rejectReason) {
      setRejectModal({ requestId, reason: '', kind: 'overlooking' });
      return;
    }
    await hrSupportRequest('/api/hr/leave/overlooking/decide', token, { method: 'POST', body: JSON.stringify({ requestId, action, rejectReason: rejectReason || null }) });
    await loadHome();
  }, [token, loadHome]);

  const submitRejectModal = async () => {
    if (!rejectModal?.reason?.trim()) return;
    setRejectLoading(true);
    try {
      const { requestId, reason, kind } = rejectModal;
      setRejectModal(null);
      if (kind === 'overlooking') {
        await actOverlookingDecision(requestId, 'decline', reason);
      } else {
        await actApproval(requestId, 'reject', reason, kind);
      }
    } catch (err) {
      setError(err?.message || 'Failed to submit rejection.');
    } finally {
      setRejectLoading(false);
    }
  };

  if (loading && !homeData) {
    return (
      <div className="hrsup-shell hrsup-shell--loading">
        <div className="hrsup-loading-spinner" aria-hidden="true" />
        <span>Loading HR portal…</span>
      </div>
    );
  }

  return (
    <>
      {rejectModal && (
        <RejectModal
          value={rejectModal.reason}
          onChange={(v) => setRejectModal((m) => ({ ...m, reason: v }))}
          onSubmit={submitRejectModal}
          onClose={() => setRejectModal(null)}
          loading={rejectLoading}
        />
      )}
      <Routes>
        <Route
          element={
            <HrSupportShell
              canAccessHodTab={canAccessHodTab}
              canAccessHrManagement={canAccessHrManagement}
              canApproveLeaves={canApproveLeaves}
              profile={profile}
              loginUser={loginUser}
              hodApprovals={hodApprovals}
              reportingApprovals={reportingApprovals}
            />
          }
        >
          <Route
            path="home"
            element={
              <HomeTab
                token={token}
                homeData={homeData}
                profile={profile}
                balances={balances}
                policySummary={policySummary}
                leaveTypes={leaveTypes}
                overlookingInbox={overlookingInbox}
                loading={loading}
                refreshing={refreshing}
                refresh={refresh}
                actOverlookingDecision={actOverlookingDecision}
              />
            }
          />
          <Route
            path="attendance"
            element={
              <AttendanceTab
                token={token}
                attendanceLog={attendanceLog}
                markAttendance={markAttendance}
                submitLateDepartureRequest={submitLateDepartureRequest}
                attendancePolicy={attendancePolicy}
                todayLeaveContext={todayLeaveContext}
                todayLateDeparture={todayLateDeparture}
                profile={profile}
                workLocation={profile?.workLocation}
                refreshing={refreshing}
                refresh={refresh}
                loading={loading}
              />
            }
          />
          <Route
            path="leave"
            element={
              <LeaveTab
                token={token}
                leaveTypes={leaveTypes}
                leaveForm={leaveForm}
                setLeaveForm={setLeaveForm}
                submitLeaveRequest={submitLeaveRequest}
                myRequests={myRequests}
                approvals={reportingApprovals}
                actApproval={actApproval}
                canApproveLeaves={canApproveLeaves}
                departmentEmployees={departmentEmployees}
                departmentName={profile?.departmentName || profile?.department || null}
                refreshing={refreshing}
                refresh={refresh}
                canRequestLeave={canRequestLeave}
                attendancePolicy={attendancePolicy}
                balances={balances}
                policySummary={policySummary}
              />
            }
          />
          <Route
            path="goals"
            element={<GoalsTab token={token} refreshing={refreshing} onRefresh={refresh} />}
          />
          {canAccessHodTab && (
            <Route
              path="task"
              element={
                <TaskTab
                  hodApprovals={hodApprovals}
                  actApproval={actApproval}
                  refreshing={refreshing}
                  refresh={refresh}
                />
              }
            />
          )}
          {canAccessHrManagement && (
            <Route
              path="hr-admin"
              element={<HrAdminTab token={token} refreshing={refreshing} refresh={refresh} />}
            />
          )}
          <Route
            path="profile"
            element={
              <ProfileTab
                token={token}
                profile={profile}
                loginUser={loginUser}
                refreshing={refreshing}
                onRefresh={refresh}
              />
            }
          />
          <Route path="*" element={<Navigate to="home" replace />} />
        </Route>
      </Routes>

      {error && (
        <div style={{ position: 'fixed', bottom: 80, left: 16, right: 16, zIndex: 9000 }}>
          <div className="hrsup-error-box">
            {error}
            <button type="button" className="hrsup-error-dismiss" onClick={() => setError('')}>✕</button>
          </div>
        </div>
      )}
    </>
  );
}
