import React, { useEffect, useMemo, useState } from 'react';
import { Bars } from 'react-loader-spinner';
import { FaFileExcel } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import {
  useLazyGetHrLeaveOpsBalancesQuery,
  useLazyGetHrLeaveOpsDayEmployeesQuery,
} from '../../../api/services NodeJs/hrLeaveApi';
import { leaveStatusLabel, requestModeLabel } from '../../../utils/hrStatusLabels';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function downloadLeaveDaysByEmployeeExcel(rows, year, month) {
  const sheetRows = (rows || []).map((row, index) => ({
    '#': index + 1,
    'Emp No': row.empNo || '',
    Name: row.employeeName || '',
    Department: row.departmentName || '',
    'Leave days': Number(row.leaveDays || 0),
    Requests: Number(row.requestCount || 0),
  }));
  const ws = XLSX.utils.json_to_sheet(
    sheetRows.length ? sheetRows : [{ note: 'No employee leave days for this period' }],
  );
  ws['!cols'] = [
    { wch: 5 },
    { wch: 12 },
    { wch: 28 },
    { wch: 28 },
    { wch: 12 },
    { wch: 10 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Leave by employee');
  const monthPart =
    month != null && Number(month) >= 1 && Number(month) <= 12
      ? `_${String(month).padStart(2, '0')}`
      : '';
  XLSX.writeFile(wb, `Leave_days_by_employee_${year || 'all'}${monthPart}.xlsx`);
}

function BarList({ rows, labelKey, valueKey }) {
  const max = Math.max(1, ...rows.map((r) => Number(r[valueKey] || 0)));
  if (!rows.length) return <div className="leave-ops-empty">No data.</div>;
  return (
    <div className="leave-ops-bars">
      {rows.slice(0, 12).map((row) => {
        const value = Number(row[valueKey] || 0);
        const pct = Math.round((value / max) * 100);
        return (
          <div key={`${row[labelKey]}-${value}`} className="leave-ops-bar-row">
            <span title={row[labelKey]}>{row[labelKey]}</span>
            <div className="leave-ops-bar-track">
              <div className="leave-ops-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <strong>{value.toFixed(1)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function EmployeeLeaveDetailModal({ open, employee, year, onClose }) {
  const [fetchDetail] = useLazyGetHrLeaveOpsBalancesQuery();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !employee?.employeeId) {
      setDetail(null);
      setError(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await fetchDetail({
          employeeId: Number(employee.employeeId),
          year: Number(year) || new Date().getFullYear(),
        }).unwrap();
        if (!cancelled) setDetail(data);
      } catch (err) {
        if (!cancelled) {
          setDetail(null);
          setError(err?.data?.message || err?.error || err?.message || 'Failed to load employee leave details.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, employee?.employeeId, year, fetchDetail]);

  if (!open || !employee) return null;

  const titleName =
    detail?.employee?.employeeName
    || employee.employeeName
    || employee.label
    || 'Employee';
  const empNo = detail?.employee?.empNo || employee.empNo || '';

  return (
    <div className="leave-ops-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="leave-ops-modal leave-ops-modal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-emp-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <h3 id="leave-emp-detail-title">{titleName}</h3>
            <p className="leave-ops-modal-sub">
              {[empNo, detail?.employee?.department || employee.departmentName, detail?.employee?.designation]
                .filter(Boolean)
                .join(' · ')}
              {year ? ` · ${year}` : ''}
            </p>
          </div>
          <button type="button" className="leave-ops-btn" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="leave-ops-modal-body">
          {loading ? (
            <div className="leave-ops-modal-loading">
              <Bars height={40} width={40} color="#64748b" visible />
            </div>
          ) : null}
          {error ? <div className="leave-ops-error">{error}</div> : null}

          {!loading && !error ? (
            <>
              <section>
                <h4 className="leave-ops-modal-section-title">Leave balances</h4>
                {(detail?.balances || []).length === 0 ? (
                  <div className="leave-ops-empty">No balances for this year.</div>
                ) : (
                  <div className="leave-ops-table-wrap">
                    <table className="leave-ops-table">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Quota</th>
                          <th>Used</th>
                          <th>Pending</th>
                          <th>Remaining</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detail?.balances || []).map((row) => (
                          <tr key={row.leaveTypeCode}>
                            <td>{row.leaveTypeName || row.leaveTypeCode}</td>
                            <td>{Number(row.availableQuota || 0).toFixed(1)}</td>
                            <td>{Number(row.used || 0).toFixed(1)}</td>
                            <td>{Number(row.pending || 0).toFixed(1)}</td>
                            <td>
                              <strong>{Number(row.remaining || 0).toFixed(1)}</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section>
                <h4 className="leave-ops-modal-section-title">Leave history</h4>
                {(detail?.history || []).length === 0 ? (
                  <div className="leave-ops-empty">No leave requests for this year.</div>
                ) : (
                  <div className="leave-ops-table-wrap">
                    <table className="leave-ops-table">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Mode</th>
                          <th>Status</th>
                          <th>Dates</th>
                          <th>Days</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detail?.history || []).map((row) => (
                          <tr key={row.leaveRequestId}>
                            <td>
                              {row.leaveTypeName || row.leaveTypeCode || '—'}
                              {row.isShortLeave ? (
                                <span className="leave-ops-tag">Short</span>
                              ) : null}
                              {row.autoGenerated ? (
                                <span className="leave-ops-tag leave-ops-tag--muted">Auto</span>
                              ) : null}
                            </td>
                            <td>{requestModeLabel(row.requestMode)}</td>
                            <td>{leaveStatusLabel(row.leaveStatus || row.status)}</td>
                            <td>
                              {row.startDate || '—'}
                              {row.endDate && row.endDate !== row.startDate
                                ? ` → ${row.endDate}`
                                : ''}
                            </td>
                            <td>
                              {row.isShortLeave
                                ? row.shortLeaveMinutes
                                  ? `${row.shortLeaveMinutes} min`
                                  : '—'
                                : Number(row.leaveDays || 0).toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DayLeaveModal({ open, dateKey, departmentCode, onClose }) {
  const [fetchDay] = useLazyGetHrLeaveOpsDayEmployeesQuery();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !dateKey) {
      setDetail(null);
      setError(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await fetchDay({
          date: dateKey,
          departmentCode: departmentCode || undefined,
        }).unwrap();
        if (!cancelled) setDetail(data);
      } catch (err) {
        if (!cancelled) {
          setDetail(null);
          setError(err?.data?.message || err?.error || err?.message || 'Failed to load leave for this date.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, dateKey, departmentCode, fetchDay]);

  if (!open || !dateKey) return null;

  const heading = (() => {
    const d = new Date(`${dateKey}T12:00:00`);
    if (Number.isNaN(d.getTime())) return dateKey;
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  })();

  return (
    <div className="leave-ops-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="leave-ops-modal leave-ops-modal--day"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-day-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <h3 id="leave-day-detail-title">On leave</h3>
            <p className="leave-ops-modal-sub">
              {heading}
              {!loading && !error && detail ? ` · ${Number(detail.total || detail.employees?.length || 0)} employee(s)` : ''}
            </p>
          </div>
          <button type="button" className="leave-ops-btn" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="leave-ops-modal-body leave-ops-modal-body--day">
          {loading ? (
            <div className="leave-ops-modal-loading">
              <Bars height={36} width={36} color="#0f766e" visible />
            </div>
          ) : null}
          {error ? <div className="leave-ops-error">{error}</div> : null}
          {!loading && !error ? (
            (detail?.employees || []).length === 0 ? (
              <div className="leave-ops-empty">No employees on leave this day.</div>
            ) : (
              <div className="leave-ops-table-wrap leave-ops-table-wrap--day">
                <table className="leave-ops-table leave-ops-table--day">
                  <thead>
                    <tr>
                      <th>Emp No</th>
                      <th>Name</th>
                      <th>Department</th>
                      <th>Designation</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail?.employees || []).map((row) => (
                      <tr key={`${row.leaveRequestId}-${row.employeeId}`}>
                        <td className="leave-ops-td-empno">{row.empNo || '—'}</td>
                        <td className="leave-ops-td-name">{row.employeeName || '—'}</td>
                        <td className="leave-ops-td-wrap">{row.departmentName || '—'}</td>
                        <td className="leave-ops-td-wrap">{row.designation || '—'}</td>
                        <td>
                          {row.leaveTypeName || row.leaveTypeCode || '—'}
                          {row.autoGenerated ? (
                            <span className="leave-ops-tag leave-ops-tag--muted">Auto</span>
                          ) : null}
                        </td>
                        <td>{leaveStatusLabel(row.leaveStatus || row.status)}</td>
                        <td className="leave-ops-td-unit">
                          {requestModeLabel(row.requestMode)}
                          {row.dayUnit != null ? ` · ${Number(row.dayUnit).toFixed(1)}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MonthlyCalendarChart({ year, monthly, calendarDays, departmentCode }) {
  const defaultMonth = useMemo(() => {
    const now = new Date();
    if (Number(year) === now.getFullYear()) return now.getMonth() + 1;
    return Number(calendarDays?.[0]?.month) || 1;
  }, [year, calendarDays]);

  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    setSelectedMonth(defaultMonth);
  }, [year, defaultMonth]);

  const daysByDate = useMemo(
    () => new Map((calendarDays || []).map((d) => [d.leaveDate, d])),
    [calendarDays],
  );

  const selectedMonthTotal = useMemo(() => {
    const hit = (monthly || []).find((r) => Number(r.month) === Number(selectedMonth));
    return Number(hit?.leaveDays || 0);
  }, [monthly, selectedMonth]);

  const calCells = useMemo(() => {
    const y = Number(year) || new Date().getFullYear();
    const m = Number(selectedMonth) || 1;
    const first = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const cells = [];
    for (let i = 0; i < first.getDay(); i += 1) {
      cells.push({ key: `pad-${m}-${i}`, empty: true });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const hit = daysByDate.get(key);
      cells.push({
        key,
        day,
        leaveDate: key,
        leaveDays: Number(hit?.leaveDays || 0),
        employeeCount: Number(hit?.employeeCount || 0),
      });
    }
    return cells;
  }, [year, selectedMonth, daysByDate]);

  return (
    <div className="leave-ops-panel leave-ops-panel--full leave-ops-month-cal">
      <div className="leave-ops-panel-head">
        <div>
          <h4>Leave calendar</h4>
          <p className="leave-ops-panel-sub">Select a month, then a date to see who is on leave</p>
        </div>
        <span className="leave-ops-panel-meta">{year}</span>
      </div>

      <div className="leave-ops-month-tabs" role="tablist" aria-label="Months">
        {(monthly || []).map((row) => {
          const value = Number(row.leaveDays || 0);
          const active = Number(selectedMonth) === Number(row.month);
          return (
            <button
              key={row.month}
              type="button"
              role="tab"
              aria-selected={active}
              className={`leave-ops-month-tab${active ? ' is-active' : ''}`}
              onClick={() => setSelectedMonth(row.month)}
            >
              <span className="leave-ops-month-tab-label">{MONTH_LABELS[row.month - 1]}</span>
              <span className="leave-ops-month-tab-value">{value.toFixed(0)}</span>
            </button>
          );
        })}
      </div>

      <div className="leave-ops-month-cal-body">
        <div className="leave-ops-month-cal-title-row">
          <h5 className="leave-ops-month-cal-title">
            {MONTH_LABELS[(selectedMonth || 1) - 1]} {year}
          </h5>
          <span className="leave-ops-month-cal-total">
            {selectedMonthTotal.toFixed(1)} leave days
          </span>
        </div>

        <div className="leave-ops-cal">
          {WEEKDAYS.map((d) => (
            <div key={d} className="leave-ops-cal-head">
              {d}
            </div>
          ))}
          {calCells.map((cell) =>
            cell.empty ? (
              <div key={cell.key} className="leave-ops-cal-day leave-ops-cal-day--empty" />
            ) : (
              <button
                key={cell.key}
                type="button"
                className={`leave-ops-cal-day leave-ops-cal-day--btn${
                  cell.leaveDays > 0 ? ' leave-ops-cal-day--has' : ''
                }${selectedDate === cell.leaveDate ? ' is-selected' : ''}`}
                onClick={() => setSelectedDate(cell.leaveDate)}
                title={
                  cell.leaveDays > 0
                    ? `${cell.employeeCount} on leave · ${cell.leaveDays.toFixed(1)} days`
                    : 'View leave for this date'
                }
              >
                <span className="leave-ops-cal-day-num">{cell.day}</span>
                {cell.leaveDays > 0 ? (
                  <span className="leave-ops-cal-day-dot" aria-hidden />
                ) : null}
              </button>
            ),
          )}
        </div>
      </div>

      <DayLeaveModal
        open={Boolean(selectedDate)}
        dateKey={selectedDate}
        departmentCode={departmentCode}
        onClose={() => setSelectedDate(null)}
      />
    </div>
  );
}

export default function LeaveTrends({ trends, departmentCode }) {
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const byDepartment = useMemo(
    () =>
      (trends?.byDepartment || []).map((r) => ({
        ...r,
        label: r.departmentName || r.departmentCode || '—',
      })),
    [trends],
  );
  const byEmployee = useMemo(
    () =>
      (trends?.byEmployee || []).map((r) => ({
        ...r,
        label: `${r.empNo || ''} ${r.employeeName || ''}`.trim() || '—',
      })),
    [trends],
  );
  const maxEmployeeDays = useMemo(
    () => Math.max(1, ...byEmployee.map((r) => Number(r.leaveDays || 0))),
    [byEmployee],
  );
  const monthly = trends?.monthlyTrend || [];
  const calendar = trends?.calendar || {};
  const year = trends?.year || new Date().getFullYear();
  const month = trends?.month;

  return (
    <section className="leave-ops-section">
      <h3>Leave trends</h3>
      <p className="leave-ops-section-hint">
        Approved leave only · short leave excluded from day totals
      </p>

      <div className="leave-ops-panel leave-ops-panel--full">
        <div className="leave-ops-panel-head">
          <div>
            <h4>Leave days by employee</h4>
            <p className="leave-ops-panel-sub">Click an employee for balances and history</p>
          </div>
          <div className="leave-ops-panel-actions">
            <span className="leave-ops-panel-meta">{byEmployee.length}</span>
            <button
              type="button"
              className="leave-ops-excel-btn"
              disabled={byEmployee.length === 0}
              title="Download leave days by employee (Excel)"
              aria-label="Download leave days by employee Excel"
              onClick={() => downloadLeaveDaysByEmployeeExcel(byEmployee, year, month)}
            >
              <FaFileExcel aria-hidden />
            </button>
          </div>
        </div>
        {byEmployee.length === 0 ? (
          <div className="leave-ops-empty">No employees found.</div>
        ) : (
          <div className="leave-ops-emp-grid">
            {byEmployee.map((row) => {
              const value = Number(row.leaveDays || 0);
              const pct = Math.round((value / maxEmployeeDays) * 100);
              return (
                <button
                  key={row.employeeId}
                  type="button"
                  className="leave-ops-emp-row"
                  onClick={() => setSelectedEmployee(row)}
                  title="View leave balances and history"
                >
                  <span className="leave-ops-emp-row-label" title={row.label}>
                    {row.label}
                  </span>
                  <div className="leave-ops-bar-track">
                    <div className="leave-ops-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <strong>{value.toFixed(1)}</strong>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="leave-ops-trends leave-ops-trends--after-emp">
        <div className="leave-ops-panel">
          <h4>Leave days by department</h4>
          <BarList rows={byDepartment} labelKey="label" valueKey="leaveDays" />
        </div>
      </div>

      <MonthlyCalendarChart
        year={year}
        monthly={monthly}
        calendarDays={calendar.days || []}
        departmentCode={departmentCode}
      />

      <EmployeeLeaveDetailModal
        open={Boolean(selectedEmployee)}
        employee={selectedEmployee}
        year={year}
        onClose={() => setSelectedEmployee(null)}
      />
    </section>
  );
}
