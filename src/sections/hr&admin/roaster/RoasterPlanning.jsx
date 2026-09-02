import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Bars } from 'react-loader-spinner';
import '../../../styles/roasterPlanning.css';
import { useGetHrRosterPlanQuery, useSaveHrRosterPlanMutation } from '../../../api/services NodeJs/hrLeaveApi';
import { useGetAllEmployeeRegistrationsQuery } from '../../../api/services NodeJs/jdManagementApi';
import {
  leaveStatusLabel,
  locationValidLabel,
  overlookingStatusLabel,
  requestModeLabel,
  GEOFENCE_RADIUS_METERS,
  formatAttendanceDistanceDetail,
  isOutsideGeofenceRange,
} from '../../../utils/hrStatusLabels';

const formatDate = (year, month, day) => {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const normalizeDateKey = (value) => {
  if (!value) return '';
  const toUtcDateKey = (dateObj) => {
    if (!dateObj || Number.isNaN(dateObj.getTime())) return '';
    return dateObj.toISOString().slice(0, 10);
  };
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toUtcDateKey(value);
  }
  const text = String(value);
  const directMatch = text.match(/\d{4}-\d{2}-\d{2}/);
  if (directMatch) return directMatch[0];
  const parsed = new Date(text.replace(' ', 'T'));
  if (!Number.isNaN(parsed.getTime())) {
    return toUtcDateKey(parsed);
  }
  return text.slice(0, 10);
};

const getApprovalRank = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'approved') return 3;
  if (normalized === 'pending_l2') return 2;
  if (normalized === 'pending_l1') return 1;
  return 0;
};

const pickHigherApprovalStatus = (a, b) => {
  return getApprovalRank(b) > getApprovalRank(a) ? b : a;
};

const buildApprovalDetailLines = (item) => {
  const s = String(item.currentStatus || '').toLowerCase();
  const l1name = item.level1Name || 'Unknown';
  const l2name = item.level2Name || 'Unknown';
  const lines = [];

  if (s === 'approved') lines.push('Status: Fully approved');
  else if (s === 'pending_l2') lines.push('Status: Awaiting department head');
  else if (s === 'pending_l1') lines.push('Status: Awaiting reporting officer');
  else lines.push(`Status: ${leaveStatusLabel(item.currentStatus)}`);

  if (item.level1Action === 'approved') {
    lines.push(`Reporting officer (${l1name}): Approved`);
  } else if (item.level1Action === 'rejected') {
    lines.push(`Reporting officer (${l1name}): Rejected`);
  } else if (s === 'pending_l1') {
    lines.push(`Reporting officer (${l1name}): Not approved yet`);
  } else {
    lines.push(`Reporting officer (${l1name}): Approved`);
  }

  if (s === 'pending_l1') {
    lines.push(`Department head (${l2name}): Waiting (after reporting officer)`);
  } else if (item.level2Action === 'approved') {
    lines.push(`Department head (${l2name}): Approved`);
  } else if (item.level2Action === 'rejected') {
    lines.push(`Department head (${l2name}): Rejected`);
  } else if (s === 'pending_l2') {
    lines.push(`Department head (${l2name}): Not approved yet`);
  } else {
    lines.push(`Department head (${l2name}): Approved`);
  }

  if (item.overlookingOfficerName) {
    const overLabel = overlookingStatusLabel(item.overlookingStatus);
    lines.push(`Overlooking officer (${item.overlookingOfficerName}): ${overLabel}`);
  }

  return lines;
};

const APPROVAL_POPUP_W = 300;
const APPROVAL_POPUP_H = 280;
const APPROVAL_POPUP_PAD = 10;

function computeApprovalPopupPosition(clientX, clientY, dayIndex, daysInMonth, rowIndex, rowCount) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const isFirstCol = dayIndex === 0;
  const isLastCol = daysInMonth > 1 && dayIndex === daysInMonth - 1;

  let left = clientX + 12;
  if (isLastCol) {
    left = clientX - APPROVAL_POPUP_W - 12;
  } else if (isFirstCol) {
    left = clientX + 12;
  } else if (clientX + 12 + APPROVAL_POPUP_W > vw - APPROVAL_POPUP_PAD) {
    left = clientX - APPROVAL_POPUP_W - 12;
  }
  left = Math.min(Math.max(left, APPROVAL_POPUP_PAD), vw - APPROVAL_POPUP_W - APPROVAL_POPUP_PAD);

  let top = clientY + 12;
  const isFirstRow = rowIndex === 0;
  const isLastRow = rowCount > 1 && rowIndex === rowCount - 1;
  if (isLastRow || top + APPROVAL_POPUP_H > vh - APPROVAL_POPUP_PAD) {
    top = clientY - APPROVAL_POPUP_H - 12;
  }
  if (isFirstRow && top < APPROVAL_POPUP_PAD) {
    top = clientY + 12;
  }
  top = Math.min(Math.max(top, APPROVAL_POPUP_PAD), vh - APPROVAL_POPUP_H - APPROVAL_POPUP_PAD);

  return { left, top };
}

const rosterDraftStorageKey = (monthKey) => `dsms_roster_draft_${monthKey}`;

/** Comma-separated tooltip: what Save Roster does */
const SAVE_ROSTER_HELP =
  'Writes every day for this month to the server, stores bulk leave in the database, clears the on-screen draft, reloads roster from the server';
const SAVE_ROSTER_HELP_LINES = SAVE_ROSTER_HELP.split(',').map((line) => line.trim()).filter(Boolean);

const leaveDaysSignature = (days) => JSON.stringify([...new Set(days || [])].sort());

const buildServerLeaveSetById = (rows) => {
  const m = new Map();
  (rows || []).forEach((e) => {
    m.set(e.id, new Set(e.leaveDays || []));
  });
  return m;
};

const normalizeFilterText = (value) => String(value || '').trim().toLowerCase();
const attendanceKey = (employeeId, dateKey) => `${Number(employeeId)}|${dateKey}`;
const toBoolText = (value) => locationValidLabel(value);
const statusLabel = (status) => leaveStatusLabel(status);
const formatTimeOnly = (value) => {
  if (!value) return '-';
  const dt = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(dt.getTime())) {
    const parts = String(value).split(' ');
    return parts[1] || String(value);
  }
  return dt.toLocaleTimeString();
};
const formatWorkedHours = (minutesRaw) => {
  const total = Number(minutesRaw);
  if (!Number.isFinite(total) || total < 0) return '-';
  const hours = Math.floor(total / 60);
  const mins = Math.round(total % 60);
  return `${hours}h ${mins}m`;
};
const formatPopupDate = (dateKey) => {
  if (!dateKey) return '—';
  const d = new Date(`${String(dateKey).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(dateKey);
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
};
const buildMapUrl = (lat, lng) => {
  if (lat == null || lng == null) return '';
  return `https://www.google.com/maps?q=${lat},${lng}`;
};
const buildWorkLocationSiteLabel = (detail = {}, fallback = '-') => {
  return (
    detail.work_location_site_name ||
    detail.employee_work_location_name ||
    detail.employee_work_location_code ||
    fallback
  );
};
const buildWorkLocationCoordsLabel = (detail = {}) => {
  const lat = detail.work_location_latitude;
  const lng = detail.work_location_longitude;
  if (lat == null || lng == null || lat === '' || lng === '') return 'Coordinates not set';
  return `${Number(lat)}, ${Number(lng)}`;
};
const hasAttendanceLocationIssue = (detail, radiusMeters) => {
  if (!detail) return false;
  return (
    isOutsideGeofenceRange(detail.mark_in_distance_meters, detail.mark_in_location_valid, radiusMeters) ||
    isOutsideGeofenceRange(detail.mark_out_distance_meters, detail.mark_out_location_valid, radiusMeters)
  );
};
const getEmployeeWorkLocation = (empLike = {}) => {
  return (
    empLike.workLocationName ||
    empLike.work_location_name ||
    empLike.workLocation ||
    empLike.work_location ||
    empLike.workLocationCode ||
    empLike.work_location_code ||
    '-'
  );
};

const getMonthDays = (monthValue) => {
  const [year, month] = monthValue.split('-').map(Number);
  const totalDays = new Date(year, month, 0).getDate();
  return Array.from({ length: totalDays }, (_, idx) => {
    const day = idx + 1;
    const dateObj = new Date(year, month - 1, day);
    const weekday = dateObj.toLocaleString('en-US', { weekday: 'short' });
    return {
      label: String(day).padStart(2, '0'),
      weekday,
      dateString: formatDate(year, month, day),
      isWeekend: [0, 6].includes(dateObj.getDay()),
    };
  });
};

const RoasterPlanning = ({ embedded = false }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [editableRows, setEditableRows] = useState({});
  const [saveStatus, setSaveStatus] = useState('');
  const [localRoster, setLocalRoster] = useState([]);
  const [designationFilter, setDesignationFilter] = useState('all');
  const [workLocationFilter, setWorkLocationFilter] = useState('all');
  const [nameFilter, setNameFilter] = useState('');
  const [approvalPopup, setApprovalPopup] = useState(null);
  const [attendancePopup, setAttendancePopup] = useState(null);
  const [unsavedHighlightActive, setUnsavedHighlightActive] = useState(false);
  const [saveHelpOpen, setSaveHelpOpen] = useState(false);
  const [navConfirmOpen, setNavConfirmOpen] = useState(false);
  const [pendingHash, setPendingHash] = useState('');
  const [pendingPathLabel, setPendingPathLabel] = useState('');
  const [savingBeforeNav, setSavingBeforeNav] = useState(false);
  const saveHelpRef = useRef(null);
  const { data: employeeResponse } = useGetAllEmployeeRegistrationsQuery();
  const employeesRaw = employeeResponse?.data || employeeResponse?.employees || [];
  const {
    data: rosterResponse,
    refetch,
    isLoading: rosterLoadingInitial,
    isFetching: rosterFetching,
  } = useGetHrRosterPlanQuery({ monthKey: selectedMonth });
  const [saveRosterPlan, { isLoading: savingRoster }] = useSaveHrRosterPlanMutation();

  const monthDays = useMemo(() => getMonthDays(selectedMonth), [selectedMonth]);
  const dayGridStyle = useMemo(() => ({}), []);
  const rosterEntries = rosterResponse?.data?.entries || rosterResponse?.entries || [];
  const attendanceRows = rosterResponse?.data?.attendanceRows || rosterResponse?.attendanceRows || [];
  const leaveRequestRows = rosterResponse?.data?.leaveRequestRows || rosterResponse?.leaveRequestRows || [];
  const holidayRows = rosterResponse?.data?.holidayRows || rosterResponse?.holidayRows || [];
  const geofenceRadiusMeters = Number(
    rosterResponse?.data?.geofenceRadiusMeters
    ?? rosterResponse?.geofenceRadiusMeters
    ?? GEOFENCE_RADIUS_METERS
  );
  const rosterLoading = rosterLoadingInitial || rosterFetching;

  const holidayMetaByDate = useMemo(() => {
    const map = {};
    (holidayRows || []).forEach((row) => {
      const key = normalizeDateKey(row.holiday_date);
      if (!key) return;
      const t = String(row.holiday_type || '').toLowerCase();
      if (t === 'mercantile' || t === 'poya' || t === 'special') {
        map[key] = {
          type: t,
          description: row.description != null ? String(row.description).trim() : '',
        };
      }
    });
    return map;
  }, [holidayRows]);

  const holidayHoverLine = (dateString) => {
    const meta = holidayMetaByDate[dateString];
    if (!meta?.type) return '';
    const kind =
      meta.type === 'mercantile'
        ? 'Statutory holiday'
        : meta.type === 'poya'
          ? 'Poya holiday'
          : meta.type === 'special'
            ? 'Special holiday'
            : 'Holiday';
    return meta.description ? ` | ${kind}: ${meta.description}` : ` | ${kind}`;
  };

  const leaveApprovalDetailsByKey = useMemo(() => {
    const map = new Map();
    (leaveRequestRows || []).forEach((row) => {
      const id = Number(row.employee_id);
      const dateKey = normalizeDateKey(row.leave_date);
      if (!dateKey || !Number.isFinite(id)) return;
      const key = `${id}|${dateKey}`;
      const entry = {
        leaveRequestId: row.leave_request_id,
        currentStatus: String(row.current_status || '').toLowerCase(),
        level1Name: row.level1_approver_name || `Employee ${row.level1_approver_id ?? ''}`,
        level2Name: row.level2_approver_name || `Employee ${row.level2_approver_id ?? ''}`,
        level1Action: row.level1_action ? String(row.level1_action).toLowerCase() : null,
        level2Action: row.level2_action ? String(row.level2_action).toLowerCase() : null,
        overlookingOfficerName: row.overlooking_officer_name || '',
        overlookingStatus: row.overlooking_status || 'pending',
      };
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(entry);
    });
    return map;
  }, [leaveRequestRows]);
  const leaveRequestDetailsByKey = useMemo(() => {
    const map = new Map();
    (leaveRequestRows || []).forEach((row) => {
      const id = Number(row.employee_id);
      const dateKey = normalizeDateKey(row.leave_date);
      if (!Number.isFinite(id) || !dateKey) return;
      const key = attendanceKey(id, dateKey);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({
        leaveType: row.leave_type_name || row.leave_type_code || '-',
        reason: row.reason || '',
        status: row.current_status || '',
        overlookingOfficerName: row.overlooking_officer_name || '',
        overlookingStatus: row.overlooking_status || 'pending',
      });
    });
    return map;
  }, [leaveRequestRows]);

  const openApprovalPopup = (e, employeeName, employeeId, dateString, dayIndex, rowIndex, rowCount) => {
    e.stopPropagation();
    e.preventDefault();
    const key = `${Number(employeeId)}|${dateString}`;
    const items = leaveApprovalDetailsByKey.get(key) || [];
    const sections =
      items.length > 0
        ? items.map((it, idx) => ({
            heading: items.length > 1 ? `Leave request ${idx + 1}` : null,
            lines: buildApprovalDetailLines(it),
          }))
        : [
            {
              heading: null,
              lines: [
                'No approval details are available for this cell.',
                'Refresh the page after updating the server, or check that this day has a leave request.',
              ],
            },
          ];
    const { left, top } = computeApprovalPopupPosition(
      e.clientX,
      e.clientY,
      dayIndex,
      monthDays.length,
      rowIndex,
      rowCount
    );
    setApprovalPopup({
      open: true,
      left,
      top,
      title: `${employeeName} · ${dateString}`,
      sections,
    });
  };

  const rosterFromServer = useMemo(() => {
    const byEmployee = {};
    rosterEntries.forEach((entry) => {
      const id = Number(entry.employee_id);
      if (!byEmployee[id]) {
        byEmployee[id] = {
          id,
          name: entry.employeeName || `Employee ${id}`,
          role: entry.employeeJobRoleName || '-',
          workLocation: getEmployeeWorkLocation(entry),
          isBulkLeaveEligible: Number(entry.bulkLeaveAvailable ?? entry.bulk_leave_available ?? 0) === 1,
          leaveDays: [],
          requestedLeaveDays: [],
          requestedLeaveStatusByDate: {},
          attendance: { attended: [], absent: [] },
        };
      }
      const workDateKey = normalizeDateKey(entry.work_date_key || entry.work_date);
      if (Number(entry.leave_planned) === 1) {
        byEmployee[id].leaveDays.push(workDateKey);
      }
      if (Number(entry.has_leave_request) === 1) {
        byEmployee[id].requestedLeaveDays.push(workDateKey);
        byEmployee[id].requestedLeaveStatusByDate[workDateKey] = pickHigherApprovalStatus(
          byEmployee[id].requestedLeaveStatusByDate[workDateKey],
          entry.leave_request_status
        );
      }
      const attendanceStatus = String(entry.attendance_status || '').toLowerCase();
      if (attendanceStatus === 'present') {
        byEmployee[id].attendance.attended.push(workDateKey);
      } else if (attendanceStatus === 'absent') {
        byEmployee[id].attendance.absent.push(workDateKey);
      }
    });

    leaveRequestRows.forEach((requestRow) => {
      const id = Number(requestRow.employee_id);
      if (!byEmployee[id]) {
        byEmployee[id] = {
          id,
          name: `Employee ${id}`,
          role: '-',
          workLocation: '-',
          leaveDays: [],
          requestedLeaveDays: [],
          requestedLeaveStatusByDate: {},
          attendance: { attended: [], absent: [] },
        };
      }
      const leaveDateKey = normalizeDateKey(requestRow.leave_date);
      byEmployee[id].requestedLeaveDays.push(leaveDateKey);
      byEmployee[id].requestedLeaveStatusByDate[leaveDateKey] = pickHigherApprovalStatus(
        byEmployee[id].requestedLeaveStatusByDate[leaveDateKey],
        requestRow.current_status
      );
    });

    attendanceRows.forEach((attendanceRow) => {
      const id = Number(attendanceRow.employee_id);
      if (!byEmployee[id]) {
        byEmployee[id] = {
          id,
          name: `Employee ${id}`,
          role: '-',
          workLocation: '-',
          leaveDays: [],
          requestedLeaveDays: [],
          requestedLeaveStatusByDate: {},
          attendance: { attended: [], absent: [] },
        };
      }
      const attendanceStatus = String(attendanceRow.status || '').toLowerCase();
      const dateKey = normalizeDateKey(attendanceRow.attendance_date);
      if (attendanceStatus === 'present') {
        byEmployee[id].attendance.attended.push(dateKey);
      } else if (attendanceStatus === 'absent') {
        byEmployee[id].attendance.absent.push(dateKey);
      }
    });

    const normalized = (employeesRaw || []).map((emp) => {
      const id = Number(emp.id);
      if (byEmployee[id]) {
        return {
          ...byEmployee[id],
          name: emp.employeeName || emp.name || byEmployee[id].name || `Employee ${id}`,
          role: emp.employeeJobRoleName || emp.designation || byEmployee[id].role || '-',
          workLocation: getEmployeeWorkLocation(emp) || byEmployee[id].workLocation || '-',
          isBulkLeaveEligible: Number(emp.bulkLeaveAvailable ?? byEmployee[id].isBulkLeaveEligible ?? 0) === 1,
        };
      }
      return {
        id,
        name: emp.employeeName || emp.name || `Employee ${id}`,
        role: emp.employeeJobRoleName || emp.designation || '-',
        workLocation: getEmployeeWorkLocation(emp),
        isBulkLeaveEligible: Number(emp.bulkLeaveAvailable ?? 0) === 1,
        leaveDays: [],
        requestedLeaveDays: [],
        requestedLeaveStatusByDate: {},
        attendance: { attended: [], absent: [] },
      };
    });

    return normalized;
  }, [employeesRaw, rosterEntries, attendanceRows, leaveRequestRows]);

  const roster = localRoster.length ? localRoster : rosterFromServer;
  const attendanceDetailsByKey = useMemo(() => {
    const map = new Map();
    (attendanceRows || []).forEach((row) => {
      const id = Number(row.employee_id);
      const dateKey = normalizeDateKey(row.attendance_date);
      if (!Number.isFinite(id) || !dateKey) return;
      const key = attendanceKey(id, dateKey);
      if (!map.has(key)) map.set(key, row);
    });
    return map;
  }, [attendanceRows]);
  const designationOptions = useMemo(() => {
    const values = new Set();
    roster.forEach((emp) => {
      const role = String(emp.role || '').trim();
      if (role) values.add(role);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [roster]);
  const workLocationOptions = useMemo(() => {
    const values = new Set();
    roster.forEach((emp) => {
      const location = String(emp.workLocation || '').trim();
      if (location && location !== '-') values.add(location);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [roster]);

  const filteredRoster = useMemo(() => {
    const normalizedName = normalizeFilterText(nameFilter);
    return roster.filter((emp) => {
      const roleMatches = designationFilter === 'all' || String(emp.role || '').trim() === designationFilter;
      if (!roleMatches) return false;
      const locationMatches = workLocationFilter === 'all' || String(emp.workLocation || '').trim() === workLocationFilter;
      if (!locationMatches) return false;
      if (!normalizedName) return true;
      const employeeName = normalizeFilterText(emp.name);
      const employeeRole = normalizeFilterText(emp.role);
      const employeeLocation = normalizeFilterText(emp.workLocation);
      return (
        employeeName.includes(normalizedName) ||
        employeeRole.includes(normalizedName) ||
        employeeLocation.includes(normalizedName)
      );
    });
  }, [designationFilter, workLocationFilter, nameFilter, roster]);

  const serverLeaveSetByEmployeeId = useMemo(() => buildServerLeaveSetById(rosterFromServer), [rosterFromServer]);

  const unsavedEmployeeIds = useMemo(() => {
    if (localRoster.length === 0) return new Set();
    const serverById = new Map(rosterFromServer.map((e) => [e.id, e]));
    const ids = new Set();
    localRoster.forEach((loc) => {
      const srv = serverById.get(loc.id);
      const a = leaveDaysSignature(loc.leaveDays);
      const b = leaveDaysSignature(srv?.leaveDays);
      if (a !== b) ids.add(loc.id);
    });
    return ids;
  }, [localRoster, rosterFromServer]);
  const canSaveRoster = unsavedEmployeeIds.size > 0;
  const hasUnsavedChanges = saveStatus === 'Unsaved changes' && localRoster.length > 0;

  useEffect(() => {
    if (localRoster.length === 0 || saveStatus !== 'Unsaved changes') {
      setUnsavedHighlightActive(false);
    }
  }, [localRoster.length, saveStatus]);

  useEffect(() => {
    if (!saveHelpOpen) return undefined;
    const onDocPointerDown = (event) => {
      if (!saveHelpRef.current?.contains(event.target)) {
        setSaveHelpOpen(false);
      }
    };
    const onEsc = (event) => {
      if (event.key === 'Escape') setSaveHelpOpen(false);
    };
    document.addEventListener('mousedown', onDocPointerDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocPointerDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [saveHelpOpen]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(rosterDraftStorageKey(selectedMonth));
      if (!raw) {
        setLocalRoster([]);
        setSaveStatus('');
        setEditableRows({});
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.localRoster) && parsed.localRoster.length > 0) {
        setLocalRoster(parsed.localRoster);
        setSaveStatus(parsed.saveStatus || 'Unsaved changes');
        setEditableRows(parsed.editableRows && typeof parsed.editableRows === 'object' ? parsed.editableRows : {});
      } else {
        setLocalRoster([]);
        setSaveStatus('');
        setEditableRows({});
      }
    } catch {
      setLocalRoster([]);
      setSaveStatus('');
      setEditableRows({});
    }
  }, [selectedMonth]);

  useEffect(() => {
    if (localRoster.length === 0) return;
    try {
      sessionStorage.setItem(
        rosterDraftStorageKey(selectedMonth),
        JSON.stringify({
          localRoster,
          saveStatus: saveStatus || 'Unsaved changes',
          editableRows,
        })
      );
    } catch {
      /* ignore quota / private mode */
    }
  }, [localRoster, selectedMonth, saveStatus, editableRows]);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const onDocClickCapture = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href]');
      if (!anchor) return;
      if (anchor.target === '_blank') return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const href = anchor.getAttribute('href') || '';
      const nextHash = href.startsWith('#') ? href : (() => {
        try {
          return new URL(anchor.href, window.location.origin).hash || '';
        } catch {
          return '';
        }
      })();
      if (!nextHash || nextHash === window.location.hash) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHash(nextHash);
      setPendingPathLabel(nextHash.replace(/^#/, '') || nextHash);
      setNavConfirmOpen(true);
    };
    document.addEventListener('click', onDocClickCapture, true);
    return () => document.removeEventListener('click', onDocClickCapture, true);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges]);

  const toggleRowEdit = (employeeId) => {
    const employee = roster.find((row) => Number(row.id) === Number(employeeId));
    if (!employee?.isBulkLeaveEligible) return;
    setEditableRows((prev) => ({ ...prev, [employeeId]: !prev[employeeId] }));
  };

  const handleDayClick = (employeeId, dateString) => {
    const employee = roster.find((row) => Number(row.id) === Number(employeeId));
    if (!employee?.isBulkLeaveEligible) return;
    if (!editableRows[employeeId]) return;

    const nextRoster = roster.map((emp) => {
      if (emp.id !== employeeId) return emp;
      const hasDay = emp.leaveDays.includes(dateString);
      return {
        ...emp,
        leaveDays: hasDay ? emp.leaveDays.filter((day) => day !== dateString) : [...emp.leaveDays, dateString],
      };
    });
    setSaveStatus('Unsaved changes');
    setLocalRoster(nextRoster);
  };

  const saveChanges = async () => {
    try {
      const entries = [];
      roster.forEach((emp) => {
        monthDays.forEach((day) => {
          entries.push({
            employeeId: emp.id,
            workDate: day.dateString,
            shiftCode: null,
            shiftLabel: null,
            leavePlanned: emp.leaveDays.includes(day.dateString),
          });
        });
      });
      await saveRosterPlan({ monthKey: selectedMonth, entries }).unwrap();
      setSaveStatus('Roster saved');
      setLocalRoster([]);
      setEditableRows({});
      try {
        sessionStorage.removeItem(rosterDraftStorageKey(selectedMonth));
      } catch {
        /* ignore */
      }
      refetch();
      return true;
    } catch (error) {
      setSaveStatus(error?.data?.message || 'Failed to save roster');
      return false;
    }
  };

  const continueNavigation = () => {
    if (pendingHash) {
      window.location.hash = pendingHash;
    }
    setPendingHash('');
    setPendingPathLabel('');
    setNavConfirmOpen(false);
  };

  const handleIgnoreNavigation = () => {
    continueNavigation();
  };

  const handleSaveThenNavigate = async () => {
    setSavingBeforeNav(true);
    const ok = await saveChanges();
    setSavingBeforeNav(false);
    if (ok) continueNavigation();
  };

  const handleCancelNavigation = () => {
    setPendingHash('');
    setPendingPathLabel('');
    setNavConfirmOpen(false);
  };

  const buildExportRows = (employees) => {
    const rows = [];
    (employees || []).forEach((employee) => {
      monthDays.forEach((day) => {
        const dateString = day.dateString;
        const key = attendanceKey(employee.id, dateString);
        const attendanceDetail = attendanceDetailsByKey.get(key);
        const leaveDetails = leaveRequestDetailsByKey.get(key) || [];
        const leaveTypes = leaveDetails.map((x) => x.leaveType).filter(Boolean).join(', ');
        const leaveReasons = leaveDetails.map((x) => x.reason).filter(Boolean).join(' | ');
        const leaveStatuses = leaveDetails.map((x) => statusLabel(x.status)).filter(Boolean).join(', ');
        const isBulkLeave = employee.leaveDays.includes(dateString);
        const attendanceStatus = employee.attendance.attended.includes(dateString)
          ? 'Attended'
          : employee.attendance.absent.includes(dateString)
            ? 'Absent'
            : '-';
        rows.push({
          Month: selectedMonth,
          Date: dateString,
          Weekday: day.weekday,
          Employee: employee.name,
          Designation: employee.role || '-',
          'Work Location': employee.workLocation || '-',
          'Bulk Leave Planned': isBulkLeave ? 'Yes' : 'No',
          'Leave Requested': leaveDetails.length > 0 ? 'Yes' : 'No',
          'Leave Type': leaveTypes || '-',
          'Leave Reason': leaveReasons || '-',
          'Leave Request Status': leaveStatuses || '-',
          Attendance: attendanceStatus,
          'Mark In': formatTimeOnly(attendanceDetail?.mark_in),
          'Mark Out': formatTimeOnly(attendanceDetail?.mark_out),
          'Worked Hours': formatWorkedHours(attendanceDetail?.working_minutes),
          'Worked Minutes': attendanceDetail?.working_minutes ?? '-',
          'Mark In Valid': toBoolText(attendanceDetail?.mark_in_location_valid),
          'Mark Out Valid': toBoolText(attendanceDetail?.mark_out_location_valid),
          'Mark In Distance (m)': attendanceDetail?.mark_in_distance_meters ?? '-',
          'Mark Out Distance (m)': attendanceDetail?.mark_out_distance_meters ?? '-',
          'Mark In 20m+': attendanceDetail
            ? (isOutsideGeofenceRange(
              attendanceDetail.mark_in_distance_meters,
              attendanceDetail.mark_in_location_valid,
              geofenceRadiusMeters,
            ) ? 'Yes' : 'No')
            : '-',
          'Mark Out 20m+': attendanceDetail
            ? (isOutsideGeofenceRange(
              attendanceDetail.mark_out_distance_meters,
              attendanceDetail.mark_out_location_valid,
              geofenceRadiusMeters,
            ) ? 'Yes' : 'No')
            : '-',
          'Assigned Work Location': buildWorkLocationSiteLabel(attendanceDetail, employee.workLocation || '-'),
          'Work Location Coordinates': buildWorkLocationCoordsLabel(attendanceDetail),
          'Allowed Range (m)': geofenceRadiusMeters,
          'Mark In Map': buildMapUrl(attendanceDetail?.mark_in_latitude, attendanceDetail?.mark_in_longitude) || '-',
          'Mark Out Map': buildMapUrl(attendanceDetail?.mark_out_latitude, attendanceDetail?.mark_out_longitude) || '-',
        });
      });
    });
    return rows;
  };

  const downloadExcel = (rows, filenamePrefix) => {
    if (!rows || rows.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Roster');
    XLSX.writeFile(wb, `${filenamePrefix}_${selectedMonth}.xlsx`);
  };

  const handleExportAll = () => {
    const rows = buildExportRows(filteredRoster);
    downloadExcel(rows, 'roster_all');
  };

  const handleExportEmployee = (employee) => {
    const rows = buildExportRows([employee]);
    const safeName = String(employee.name || 'employee').replace(/[^a-zA-Z0-9_-]+/g, '_');
    downloadExcel(rows, `roster_${safeName}`);
  };

  const openAttendancePopup = (e, employeeName, employeeId, dateString, employeeWorkLocation = '-') => {
    e.stopPropagation();
    e.preventDefault();
    const detail = attendanceDetailsByKey.get(attendanceKey(employeeId, dateString));
    if (!detail) {
      setAttendancePopup({
        employeeId,
        employeeName,
        dateString,
        detail: null,
      });
      return;
    }
    const workLocationName = buildWorkLocationSiteLabel(detail, employeeWorkLocation);
    const markInDistance = formatAttendanceDistanceDetail({
      distanceMeters: detail.mark_in_distance_meters,
      locationValid: detail.mark_in_location_valid,
      radiusMeters: geofenceRadiusMeters,
    });
    const markOutDistance = formatAttendanceDistanceDetail({
      distanceMeters: detail.mark_out_distance_meters,
      locationValid: detail.mark_out_location_valid,
      radiusMeters: geofenceRadiusMeters,
    });
    setAttendancePopup({
      employeeId,
      employeeName,
      dateString,
      detail: {
        workLocationName,
        workLocationCode: detail.employee_work_location_code || '-',
        workLocationCoords: buildWorkLocationCoordsLabel(detail),
        workLocationMapUrl: buildMapUrl(detail.work_location_latitude, detail.work_location_longitude)
          || detail.work_location_map_link
          || '',
        geofenceRadiusMeters,
        locationIssue: markInDistance.outsideRange || markOutDistance.outsideRange,
        markIn: formatTimeOnly(detail.mark_in),
        markOut: formatTimeOnly(detail.mark_out),
        markInValid: toBoolText(detail.mark_in_location_valid),
        markOutValid: toBoolText(detail.mark_out_location_valid),
        workedHours: formatWorkedHours(detail.working_minutes),
        workingMinutes: Number.isFinite(Number(detail.working_minutes)) ? Number(detail.working_minutes) : null,
        markInDistance,
        markOutDistance,
        markInMapUrl: buildMapUrl(detail.mark_in_latitude, detail.mark_in_longitude),
        markOutMapUrl: buildMapUrl(detail.mark_out_latitude, detail.mark_out_longitude),
      },
    });
  };

  const getEmployeeMonthLocationRows = (employeeId) => {
    if (!employeeId) return [];
    return monthDays
      .map((day) => {
        const detail = attendanceDetailsByKey.get(attendanceKey(employeeId, day.dateString));
        if (!detail || String(detail.status || '').toLowerCase() !== 'present') return null;
        const markInDistance = formatAttendanceDistanceDetail({
          distanceMeters: detail.mark_in_distance_meters,
          locationValid: detail.mark_in_location_valid,
          radiusMeters: geofenceRadiusMeters,
        });
        const markOutDistance = formatAttendanceDistanceDetail({
          distanceMeters: detail.mark_out_distance_meters,
          locationValid: detail.mark_out_location_valid,
          radiusMeters: geofenceRadiusMeters,
        });
        return {
          dateString: day.dateString,
          dayLabel: day.label,
          weekday: day.weekday,
          markIn: formatTimeOnly(detail.mark_in),
          markOut: formatTimeOnly(detail.mark_out),
          markInDistance,
          markOutDistance,
        };
      })
      .filter(Boolean);
  };

  const renderDistanceMeter = (distanceDetail, radiusMeters) => {
    const distance = Number(String(distanceDetail?.text || '').replace(/[^\d.]/g, ''));
    if (!Number.isFinite(distance)) {
      return <div className="roaster-att-meter roaster-att-meter--empty">Distance not recorded</div>;
    }
    const outside = distanceDetail?.outsideRange;
    const fillPct = Math.min(100, Math.round((distance / Math.max(radiusMeters * 2, distance)) * 100));
    const thresholdPct = 50;
    return (
      <div className={`roaster-att-meter${outside ? ' roaster-att-meter--warn' : ' roaster-att-meter--ok'}`}>
        <div className="roaster-att-meter__track" aria-hidden>
          <div className="roaster-att-meter__fill" style={{ width: `${fillPct}%` }} />
          <span className="roaster-att-meter__threshold" style={{ left: `${thresholdPct}%` }} />
        </div>
        <div className="roaster-att-meter__meta">
          <strong>{Math.round(distance)} m</strong>
          <span>{outside ? `${radiusMeters} m+ · outside range` : `Within ${radiusMeters} m`}</span>
        </div>
      </div>
    );
  };

  const renderAttendanceTimelineEvent = ({
    kind,
    time,
    validLabel,
    distanceDetail,
    mapUrl,
    radiusMeters,
  }) => {
    const hasTime = time && time !== '-';
    const tone = distanceDetail?.outsideRange ? 'warn' : hasTime ? 'ok' : 'neutral';
    return (
      <article className={`roaster-att-timeline-item roaster-att-timeline-item--${kind} roaster-att-timeline-item--${tone}`}>
        <div className="roaster-att-timeline-item__rail" aria-hidden>
          <span className={`roaster-att-timeline-item__dot roaster-att-timeline-item__dot--${kind}`} />
        </div>
        <div className="roaster-att-timeline-item__body">
          <div className="roaster-att-timeline-item__head">
            <div>
              <p className="roaster-att-timeline-item__eyebrow">{kind === 'in' ? 'Arrival' : 'Departure'}</p>
              <h4 className="roaster-att-timeline-item__title">{kind === 'in' ? 'Mark in' : 'Mark out'}</h4>
            </div>
            <span className={`roaster-att-status-pill roaster-att-status-pill--${tone}`}>
              {hasTime ? validLabel : 'Not recorded'}
            </span>
          </div>
          <div className="roaster-att-timeline-item__time">{hasTime ? time : '—'}</div>
          {hasTime ? renderDistanceMeter(distanceDetail, radiusMeters) : (
            <p className="roaster-att-timeline-item__empty">No location data for this event.</p>
          )}
          {mapUrl ? (
            <a className="roaster-att-map-link" href={mapUrl} target="_blank" rel="noreferrer">
              Open GPS on map
            </a>
          ) : hasTime ? (
            <span className="roaster-att-map-link roaster-att-map-link--disabled">GPS map unavailable</span>
          ) : null}
        </div>
      </article>
    );
  };

  return (
    <div className={`roaster-planning-page${embedded ? ' roaster-planning-embedded' : ''}`}>
      <section className="planning-controls-roaster">
        <div className="control-field-roaster planning-month-field-roaster">
          <label htmlFor="planning-month">Planning Month</label>
          <input
            id="planning-month"
            type="month"
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(e.target.value);
            }}
          />
        </div>
        <div className="control-field-roaster planning-filter-field-roaster">
          <label htmlFor="planning-designation-filter">Designation</label>
          <select
            id="planning-designation-filter"
            value={designationFilter}
            onChange={(e) => setDesignationFilter(e.target.value)}
          >
            <option value="all">All designations</option>
            {designationOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>
        <div className="control-field-roaster planning-filter-field-roaster">
          <label htmlFor="planning-name-filter">Search name</label>
          <input
            id="planning-name-filter"
            type="search"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="Search name or designation"
          />
        </div>
        <div className="control-field-roaster planning-filter-field-roaster">
          <label htmlFor="planning-work-location-filter">Work Location</label>
          <select
            id="planning-work-location-filter"
            value={workLocationFilter}
            onChange={(e) => setWorkLocationFilter(e.target.value)}
          >
            <option value="all">All work locations</option>
            {workLocationOptions.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
        </div>
        <div className="roaster-toolbar-actions-roaster">
          <div className="roaster-save-help-group-roaster" ref={saveHelpRef}>
            <button
              type="button"
              className="roaster-save-compact-btn-roaster"
              onClick={saveChanges}
              disabled={savingRoster || !canSaveRoster}
            >
              {savingRoster ? 'Saving…' : 'Save roster'}
            </button>
            <button type="button" className="roaster-export-btn-roaster" onClick={handleExportAll}>
              Export Excel
            </button>
            <button
              type="button"
              className="roaster-help-tip-btn-roaster"
              onClick={() => setSaveHelpOpen((v) => !v)}
              aria-label="Show save info"
              aria-expanded={saveHelpOpen}
              aria-haspopup="dialog"
            >
              <span aria-hidden="true">?</span>
            </button>
            {saveHelpOpen ? (
              <div className="roaster-help-popup-roaster" role="dialog" aria-label="What save roster does">
                <p className="roaster-help-popup-title-roaster">Save roster does:</p>
                <ul className="roaster-help-popup-list-roaster">
                  {SAVE_ROSTER_HELP_LINES.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          {saveStatus === 'Unsaved changes' ? (
            <div className="roaster-unsaved-group-roaster">
              <button
                type="button"
                className={`roaster-unsaved-chip-roaster ${unsavedHighlightActive ? 'active' : ''}`}
                onClick={() => setUnsavedHighlightActive((v) => !v)}
                aria-pressed={unsavedHighlightActive}
                title={
                  unsavedHighlightActive
                    ? 'Click to clear highlights'
                    : 'Click to highlight rows and days that differ from the last saved roster'
                }
              >
                Unsaved changes
                {unsavedEmployeeIds.size > 0 ? ` · ${unsavedEmployeeIds.size} employee(s)` : ''}
              </button>
              <span className="roaster-unsaved-note-roaster">
                Refresh/close shows browser confirmation.
              </span>
            </div>
          ) : saveStatus ? (
            <p className={`roaster-save-status-text-roaster ${saveStatus === 'Roster saved' ? 'is-success' : 'is-error'}`}>
              {saveStatus}
            </p>
          ) : null}
        </div>
      </section>

      <section className="planning-board-roaster">
        {rosterLoading ? (
          <div className="roaster-month-loading-overlay">
            <Bars height="44" width="44" color="#0891b2" ariaLabel="roster-loading" visible />
            <span>Loading month data...</span>
          </div>
        ) : null}
        <div className="status-legend-roaster">
          <span className="legend-pill-roaster leave-pill-roaster">Bulk leave</span>
          <span className="legend-pill-roaster requested-pill-roaster">Leave Requested</span>
          <span className="legend-pill-roaster attended-pill-roaster">Attended</span>
          <span className="legend-pill-roaster location-outside-pill-roaster">Attended · {geofenceRadiusMeters} m+</span>
          <span className="legend-pill-roaster holiday-mercantile-legend-roaster">Statutory holidays</span>
          <span className="legend-pill-roaster holiday-poya-legend-roaster">Poya holiday</span>
          <span className="legend-pill-roaster holiday-special-legend-roaster">Special holiday</span>
          <span className="legend-pill-roaster editing-pill-roaster">Editing Mode</span>
        </div>
        <div className="timeline-header-roaster">
          <div className="employee-col-roaster">Employee</div>
          <div className="days-row-roaster days-row-header-roaster" style={dayGridStyle}>
            {monthDays.map((day) => {
              const hol = holidayMetaByDate[day.dateString]?.type;
              const holClass =
                hol === 'mercantile'
                  ? 'holiday-mercantile-roaster'
                  : hol === 'poya'
                    ? 'holiday-poya-roaster'
                    : hol === 'special'
                      ? 'holiday-special-roaster'
                      : '';
              return (
                <div
                  key={day.dateString}
                  className={`day-header-roaster ${day.isWeekend ? 'weekend' : ''} ${holClass}`.trim()}
                  title={hol ? `${day.dateString}${holidayHoverLine(day.dateString)}` : day.dateString}
                >
                  <span>{day.label}</span>
                  <small>{day.weekday}</small>
                </div>
              );
            })}
          </div>
        </div>

        {filteredRoster.map((employee, rowIndex) => (
          <div
            key={employee.id}
            className={`timeline-row-roaster ${editableRows[employee.id] ? 'timeline-row-editing-roaster' : ''} ${
              unsavedHighlightActive && unsavedEmployeeIds.has(employee.id) ? 'timeline-row-unsaved-roaster' : ''
            }`.trim()}
          >
            <div className={`employee-col-roaster ${editableRows[employee.id] ? 'editing' : ''}`}>
              <div>
                <button
                  type="button"
                  className="employee-name-export-btn-roaster"
                  onClick={() => handleExportEmployee(employee)}
                  title="Download this employee daily Excel"
                >
                  {employee.name}
                </button>
                <small className="employee-role-roaster">{employee.role}</small>
                {employee.workLocation && employee.workLocation !== '-' ? (
                  <span className="employee-location-pill-roaster" title="Assigned work location">
                    {employee.workLocation}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                className={`row-edit-btn-roaster ${editableRows[employee.id] ? 'active' : ''}`}
                onClick={() => toggleRowEdit(employee.id)}
                aria-label={editableRows[employee.id] ? 'Save changes' : 'Enable editing'}
                disabled={!employee.isBulkLeaveEligible}
                title={employee.isBulkLeaveEligible ? 'Enable editing' : 'Editing disabled: employee is not bulk leave eligible'}
              >
                {editableRows[employee.id] ? '✔' : '✏️'}
              </button>
            </div>
            <div className="days-row-roaster" style={dayGridStyle}>
              {monthDays.map((day, dayIndex) => {
                const isLeave = employee.leaveDays.includes(day.dateString);
                const isRequested = employee.requestedLeaveDays.includes(day.dateString);
                const requestedLeaveStatus = employee.requestedLeaveStatusByDate?.[day.dateString] || null;
                const isAttended = employee.attendance.attended.includes(day.dateString);
                const attendanceDetail = attendanceDetailsByKey.get(attendanceKey(employee.id, day.dateString));
                const locationOutsideRange = isAttended && hasAttendanceLocationIssue(attendanceDetail, geofenceRadiusMeters);
                const hol = holidayMetaByDate[day.dateString]?.type;
                const holClass =
                  hol === 'mercantile'
                    ? 'holiday-mercantile-roaster'
                    : hol === 'poya'
                      ? 'holiday-poya-roaster'
                      : hol === 'special'
                        ? 'holiday-special-roaster'
                        : '';
                const locked = !editableRows[employee.id];
                let stateClass = '';
                if (isLeave) {
                  stateClass = 'leave';
                } else if (isRequested) {
                  stateClass = 'requested';
                } else if (isAttended) {
                  stateClass = 'attended';
                }
                const holTitle = holidayHoverLine(day.dateString);
                const serverLeaveSet = serverLeaveSetByEmployeeId.get(employee.id);
                const serverHasLeave = serverLeaveSet ? serverLeaveSet.has(day.dateString) : false;
                const cellBulkLeaveDiff =
                  unsavedHighlightActive &&
                  localRoster.length > 0 &&
                  unsavedEmployeeIds.has(employee.id) &&
                  isLeave !== serverHasLeave;
                return (
                  <div
                    key={`${employee.id}-${day.dateString}`}
                    role="button"
                    tabIndex={locked ? -1 : 0}
                    className={`day-cell-roaster ${day.isWeekend ? 'weekend' : ''} ${stateClass} ${holClass} ${
                      locked ? 'locked' : ''
                    } ${cellBulkLeaveDiff ? 'day-cell-bulk-leave-diff-roaster' : ''}`.trim()}
                    title={`${day.dateString}${isLeave ? ' | Bulk leave' : ''}${isRequested ? ' | Leave Requested' : ''}${isAttended ? ' | Attended' : ''}${locationOutsideRange ? ` | Outside ${geofenceRadiusMeters} m range` : ''}${holTitle}`}
                    onClick={() => {
                      if (isAttended) {
                        openAttendancePopup(
                          { stopPropagation: () => {}, preventDefault: () => {} },
                          employee.name,
                          employee.id,
                          day.dateString,
                          employee.workLocation
                        );
                        return;
                      }
                      if (!locked) handleDayClick(employee.id, day.dateString);
                    }}
                    onKeyDown={(ev) => {
                      if (ev.key !== 'Enter' && ev.key !== ' ') return;
                      if (isAttended) {
                        ev.preventDefault();
                        openAttendancePopup(ev, employee.name, employee.id, day.dateString, employee.workLocation);
                        return;
                      }
                      if (locked) return;
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        handleDayClick(employee.id, day.dateString);
                      }
                    }}
                  >
                    {isRequested ? (
                      <span
                        className="approval-dot-hit-roaster"
                        aria-label="Show leave approval details"
                        title="Click for approval details"
                        onClick={(ev) =>
                          openApprovalPopup(
                            ev,
                            employee.name,
                            employee.id,
                            day.dateString,
                            dayIndex,
                            rowIndex,
                            filteredRoster.length
                          )
                        }
                      >
                        <span
                          className={`approval-dot-roaster ${
                            requestedLeaveStatus === 'approved'
                              ? 'approval-dot-green-roaster'
                              : requestedLeaveStatus === 'pending_l2'
                                ? 'approval-dot-yellow-roaster'
                                : 'approval-dot-red-roaster'
                          }`}
                        />
                      </span>
                    ) : null}
                    {isAttended ? (
                      <span
                        className="attendance-info-hit-roaster"
                        aria-label="Show attendance details"
                        title={locationOutsideRange
                          ? `Outside ${geofenceRadiusMeters} m range — click for details`
                          : 'Click for attendance details'}
                        onClick={(ev) => openAttendancePopup(ev, employee.name, employee.id, day.dateString, employee.workLocation)}
                      >
                        <span className={`attendance-info-dot-roaster${locationOutsideRange ? ' attendance-info-dot-roaster--warn' : ''}`}>
                          {locationOutsideRange ? '!' : 'i'}
                        </span>
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {approvalPopup?.open ? (
        <div
          className="approval-popup-backdrop-roaster"
          role="presentation"
          onClick={() => setApprovalPopup(null)}
        >
          <div
            className="approval-popup-panel-roaster"
            style={{
              left: approvalPopup.left,
              top: approvalPopup.top,
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Leave approval details"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="approval-popup-header-row-roaster">
              <div className="approval-popup-title-roaster">{approvalPopup.title}</div>
              <button
                type="button"
                className="approval-popup-close-x-roaster"
                aria-label="Close"
                onClick={() => setApprovalPopup(null)}
              >
                ×
              </button>
            </div>
            {approvalPopup.sections.map((section, sIdx) => (
              <div key={sIdx} className="approval-popup-section-roaster">
                {section.heading ? (
                  <div className="approval-popup-section-heading-roaster">{section.heading}</div>
                ) : null}
                {section.lines.map((line, lIdx) => (
                  <div key={lIdx} className="approval-popup-line-roaster">
                    {line}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {attendancePopup ? (
        <div
          className="roaster-attendance-backdrop"
          role="presentation"
          onClick={() => setAttendancePopup(null)}
        >
          <div
            className="roaster-attendance-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Attendance details"
            onClick={(ev) => ev.stopPropagation()}
          >
            <header className="roaster-attendance-modal__header">
              <div className="roaster-attendance-modal__header-main">
                <p className="roaster-attendance-modal__eyebrow">Attendance record</p>
                <h3 className="roaster-attendance-modal__title">{attendancePopup.employeeName}</h3>
                <p className="roaster-attendance-modal__date">{formatPopupDate(attendancePopup.dateString)}</p>
              </div>
              <button
                type="button"
                className="roaster-attendance-modal__close"
                aria-label="Close"
                onClick={() => setAttendancePopup(null)}
              >
                ×
              </button>
            </header>

            {attendancePopup.detail ? (
              <div className="roaster-attendance-modal__body">
                {attendancePopup.detail.locationIssue ? (
                  <div className="roaster-attendance-alert roaster-attendance-alert--warn">
                    One or more marks were recorded outside the {attendancePopup.detail.geofenceRadiusMeters} m office range.
                  </div>
                ) : null}

                <div className="roaster-attendance-summary">
                  <div className="roaster-attendance-summary__item">
                    <span className="roaster-attendance-summary__label">Mark in</span>
                    <span className="roaster-attendance-summary__value">{attendancePopup.detail.markIn}</span>
                  </div>
                  <div className="roaster-attendance-summary__item">
                    <span className="roaster-attendance-summary__label">Mark out</span>
                    <span className="roaster-attendance-summary__value">{attendancePopup.detail.markOut}</span>
                  </div>
                  <div className="roaster-attendance-summary__item roaster-attendance-summary__item--accent">
                    <span className="roaster-attendance-summary__label">Worked</span>
                    <span className="roaster-attendance-summary__value">{attendancePopup.detail.workedHours}</span>
                    {attendancePopup.detail.workingMinutes != null ? (
                      <span className="roaster-attendance-summary__meta">{attendancePopup.detail.workingMinutes} mins</span>
                    ) : null}
                  </div>
                </div>

                <section className="roaster-attendance-timeline">
                  <div className="roaster-attendance-section-head">
                    <h4>Mark in &amp; mark out</h4>
                    <span>Allowed range {attendancePopup.detail.geofenceRadiusMeters} m from office</span>
                  </div>
                  {renderAttendanceTimelineEvent({
                    kind: 'in',
                    time: attendancePopup.detail.markIn,
                    validLabel: attendancePopup.detail.markInValid,
                    distanceDetail: attendancePopup.detail.markInDistance,
                    mapUrl: attendancePopup.detail.markInMapUrl,
                    radiusMeters: attendancePopup.detail.geofenceRadiusMeters,
                  })}
                  {renderAttendanceTimelineEvent({
                    kind: 'out',
                    time: attendancePopup.detail.markOut,
                    validLabel: attendancePopup.detail.markOutValid,
                    distanceDetail: attendancePopup.detail.markOutDistance,
                    mapUrl: attendancePopup.detail.markOutMapUrl,
                    radiusMeters: attendancePopup.detail.geofenceRadiusMeters,
                  })}
                </section>

                {(() => {
                  const monthRows = getEmployeeMonthLocationRows(attendancePopup.employeeId);
                  if (!monthRows.length) return null;
                  return (
                    <section className="roaster-attendance-month-table-wrap">
                      <div className="roaster-attendance-section-head">
                        <h4>Location distance this month</h4>
                        <span>Red = {attendancePopup.detail.geofenceRadiusMeters} m+ from office</span>
                      </div>
                      <div className="roaster-attendance-month-table-scroll">
                        <table className="roaster-attendance-month-table">
                          <thead>
                            <tr>
                              <th>Day</th>
                              <th>Mark in</th>
                              <th>In dist.</th>
                              <th>Mark out</th>
                              <th>Out dist.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthRows.map((row) => {
                              const isSelected = row.dateString === attendancePopup.dateString;
                              return (
                                <tr key={row.dateString} className={isSelected ? 'is-selected' : ''}>
                                  <td>
                                    <strong>{row.dayLabel}</strong>
                                    <span>{row.weekday}</span>
                                  </td>
                                  <td>{row.markIn}</td>
                                  <td className={row.markInDistance.outsideRange ? 'is-outside' : 'is-inside'}>
                                    {row.markInDistance.text}
                                  </td>
                                  <td>{row.markOut}</td>
                                  <td className={row.markOutDistance.outsideRange ? 'is-outside' : 'is-inside'}>
                                    {row.markOutDistance.text}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  );
                })()}

                <section className="roaster-attendance-site-card">
                  <div className="roaster-attendance-site-card__head">
                    <h4>Assigned work location</h4>
                    <span className="roaster-attendance-site-card__code">{attendancePopup.detail.workLocationCode}</span>
                  </div>
                  <p className="roaster-attendance-site-card__name">{attendancePopup.detail.workLocationName}</p>
                  <dl className="roaster-attendance-meta-grid">
                    <div>
                      <dt>Office coordinates</dt>
                      <dd>{attendancePopup.detail.workLocationCoords}</dd>
                    </div>
                    <div>
                      <dt>Allowed range</dt>
                      <dd>{attendancePopup.detail.geofenceRadiusMeters} metres</dd>
                    </div>
                  </dl>
                  {attendancePopup.detail.workLocationMapUrl ? (
                    <a
                      className="roaster-att-site-map-btn"
                      href={attendancePopup.detail.workLocationMapUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open office on map
                    </a>
                  ) : null}
                </section>
              </div>
            ) : (
              <div className="roaster-attendance-modal__empty">
                <p>No attendance details are available for this day.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {navConfirmOpen ? (
        <div className="roaster-nav-confirm-backdrop" role="presentation">
          <div className="roaster-nav-confirm-panel" role="dialog" aria-modal="true" aria-label="Unsaved roster confirmation">
            <h3>Unsaved roster changes</h3>
            <p>
              Please save the roster before leaving this page, or ignore and continue without saving.
              {pendingPathLabel ? ` Destination: ${pendingPathLabel}` : ''}
            </p>
            <div className="roaster-nav-confirm-actions">
              <button
                type="button"
                className="roaster-save-compact-btn-roaster"
                onClick={handleSaveThenNavigate}
                disabled={savingBeforeNav || savingRoster || !canSaveRoster}
              >
                {savingBeforeNav || savingRoster ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                className="roaster-nav-ignore-btn"
                onClick={handleIgnoreNavigation}
                disabled={savingBeforeNav || savingRoster}
              >
                Ignore
              </button>
              <button
                type="button"
                className="roaster-nav-cancel-btn"
                onClick={handleCancelNavigation}
                disabled={savingBeforeNav || savingRoster}
              >
                Stay
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default RoasterPlanning;

