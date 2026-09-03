import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { FaCalendarAlt } from 'react-icons/fa';
import {
  useApplyEmployeeAssignmentMutation,
  useGetAllEmployeeRegistrationsQuery,
  useGetEmployeeAssignmentHistoryQuery,
  useGetEmployeeAssignmentQueuesQuery,
  useGetUserJobDescriptionsQuery,
  useGetWorkLocationsQuery,
} from '../../api/services NodeJs/jdManagementApi';
import {
  useGetEmpChiefJobRolesQuery,
  useGetEmpDepartmentsQuery,
  useGetEmpDesignationsQuery,
  useGetEmpJobRolesQuery,
  useGetEmpRoleMaxLimitsQuery,
  useGetEmpSpecializationsQuery,
  useGetEmpSubDivisionsQuery,
  useResolveEmpDesignationMutation,
} from '../../api/services NodeJs/empOrgStructureApi';
import { isSeniorManagementCategory } from './employeeProfile/employeeProfileUtils';
import '../../styles/employeeAssignment.css';

const EMPTY_LIST = [];
const DESIGNATIONS_QUERY_ARG = { activated: 1 };

const CustomDateInput = React.forwardRef(({ value, onClick }, ref) => (
  <div className="ea-custom-date-input-ea" ref={ref} onClick={onClick}>
    <input type="text" value={value} readOnly className="ea-date-picker-input-ea" />
    <FaCalendarAlt className="ea-calendar-icon-ea" />
  </div>
));

function employeeMatchesDepartment(employee, departmentId, departments) {
  if (!departmentId) return true;

  const targetId = Number(departmentId);
  if (employee?.emp_department_id != null && Number(employee.emp_department_id) === targetId) {
    return true;
  }

  const dept = departments.find((row) => Number(row.id) === targetId);
  const deptCode = String(dept?.dept_code || '').trim().toLowerCase();
  const deptName = String(dept?.department_name || '').trim().toLowerCase();

  const legacyRaw = String(employee?.department ?? '').trim();
  if (legacyRaw) {
    const legacyNum = Number(legacyRaw);
    if (Number.isInteger(legacyNum) && legacyNum === targetId) return true;
    if (deptCode && legacyRaw.toLowerCase() === deptCode) return true;
  }

  const employeeDeptName = String(employee?.departmentName || employee?.department_name || '').trim().toLowerCase();
  if (employeeDeptName && deptName && employeeDeptName === deptName) return true;

  return false;
}

function lookupLabel(list, id, labelKey) {
  if (!id) return '';
  const row = list.find((item) => String(item.id) === String(id));
  return row?.[labelKey] || '';
}

function buildAssignmentFromEmployee(employee, allDesignations, workLocations) {
  const des = allDesignations.find((d) => Number(d.id) === Number(employee.emp_designation_id));
  const locationId = workLocations.find((wl) => wl.locationCode === employee.workLocation)?.id
    || workLocations.find((wl) => wl.locationName === employee.workLocationName)?.id
    || '';

  return {
    eventType: 'assignment',
    toEmpDepartmentId: employee.emp_department_id ? String(employee.emp_department_id) : '',
    toEmpSubDivisionId: employee.emp_sub_division_id ? String(employee.emp_sub_division_id) : '',
    toEmpJobRoleId: des?.job_role_id ? String(des.job_role_id) : '',
    toEmpSpecializationId: des?.specialization_id ? String(des.specialization_id) : '',
    toWorkLocationId: locationId ? String(locationId) : '',
    toReportingOfficerId: employee.reportofficer ? String(employee.reportofficer) : '',
    effectiveDate: new Date(),
    reason: '',
    referenceNo: '',
  };
}

const EmployeeAssignment = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const employeeParam = searchParams.get('employee') || '';

  const [queueFilter, setQueueFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loadingEmployeeId, setLoadingEmployeeId] = useState(null);
  const [isResolvingDesignation, setIsResolvingDesignation] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [showLetterModal, setShowLetterModal] = useState(false);
  const [resolvedDesignation, setResolvedDesignation] = useState(null);
  const [assignmentData, setAssignmentData] = useState({
    eventType: 'assignment',
    toEmpDepartmentId: '',
    toEmpSubDivisionId: '',
    toEmpJobRoleId: '',
    toEmpSpecializationId: '',
    toWorkLocationId: '',
    toReportingOfficerId: '',
    effectiveDate: new Date(),
    reason: '',
    referenceNo: '',
  });

  const { data: queueResponse, isLoading: loadingQueues, isFetching: fetchingQueues, error: queueError, refetch: refetchQueues } = useGetEmployeeAssignmentQueuesQuery();
  const {
    data: employeeListData,
    isLoading: loadingEmployees,
    isFetching: fetchingEmployees,
    error: employeeListError,
  } = useGetAllEmployeeRegistrationsQuery();
  const { data: departmentsData } = useGetEmpDepartmentsQuery();
  const { data: jobRolesData } = useGetEmpJobRolesQuery();
  const { data: chiefRolesData } = useGetEmpChiefJobRolesQuery();
  const { data: allDesignationsData } = useGetEmpDesignationsQuery(DESIGNATIONS_QUERY_ARG);
  const { data: workLocationsData } = useGetWorkLocationsQuery();
  const { data: historyResponse, isLoading: loadingHistory, isFetching: fetchingHistory, refetch: refetchHistory } = useGetEmployeeAssignmentHistoryQuery(
    { employeeId: selectedEmployee?.id },
    { skip: !selectedEmployee?.id },
  );
  const [applyEmployeeAssignment, { isLoading: isApplying }] = useApplyEmployeeAssignmentMutation();
  const [resolveDesignation] = useResolveEmpDesignationMutation();

  const departments = departmentsData ?? EMPTY_LIST;
  const activeDepartments = useMemo(
    () => departments.filter((dept) => Number(dept.activated) !== 0),
    [departments],
  );
  const jobRoles = jobRolesData ?? EMPTY_LIST;
  const chiefRoles = chiefRolesData ?? EMPTY_LIST;
  const allDesignations = allDesignationsData ?? EMPTY_LIST;

  const workLocations = useMemo(() => {
    if (!workLocationsData) return [];
    if (Array.isArray(workLocationsData)) return workLocationsData;
    if (Array.isArray(workLocationsData.data)) return workLocationsData.data;
    return [];
  }, [workLocationsData]);

  const allEmployees = useMemo(() => {
    const raw = employeeListData;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.data)) return raw.data;
    return [];
  }, [employeeListData]);

  const deptId = assignmentData.toEmpDepartmentId || '';
  const roleId = assignmentData.toEmpJobRoleId || '';
  const specId = assignmentData.toEmpSpecializationId || '';

  const subDivisionsQueryArg = useMemo(
    () => (deptId ? { dept_id: Number(deptId) } : undefined),
    [deptId],
  );
  const specializationsQueryArg = useMemo(() => {
    if (!deptId || !roleId) return undefined;
    return { dept_id: Number(deptId), job_role_id: Number(roleId) };
  }, [deptId, roleId]);
  const roleLimitsQueryArg = useMemo(() => {
    if (!deptId) return undefined;
    return { dept_id: Number(deptId), exclude_employee_id: selectedEmployee?.id };
  }, [deptId, selectedEmployee?.id]);

  const { data: subDivisionsData } = useGetEmpSubDivisionsQuery(subDivisionsQueryArg, { skip: !subDivisionsQueryArg });
  const { data: specializationsData } = useGetEmpSpecializationsQuery(specializationsQueryArg, { skip: !specializationsQueryArg });
  const { data: roleLimitsData } = useGetEmpRoleMaxLimitsQuery(roleLimitsQueryArg, { skip: !roleLimitsQueryArg });

  const subDivisions = subDivisionsData ?? EMPTY_LIST;
  const specializations = specializationsData ?? EMPTY_LIST;
  const roleLimits = roleLimitsData ?? EMPTY_LIST;

  const resolvedDesId = resolvedDesignation?.id || null;
  const { data: jobDescriptionsData } = useGetUserJobDescriptionsQuery(
    resolvedDesId ? { emp_designation_id: resolvedDesId } : undefined,
    { skip: !resolvedDesId },
  );

  const roleDescriptions = useMemo(() => {
    const rows = jobDescriptionsData?.data || jobDescriptionsData || [];
    if (!Array.isArray(rows)) return [];
    return rows
      .filter((item) => Number(item.status) === 1)
      .sort((a, b) => Number(a.taskOrder || 0) - Number(b.taskOrder || 0));
  }, [jobDescriptionsData]);

  const assignedEmployees = queueResponse?.assignedEmployees
    || queueResponse?.data?.assignedEmployees
    || [];
  const nonAssignedEmployees = queueResponse?.nonAssignedEmployees
    || queueResponse?.data?.nonAssignedEmployees
    || [];

  const mergedEmployees = useMemo(() => {
    const map = new Map();
    [...assignedEmployees, ...nonAssignedEmployees, ...allEmployees].forEach((employee) => {
      if (employee?.id == null) return;
      const id = String(employee.id);
      const existing = map.get(id);
      map.set(id, existing ? { ...existing, ...employee } : employee);
    });
    return Array.from(map.values());
  }, [assignedEmployees, nonAssignedEmployees, allEmployees]);

  const employeesToShow = useMemo(() => {
    const queueMeta = new Map();
    [...assignedEmployees, ...nonAssignedEmployees].forEach((employee) => {
      queueMeta.set(String(employee.id), employee);
    });

    const isAssigned = (employee) => {
      const fromQueue = queueMeta.get(String(employee.id));
      if (fromQueue) return fromQueue.assigned;
      return Boolean(
        employee.emp_designation_id ||
        employee.emp_department_id ||
        employee.workLocation ||
        employee.reportofficer,
      );
    };

    const enrich = (employee) => {
      const fromQueue = queueMeta.get(String(employee.id));
      return fromQueue ? { ...employee, ...fromQueue } : employee;
    };

    const baseSource = mergedEmployees;

    const seen = new Set();
    let list = [];
    baseSource.forEach((employee) => {
      const id = String(employee.id);
      if (seen.has(id)) return;
      if (!employeeMatchesDepartment(employee, departmentFilter, departments)) return;
      seen.add(id);
      list.push(employee);
    });

    if (queueFilter === 'assigned') list = list.filter(isAssigned);
    else if (queueFilter === 'not_assigned') list = list.filter((employee) => !isAssigned(employee));

    return list.map(enrich);
  }, [queueFilter, departmentFilter, assignedEmployees, nonAssignedEmployees, mergedEmployees, departments]);

  const isLoadingList = (loadingQueues || fetchingQueues || loadingEmployees || fetchingEmployees)
    && employeesToShow.length === 0
    && !queueError
    && !employeeListError;

  const listLoadError = queueError || employeeListError;

  const historyItems = historyResponse?.data || [];

  const chiefDeptMap = useMemo(() => {
    const map = new Map();
    chiefRoles.forEach((r) => {
      map.set(Number(r.id), new Set((r.dept_ids || []).map(Number)));
    });
    return map;
  }, [chiefRoles]);

  const roleLimitById = useMemo(() => {
    const map = new Map();
    roleLimits.forEach((row) => map.set(Number(row.job_role_id), row));
    return map;
  }, [roleLimits]);

  const isRoleSelectable = useCallback((candidateRoleId) => {
    const lim = roleLimitById.get(Number(candidateRoleId));
    if (!lim || lim.max_limit == null) return true;
    return Number(lim.current_count ?? 0) < Number(lim.max_limit);
  }, [roleLimitById]);

  const selectableJobRoles = useMemo(() => jobRoles.filter((r) => {
    if (Number(r.activated) !== 1) return false;
    if (!deptId) return false;
    if (Number(r.chief) === 1) {
      return chiefDeptMap.get(Number(r.id))?.has(Number(deptId));
    }
    return (r.dept_ids || []).includes(Number(deptId));
  }), [jobRoles, deptId, chiefDeptMap]);

  const selectedIsChief = Boolean(
    roleId && jobRoles.find((r) => Number(r.id) === Number(roleId) && Number(r.chief) === 1),
  );

  const selectedRoleLimit = roleId ? roleLimitById.get(Number(roleId)) : null;
  const selectedRoleAtCapacity = Boolean(
    roleId && deptId && selectedRoleLimit?.max_limit != null
    && Number(selectedRoleLimit.current_count ?? 0) >= Number(selectedRoleLimit.max_limit),
  );

  const reportingOfficerOptions = useMemo(() => {
    const empId = selectedEmployee?.id;
    const isSeniorManagement = isSeniorManagementCategory(selectedEmployee?.employmentCategory);
    const isDepartmentHead = departments.some((dept) => Number(dept.hod_employee_id) === Number(empId));
    return allEmployees
      .filter((emp) => String(emp.id) !== String(empId) || isSeniorManagement || isDepartmentHead)
      .map((emp) => ({
        value: emp.id,
        label: `${emp.empNo || emp.id} — ${emp.employeeName || emp.preferredName || 'Employee'}`,
      }));
  }, [allEmployees, selectedEmployee?.id, selectedEmployee?.employmentCategory, departments]);

  const selectEmployee = useCallback((employee) => {
    const employeeId = String(employee.id);
    if (loadingEmployeeId) return;
    if (selectedEmployee && String(selectedEmployee.id) === employeeId) return;

    const fullEmployee = allEmployees.find((emp) => String(emp.id) === employeeId) || employee;
    setLoadingEmployeeId(employeeId);
    setSelectedEmployee(fullEmployee);
    setAssignmentData(buildAssignmentFromEmployee(fullEmployee, allDesignations, workLocations));
    setResolvedDesignation(null);
    setMessage({ type: '', text: '' });
    setSelectedHistoryItem(null);

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('employee', employeeId);
      return next;
    }, { replace: true });
  }, [allEmployees, allDesignations, workLocations, loadingEmployeeId, selectedEmployee, setSearchParams]);

  useEffect(() => {
    if (!employeeParam || selectedEmployee) return;

    const fromAll = allEmployees.find((e) => String(e.id) === String(employeeParam));
    const fromQueue = [...assignedEmployees, ...nonAssignedEmployees].find(
      (e) => String(e.id) === String(employeeParam),
    );
    const target = fromAll || fromQueue;
    if (!target) {
      if (!loadingEmployees && !loadingQueues && !fetchingEmployees && !fetchingQueues) {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.delete('employee');
          return next;
        }, { replace: true });
      }
      return;
    }

    const fullEmployee = fromAll || target;
    setLoadingEmployeeId(String(fullEmployee.id));
    setSelectedEmployee(fullEmployee);
    setAssignmentData(buildAssignmentFromEmployee(fullEmployee, allDesignations, workLocations));
    setResolvedDesignation(null);
    setMessage({ type: '', text: '' });
  }, [
    employeeParam,
    selectedEmployee,
    allEmployees,
    assignedEmployees,
    nonAssignedEmployees,
    allDesignations,
    workLocations,
    loadingEmployees,
    loadingQueues,
    fetchingEmployees,
    fetchingQueues,
    setSearchParams,
  ]);

  const isLoadingEmployeeDetails = Boolean(
    loadingEmployeeId
    && selectedEmployee
    && String(selectedEmployee.id) === loadingEmployeeId
    && (
      loadingHistory
      || fetchingHistory
      || (deptId && roleId && isResolvingDesignation)
    ),
  );

  useEffect(() => {
    if (!loadingEmployeeId) return;
    if (!selectedEmployee || String(selectedEmployee.id) !== loadingEmployeeId) return;

    const historyPending = loadingHistory || fetchingHistory;
    const designationPending = Boolean(deptId && roleId && isResolvingDesignation);
    if (!historyPending && !designationPending) {
      setLoadingEmployeeId(null);
    }
  }, [
    loadingEmployeeId,
    selectedEmployee,
    loadingHistory,
    fetchingHistory,
    deptId,
    roleId,
    isResolvingDesignation,
  ]);

  useEffect(() => {
    if (!loadingEmployeeId) return undefined;
    const timer = window.setTimeout(() => setLoadingEmployeeId(null), 10000);
    return () => window.clearTimeout(timer);
  }, [loadingEmployeeId]);

  useEffect(() => {
    if (!deptId || !roleId) {
      setResolvedDesignation(null);
      setIsResolvingDesignation(false);
      return undefined;
    }
    let cancelled = false;
    setIsResolvingDesignation(true);
    (async () => {
      try {
        const res = await resolveDesignation({
          dept_id: Number(deptId),
          job_role_id: Number(roleId),
          specialization_id: specId ? Number(specId) : undefined,
        }).unwrap();
        if (!cancelled) setResolvedDesignation(res || null);
      } catch {
        if (!cancelled) setResolvedDesignation(null);
      } finally {
        if (!cancelled) setIsResolvingDesignation(false);
      }
    })();
    return () => { cancelled = true; };
  }, [deptId, roleId, specId, resolveDesignation]);

  const handleAssignmentChange = (e) => {
    const { name, value } = e.target;
    setAssignmentData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'toEmpDepartmentId') {
        next.toEmpSubDivisionId = '';
        next.toEmpJobRoleId = '';
        next.toEmpSpecializationId = '';
      }
      if (name === 'toEmpJobRoleId') {
        next.toEmpSpecializationId = '';
      }
      return next;
    });
  };

  const handleDateChange = (date) => {
    setAssignmentData((prev) => ({ ...prev, effectiveDate: date }));
  };

  const handleAssign = async () => {
    if (!selectedEmployee?.id) {
      setMessage({ type: 'error', text: 'Please select an employee first.' });
      return;
    }
    if (!deptId || !roleId) {
      setMessage({ type: 'error', text: 'Select department and job role.' });
      return;
    }
    if (!isRoleSelectable(roleId)) {
      const roleName = jobRoles.find((r) => Number(r.id) === Number(roleId))?.job_role || 'this role';
      const deptName = departments.find((d) => Number(d.id) === Number(deptId))?.department_name || 'this department';
      setMessage({
        type: 'error',
        text: `Maximum headcount (${selectedRoleLimit?.max_limit}) reached for ${roleName} in ${deptName}.`,
      });
      return;
    }

    try {
      const payload = {
        employeeId: selectedEmployee.id,
        eventType: assignmentData.eventType,
        effectiveDate: assignmentData.effectiveDate?.toISOString?.().split('T')[0] || '',
        toEmpDepartmentId: assignmentData.toEmpDepartmentId || null,
        toEmpSubDivisionId: assignmentData.toEmpSubDivisionId || null,
        toEmpJobRoleId: assignmentData.toEmpJobRoleId || null,
        toEmpSpecializationId: assignmentData.toEmpSpecializationId || null,
        toEmpDesignationId: resolvedDesignation?.id || null,
        toWorkLocationId: assignmentData.toWorkLocationId || null,
        toReportingOfficerId: assignmentData.toReportingOfficerId || null,
        reason: assignmentData.reason || null,
        referenceNo: assignmentData.referenceNo || null,
      };

      const result = await applyEmployeeAssignment(payload).unwrap();
      setMessage({ type: 'success', text: result?.message || 'Assignment updated successfully.' });
      await refetchQueues();
      await refetchHistory();
    } catch (error) {
      setMessage({ type: 'error', text: error?.data?.message || 'Failed to update assignment.' });
    }
  };

  const formatHistoryDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    try {
      const date = new Date(dateValue);
      if (Number.isNaN(date.getTime())) return String(dateValue);
      return date.toLocaleString('en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(dateValue);
    }
  };

  const currentDeptName = lookupLabel(departments, selectedEmployee?.emp_department_id, 'department_name')
    || selectedEmployee?.departmentName
    || '—';
  const currentSubName = lookupLabel(subDivisions, selectedEmployee?.emp_sub_division_id, 'sub_division_name') || '—';
  const currentDesignation = selectedEmployee?.designation_title
    || selectedEmployee?.designation
    || selectedEmployee?.employeeJobRoleName
    || '—';
  const currentLocation = selectedEmployee?.workLocationName || selectedEmployee?.workLocationCode || '—';
  const resolvedTitle = resolvedDesignation?.designation_title || '';

  return (
    <div className="employee-assignment-container-ea">
      <div className="ea-content-ea">
        <div className="ea-left-panel-ea">
          <div className="ea-panel-header-ea">
            <h2 className="ea-panel-title-ea">
              {queueFilter === 'assigned'
                ? 'Assigned employees'
                : queueFilter === 'all'
                  ? 'All employees'
                  : 'Not assigned'}
            </h2>
            <div className="ea-toggle-container-ea">
              <button
                type="button"
                className={`ea-toggle-btn-ea ${queueFilter === 'all' ? 'active-ea' : ''}`}
                onClick={() => setQueueFilter('all')}
              >
                All
              </button>
              <button
                type="button"
                className={`ea-toggle-btn-ea ${queueFilter === 'assigned' ? 'active-ea' : ''}`}
                onClick={() => setQueueFilter('assigned')}
              >
                Assigned
              </button>
              <button
                type="button"
                className={`ea-toggle-btn-ea ${queueFilter === 'not_assigned' ? 'active-ea' : ''}`}
                onClick={() => setQueueFilter('not_assigned')}
              >
                Not assigned
              </button>
            </div>
            <label className="ea-dept-filter-wrap-ea">
              <span className="ea-dept-filter-label-ea">Department</span>
              <select
                className="ea-dept-filter-ea"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <option value="">All departments</option>
                {activeDepartments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.department_name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="ea-employees-list-ea">
            {isLoadingList && <div className="ea-empty-state-ea">Loading employees…</div>}
            {listLoadError && !isLoadingList && (
              <div className="ea-empty-state-ea ea-empty-state-ea--error">
                {listLoadError?.data?.message || listLoadError?.message || 'Failed to load employees.'}
              </div>
            )}
            {!isLoadingList && !listLoadError && employeesToShow.length === 0 && (
              <div className="ea-empty-state-ea">No employees found.</div>
            )}
            {!isLoadingList && !listLoadError && employeesToShow.map((employee) => {
              const deptLabel = employee.departmentName
                || lookupLabel(departments, employee.emp_department_id, 'department_name')
                || (employee.emp_department_id ? 'Department assigned' : '');
              const isItemLoading = loadingEmployeeId === String(employee.id);
              return (
              <button
                key={employee.id}
                type="button"
                disabled={Boolean(loadingEmployeeId)}
                className={`ea-employee-item-ea ${String(selectedEmployee?.id) === String(employee.id) ? 'active-ea' : ''}${isItemLoading ? ' ea-employee-item-ea--loading' : ''}`}
                onClick={() => selectEmployee(employee)}
              >
                <div className="ea-employee-info-ea">
                  <span className="ea-employee-name-ea">{employee.employeeName || 'N/A'}</span>
                  <span className="ea-employee-designation-ea">
                    {employee.designation_title || employee.designation || 'No designation'}
                  </span>
                  {deptLabel && (
                    <span className="ea-assigned-division-ea">{deptLabel}</span>
                  )}
                </div>
                {isItemLoading && (
                  <span className="ea-employee-item-spinner-ea" aria-hidden="true" />
                )}
              </button>
              );
            })}
          </div>
        </div>

        <div className="ea-divider-ea" />

        <div className="ea-right-panel-ea">
          <div className="ea-form-container-ea">
            <h2 className="ea-form-title-ea">Assignment details</h2>

            {isLoadingEmployeeDetails && (
              <div className="ea-details-loading-ea" aria-live="polite" aria-busy="true">
                <span className="ea-details-loading-spinner-ea" aria-hidden="true" />
                <p>Loading employee details…</p>
              </div>
            )}

            {!isLoadingEmployeeDetails && selectedEmployee ? (
              <div key={selectedEmployee.id}>
                <div className="ea-current-division-header-ea">
                  <span className="ea-current-division-label-ea">Current department:</span>
                  <span className="ea-current-division-value-ea">{currentDeptName}</span>
                  <span className="ea-current-division-label-ea">| Sub-division:</span>
                  <span className="ea-current-division-value-ea">{currentSubName}</span>
                  <span className="ea-current-division-label-ea">| Designation:</span>
                  <span className="ea-current-division-value-ea">{currentDesignation}</span>
                  <span className="ea-current-division-label-ea">| Location:</span>
                  <span className="ea-current-division-value-ea">{currentLocation}</span>
                </div>

                <div className="ea-employee-info-display-ea">
                  <span className="ea-info-value-ea">{selectedEmployee.employeeName}</span>
                  <span className="ea-info-designation-ea">{selectedEmployee.empNo || `ID ${selectedEmployee.id}`}</span>
                </div>

                <div className="ea-form-row-ea">
                  <div className="ea-form-group-ea">
                    <label htmlFor="eventType">Event type</label>
                    <select
                      id="eventType"
                      name="eventType"
                      value={assignmentData.eventType}
                      onChange={handleAssignmentChange}
                      className="ea-select-ea"
                    >
                      <option value="assignment">Assignment</option>
                      <option value="transfer">Transfer</option>
                      <option value="promotion">Promotion</option>
                      <option value="demotion">Demotion</option>
                      <option value="acting_assignment">Acting assignment</option>
                      <option value="reversion">Reversion</option>
                    </select>
                  </div>
                  <div className="ea-form-group-ea">
                    <label htmlFor="toEmpDepartmentId">Department</label>
                    <select
                      id="toEmpDepartmentId"
                      name="toEmpDepartmentId"
                      value={assignmentData.toEmpDepartmentId}
                      onChange={handleAssignmentChange}
                      className="ea-select-ea"
                    >
                      <option value="">— Select department —</option>
                      {departments.filter((d) => Number(d.activated) === 1).map((d) => (
                        <option key={d.id} value={d.id}>{d.department_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="ea-form-row-ea">
                  <div className="ea-form-group-ea">
                    <label htmlFor="toEmpSubDivisionId">Sub-division</label>
                    <select
                      id="toEmpSubDivisionId"
                      name="toEmpSubDivisionId"
                      value={assignmentData.toEmpSubDivisionId}
                      onChange={handleAssignmentChange}
                      className="ea-select-ea"
                      disabled={!deptId}
                    >
                      <option value="">— Select sub-division —</option>
                      {subDivisions.filter((s) => Number(s.activated) === 1).map((s) => (
                        <option key={s.id} value={s.id}>{s.sub_division_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="ea-form-group-ea">
                    <label htmlFor="toEmpJobRoleId">Job role</label>
                    <select
                      id="toEmpJobRoleId"
                      name="toEmpJobRoleId"
                      value={assignmentData.toEmpJobRoleId}
                      onChange={handleAssignmentChange}
                      className="ea-select-ea"
                      disabled={!deptId}
                    >
                      <option value="">— Select job role —</option>
                      {selectableJobRoles.map((r) => {
                        const atCapacity = deptId && !Number(r.chief) && !isRoleSelectable(r.id);
                        return (
                          <option key={r.id} value={r.id} disabled={atCapacity}>
                            {r.job_role}{Number(r.chief) === 1 ? ' (chief)' : ''}{atCapacity ? ' (full)' : ''}
                          </option>
                        );
                      })}
                    </select>
                    {selectedRoleAtCapacity && (
                      <p className="ea-field-hint-ea ea-field-hint--warn">
                        Maximum headcount ({selectedRoleLimit.max_limit}) reached for this role.
                      </p>
                    )}
                  </div>
                </div>

                <div className="ea-form-row-ea">
                  <div className="ea-form-group-ea">
                    <label htmlFor="toEmpSpecializationId">Specialization</label>
                    <select
                      id="toEmpSpecializationId"
                      name="toEmpSpecializationId"
                      value={assignmentData.toEmpSpecializationId}
                      onChange={handleAssignmentChange}
                      className="ea-select-ea"
                      disabled={selectedIsChief || !roleId || specializations.length === 0}
                    >
                      <option value="">— Select specialization —</option>
                      {specializations.filter((s) => Number(s.activated) === 1).map((s) => (
                        <option key={s.id} value={s.id}>{s.specialization}</option>
                      ))}
                    </select>
                  </div>
                  <div className="ea-form-group-ea">
                    <label>Resolved designation</label>
                    <input
                      type="text"
                      readOnly
                      className="ea-select-ea ea-readonly-ea"
                      value={resolvedTitle || (deptId && roleId ? 'Resolving…' : '—')}
                    />
                  </div>
                </div>

                {roleDescriptions.length > 0 && (
                  <div className="ea-job-description-section-ea">
                    <label>Job description</label>
                    <div className="ea-description-box-ea">
                      {roleDescriptions.map((task, index) => (
                        <div key={task.id || index} className="ea-description-item-ea">
                          <span className="ea-task-number-ea">{index + 1}.</span>
                          <span className="ea-task-text-ea">{task.taskDescription}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="ea-form-row-ea">
                  <div className="ea-form-group-ea">
                    <label htmlFor="toReportingOfficerId">Reporting officer</label>
                    <select
                      id="toReportingOfficerId"
                      name="toReportingOfficerId"
                      value={assignmentData.toReportingOfficerId}
                      onChange={handleAssignmentChange}
                      className="ea-select-ea"
                    >
                      <option value="">— Select reporting officer —</option>
                      {reportingOfficerOptions.map((officer) => (
                        <option key={officer.value} value={officer.value}>{officer.label}</option>
                      ))}
                    </select>
                    <p className="ea-field-hint-ea" style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>
                      One reporting officer only. Choosing a new officer replaces the previous one.
                    </p>
                  </div>
                  <div className="ea-form-group-ea">
                    <label htmlFor="toWorkLocationId">Work location</label>
                    <select
                      id="toWorkLocationId"
                      name="toWorkLocationId"
                      value={assignmentData.toWorkLocationId}
                      onChange={handleAssignmentChange}
                      className="ea-select-ea"
                    >
                      <option value="">— Select work location —</option>
                      {workLocations.map((loc) => (
                        <option key={loc.id} value={loc.id}>{loc.locationName}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="ea-form-row-ea">
                  <div className="ea-form-group-ea">
                    <label>Effective date</label>
                    <DatePicker
                      selected={assignmentData.effectiveDate}
                      onChange={handleDateChange}
                      dateFormat="yyyy/MM/dd"
                      customInput={<CustomDateInput />}
                    />
                  </div>
                  <div className="ea-form-group-ea">
                    <label htmlFor="referenceNo">Reference no.</label>
                    <input
                      id="referenceNo"
                      type="text"
                      name="referenceNo"
                      value={assignmentData.referenceNo}
                      onChange={handleAssignmentChange}
                      className="ea-select-ea"
                    />
                  </div>
                </div>

                <div className="ea-form-row-ea">
                  <div className="ea-form-group-ea ea-form-group--full">
                    <label htmlFor="reason">Reason</label>
                    <textarea
                      id="reason"
                      name="reason"
                      value={assignmentData.reason}
                      onChange={handleAssignmentChange}
                      className="ea-select-ea"
                      rows={3}
                    />
                  </div>
                </div>

                {message.text && (
                  <p className={`ea-form-message-ea ${message.type === 'error' ? 'ea-form-message-ea--error' : 'ea-form-message-ea--success'}`}>
                    {message.text}
                  </p>
                )}

                <div className="ea-form-row-ea">
                  <div className="ea-form-group-ea ea-form-group--full">
                    <label>Assignment history</label>
                    <div className="ea-description-box-ea">
                      {loadingHistory && <div className="ea-description-item-ea">Loading history…</div>}
                      {!loadingHistory && historyItems.length === 0 && (
                        <div className="ea-description-item-ea">No history records.</div>
                      )}
                      {!loadingHistory && historyItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="ea-description-item-ea ea-history-item-button-ea"
                          onClick={() => {
                            setSelectedHistoryItem(item);
                            setShowLetterModal(true);
                          }}
                        >
                          <span className="ea-task-number-ea">{item.event_type}</span>
                          <span className="ea-task-text-ea">
                            {formatHistoryDate(item.effective_date)}
                            {' | '}
                            {item.from_department_code || '—'} → {item.to_department_code || '—'}
                            {' | '}
                            {item.reason || 'No reason'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="ea-action-buttons-ea ea-action-buttons-inline-ea">
                  <button type="button" className="ea-btn-assign-ea" onClick={handleAssign} disabled={isApplying}>
                    {isApplying ? 'Saving…' : 'Apply assignment'}
                  </button>
                </div>
              </div>
            ) : !isLoadingEmployeeDetails ? (
              <div className="ea-no-selection-ea">
                <p>Select an employee from the list to assign department, role, and location.</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {showLetterModal && selectedHistoryItem && selectedEmployee && (
        <div className="ea-letter-modal-overlay-ea" onClick={() => setShowLetterModal(false)}>
          <div className="ea-letter-modal-content-ea" onClick={(e) => e.stopPropagation()}>
            <div className="ea-letter-modal-header-ea">
              <h3>Assignment letter</h3>
              <button type="button" className="ea-letter-close-btn-ea" onClick={() => setShowLetterModal(false)}>×</button>
            </div>
            <div className="ea-letter-modal-body-ea">
              <p><strong>Employee:</strong> {selectedEmployee.employeeName}</p>
              <p><strong>Event:</strong> {selectedHistoryItem.event_type}</p>
              <p><strong>Effective:</strong> {formatHistoryDate(selectedHistoryItem.effective_date)}</p>
              <p><strong>Department:</strong> {selectedHistoryItem.from_department_code || '—'} → {selectedHistoryItem.to_department_code || '—'}</p>
              <p><strong>Job role:</strong> {selectedHistoryItem.from_job_role_code || '—'} → {selectedHistoryItem.to_job_role_code || '—'}</p>
              <p><strong>Location:</strong> {selectedHistoryItem.from_work_location_code || '—'} → {selectedHistoryItem.to_work_location_code || '—'}</p>
              <p><strong>Reference:</strong> {selectedHistoryItem.reference_no || 'N/A'}</p>
              <p><strong>Reason:</strong> {selectedHistoryItem.reason || 'No reason provided.'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeAssignment;
