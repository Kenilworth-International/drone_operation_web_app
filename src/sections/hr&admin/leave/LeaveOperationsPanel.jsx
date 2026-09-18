import React, { useMemo, useState } from 'react';
import { Bars } from 'react-loader-spinner';
import '../../../styles/leaveOperations.css';
import {
  useGetHrLeaveOpsOverviewQuery,
} from '../../../api/services NodeJs/hrLeaveApi';
import { useGetEmpDepartmentsQuery } from '../../../api/services NodeJs/empOrgStructureApi';
import { useGetAllEmployeeRegistrationsQuery } from '../../../api/services NodeJs/jdManagementApi';
import HrmDashboardBreakdownModal from '../dashboard/HrmDashboardBreakdownModal';
import LeaveTodayByType from './LeaveTodayByType';
import LeaveUpcoming from './LeaveUpcoming';
import LeaveTrends from './LeaveTrends';
import LeaveAlerts from './LeaveAlerts';
import HrAddLeaveModal from './HrAddLeaveModal';
import { leaveStatusLabel } from '../../../utils/hrStatusLabels';

const toIsoDate = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

function buildBreakdown(title, description, columns, rows, metric) {
  return {
    metric,
    title,
    description,
    columns,
    rows: rows || [],
    total: (rows || []).length,
    truncated: false,
    wide: true,
    dense: true,
  };
}

export default function LeaveOperationsPanel() {
  const [selectedDate, setSelectedDate] = useState(toIsoDate());
  const [departmentCode, setDepartmentCode] = useState('');
  const [showAddLeave, setShowAddLeave] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [breakdownData, setBreakdownData] = useState(null);

  const year = Number(String(selectedDate).slice(0, 4));

  const { data: departmentsData } = useGetEmpDepartmentsQuery();
  const { data: employeesResponse } = useGetAllEmployeeRegistrationsQuery();
  const { data, isFetching, error, refetch } = useGetHrLeaveOpsOverviewQuery({
    date: selectedDate,
    departmentCode: departmentCode || undefined,
    year,
    month: null,
  });

  const departments = useMemo(() => {
    const list = Array.isArray(departmentsData)
      ? departmentsData
      : Array.isArray(departmentsData?.data)
        ? departmentsData.data
        : [];
    return [...list].sort((a, b) =>
      String(a.department_name || a.dept_code || '').localeCompare(
        String(b.department_name || b.dept_code || ''),
      ),
    );
  }, [departmentsData]);

  const employees = useMemo(() => {
    if (Array.isArray(employeesResponse)) return employeesResponse;
    if (Array.isArray(employeesResponse?.data)) return employeesResponse.data;
    if (Array.isArray(employeesResponse?.data?.data)) return employeesResponse.data.data;
    return [];
  }, [employeesResponse]);

  const openBreakdown = (payload) => {
    setBreakdownData(payload);
    setBreakdownOpen(true);
  };

  const onOpenType = (item) => {
    openBreakdown(
      buildBreakdown(
        item.leaveTypeName || item.leaveTypeCode,
        `On leave today · ${selectedDate}`,
        [
          { key: 'empNo', label: 'Emp No' },
          { key: 'employeeName', label: 'Name' },
          { key: 'departmentName', label: 'Department' },
          { key: 'status', label: 'Status' },
          { key: 'startDate', label: 'Start' },
          { key: 'endDate', label: 'End' },
        ],
        (item.employees || []).map((row) => ({
          ...row,
          status: leaveStatusLabel(row.status),
        })),
        'on_leave_today',
      ),
    );
  };

  const onOpenAlert = (meta, bucket) => {
    const rows = (bucket?.rows || []).map((row) => ({
      empNo: row.empNo || '—',
      employeeName: row.employeeName || '—',
      departmentName: row.departmentName || '—',
      leaveTypeName: row.leaveTypeName || row.leaveTypeCode || '—',
      status: leaveStatusLabel(row.status) || row.reason || '—',
      detail:
        row.startDate && row.endDate
          ? `${row.startDate} → ${row.endDate}`
          : row.remaining != null
            ? `Remaining ${row.remaining}`
            : row.usedRatio != null
              ? `Used ${row.usedRatio}%`
              : row.requestSource || '—',
    }));
    openBreakdown(
      buildBreakdown(
        meta.label,
        meta.hint,
        [
          { key: 'empNo', label: 'Emp No' },
          { key: 'employeeName', label: 'Name' },
          { key: 'departmentName', label: 'Department' },
          { key: 'leaveTypeName', label: 'Type' },
          { key: 'status', label: 'Status' },
          { key: 'detail', label: 'Detail' },
        ],
        rows,
        meta.key,
      ),
    );
  };

  return (
    <div className="leave-ops">
      <div className="leave-ops-toolbar">
        <label>
          Date
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value || toIsoDate())}
          />
        </label>
        <label>
          Department
          <select value={departmentCode} onChange={(e) => setDepartmentCode(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((dept) => (
              <option key={dept.id || dept.dept_code} value={dept.dept_code || ''}>
                {dept.department_name || dept.dept_code}
              </option>
            ))}
          </select>
        </label>
        <div className="leave-ops-toolbar-actions">
          <button
            type="button"
            className="leave-ops-btn leave-ops-btn--primary"
            onClick={() => setShowAddLeave(true)}
          >
            Add leave
          </button>
        </div>
      </div>

      {error ? (
        <div className="leave-ops-error">
          {error?.data?.message || error?.error || error?.message || 'Failed to load leave overview.'}
        </div>
      ) : null}

      {isFetching && !data ? (
        <div className="leave-ops-loading" aria-busy="true" aria-live="polite">
          <Bars height={48} width={48} color="#64748b" visible />
        </div>
      ) : (
        <>
          <LeaveTodayByType byType={data?.onLeaveToday?.byType || []} onOpenType={onOpenType} />
          <LeaveUpcoming upcoming={data?.upcoming} />
          <LeaveTrends trends={data?.trends} departmentCode={departmentCode} />
          <LeaveAlerts alerts={data?.alerts} onOpenAlert={onOpenAlert} />
        </>
      )}

      <HrAddLeaveModal
        open={showAddLeave}
        onClose={() => setShowAddLeave(false)}
        employees={employees}
        onSuccess={() => refetch()}
      />
      <HrmDashboardBreakdownModal
        open={breakdownOpen}
        loading={false}
        error={null}
        data={breakdownData}
        onClose={() => {
          setBreakdownOpen(false);
          setBreakdownData(null);
        }}
      />
    </div>
  );
}
