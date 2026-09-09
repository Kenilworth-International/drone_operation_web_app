import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  FaUsers,
  FaUserCheck,
  FaCalendarAlt,
  FaClipboardCheck,
  FaChartLine,
  FaSync,
  FaSitemap,
  FaClock,
  FaUserTie,
  FaFileExcel,
  FaBirthdayCake,
  FaUmbrellaBeach,
} from 'react-icons/fa';
import {
  useGetHrmDashboardSummaryQuery,
  useLazyGetHrmDashboardBreakdownQuery,
} from '../../../api/services NodeJs/hrLeaveApi';
import { withCurrentWingSearch } from '../../../config/wingRouteGuard';
import {
  exportHrmAttendanceExcel,
  exportHrmFullDashboardExcel,
  exportHrmKpiExcel,
  exportHrmLeaveExcel,
  exportHrmSummaryExcel,
  exportHrmWorkforceExcel,
} from './hrmDashboardExport';
import HrmDashboardBreakdownModal from './HrmDashboardBreakdownModal';
import {
  buildPeriodOptions,
  defaultPeriodKey,
  periodLabel as formatPeriodLabel,
} from '../kpi/kpiPeriodHelpers';
import '../../../styles/hrmDashboard.css';
import '../../../styles/employeeKpi.css';

const LEAVE_COLORS = ['#6b4c8a', '#2563eb', '#059669', '#d97706', '#dc2626', '#64748b'];
const SMART_STATUS_COLORS = ['#6b4c8a', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#94a3b8'];
const DEPT_COLORS = ['#6b4c8a', '#2563eb', '#0d9488', '#7c3aed', '#0891b2', '#059669', '#6366f1', '#64748b'];
const CHART_HEIGHT = 220;

function formatStatusLabel(status) {
  return String(status || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function shortDeptLabel(name, max = 12) {
  const text = String(name || '—');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function daysUntilLabel(daysUntil) {
  const days = Number(daysUntil);
  if (!Number.isFinite(days)) return '';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

function formatShortDate(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function ExcelButton({ onClick, label = 'Export Excel' }) {
  return (
    <button
      type="button"
      className="hrm-dash-export-btn hrm-dash-export-btn--icon"
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      <FaFileExcel />
    </button>
  );
}

function StatCard({ icon: Icon, label, value, hint, accent = 'purple', onClick, hintOnClick }) {
  const clickable = typeof onClick === 'function';
  return (
    <div
      className={`hrm-dash-stat hrm-dash-stat--${accent}${clickable ? ' hrm-dash-stat--clickable' : ''}`}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      title={clickable ? 'Click to view who is included' : undefined}
    >
      <div className="hrm-dash-stat-icon" aria-hidden><Icon /></div>
      <div className="hrm-dash-stat-body">
        <span className="hrm-dash-stat-label">{label}</span>
        <strong className="hrm-dash-stat-value">{value}</strong>
        {hint ? (
          typeof hintOnClick === 'function' ? (
            <button
              type="button"
              className="hrm-dash-stat-hint hrm-dash-stat-hint--link"
              onClick={(e) => {
                e.stopPropagation();
                hintOnClick();
              }}
            >
              {hint}
            </button>
          ) : (
            <span className="hrm-dash-stat-hint">{hint}</span>
          )
        ) : null}
      </div>
    </div>
  );
}

function ChartPanel({
  title,
  subtitle,
  children,
  empty,
  emptyText = 'No data for this period.',
  onExport,
  exportLabel,
}) {
  return (
    <div className="hrm-dash-chart-panel">
      <div className="hrm-dash-chart-head">
        <div className="hrm-dash-chart-head-main">
          <h3>{title}</h3>
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
        {onExport ? (
          <div className="hrm-dash-chart-head-actions">
            <ExcelButton onClick={onExport} label={exportLabel || `Export ${title} to Excel`} />
          </div>
        ) : null}
      </div>
      {empty ? <p className="hrm-dash-empty">{emptyText}</p> : children}
    </div>
  );
}

export default function HrmDashboard({ embedded = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [periodType, setPeriodType] = useState('month');
  const [periodKey, setPeriodKey] = useState(() => defaultPeriodKey('month'));
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [breakdownError, setBreakdownError] = useState(null);
  const [breakdownData, setBreakdownData] = useState(null);

  const [fetchBreakdown, { isFetching: breakdownLoading }] = useLazyGetHrmDashboardBreakdownQuery();

  useEffect(() => {
    if (embedded) return undefined;
    const root = document.querySelector('.content-dashboard');
    root?.classList.add('content-dashboard--hrm-dashboard');
    return () => root?.classList.remove('content-dashboard--hrm-dashboard');
  }, [embedded]);

  const queryBody = useMemo(() => ({ periodType, periodKey }), [periodType, periodKey]);
  const { data, isFetching, refetch, isError, error } = useGetHrmDashboardSummaryQuery(queryBody);

  const periodOptions = useMemo(() => buildPeriodOptions(periodType), [periodType]);

  const handlePeriodTypeChange = (nextType) => {
    setPeriodType(nextType);
    setPeriodKey(defaultPeriodKey(nextType));
  };

  const openBreakdown = useCallback(async (payload) => {
    setBreakdownOpen(true);
    setBreakdownError(null);
    setBreakdownData(null);
    try {
      const result = await fetchBreakdown({
        periodType,
        periodKey,
        ...payload,
      }).unwrap();
      setBreakdownData(result);
    } catch (err) {
      setBreakdownError(
        err?.data?.message || err?.error || err?.message || 'Failed to load breakdown details.',
      );
    }
  }, [fetchBreakdown, periodType, periodKey]);

  const closeBreakdown = useCallback(() => {
    setBreakdownOpen(false);
    setBreakdownError(null);
    setBreakdownData(null);
  }, []);

  const workforce = data?.workforce || {};
  const attendance = data?.attendance || {};
  const leave = data?.leave || {};
  const kpi = data?.kpi || {};
  const upcomingHolidays = data?.upcomingHolidays?.items || [];
  const upcomingBirthdays = data?.upcomingBirthdays?.items || [];
  const holidayDaysAhead = data?.upcomingHolidays?.daysAhead ?? 60;
  const birthdayDaysAhead = data?.upcomingBirthdays?.daysAhead ?? 30;

  const attendanceTrend = attendance.trend || [];
  const leaveBreakdown = leave.statusBreakdown || [];
  const deptHeadcountAll = workforce.departmentHeadcount || [];
  const deptHeadcountChart = deptHeadcountAll.slice(0, 12);
  const smartBreakdown = kpi.smart?.statusBreakdown || [];

  const leavePieData = leaveBreakdown.map((row, index) => ({
    name: formatStatusLabel(row.status),
    status: row.status,
    value: row.count,
    fill: LEAVE_COLORS[index % LEAVE_COLORS.length],
  }));

  const deptBarData = deptHeadcountChart.map((row) => ({
    name: shortDeptLabel(row.departmentName || row.departmentCode),
    fullName: row.departmentName || row.departmentCode,
    departmentCode: row.departmentCode,
    count: row.headcount,
  }));

  const smartBarData = smartBreakdown.map((row) => ({
    name: formatStatusLabel(row.status),
    status: row.status,
    count: row.count,
  }));

  const periodLabel = useMemo(
    () => formatPeriodLabel(periodType, periodKey),
    [periodType, periodKey],
  );

  const attendanceTrendSubtitle = periodType === 'year'
    ? 'Monthly · click a point for names'
    : 'Daily · click a point for names';

  const exportCtx = useMemo(() => ({
    data,
    periodType,
    periodKey,
    periodLabel,
  }), [data, periodType, periodKey, periodLabel]);

  const quickLinkIcons = {
    Employees: FaUsers,
    'Organization Structure': FaSitemap,
    'Attendance & Roaster': FaClock,
    'Employee KPI': FaChartLine,
    'Leave Management': FaCalendarAlt,
    'Employee Profile': FaUserTie,
  };

  return (
    <div className={`hrm-dashboard${embedded ? ' hrm-dashboard--embedded' : ''}`}>
      {!embedded ? (
        <header className="hrm-dash-header">
          <div>
            <h1>HRM Dashboard</h1>
            <p className="hrm-dash-subtitle">
              {periodLabel}
              {' · '}
              Click a card, bar, or pie slice to see who is included
            </p>
          </div>
        </header>
      ) : null}

      <div className="employee-kpi-toolbar hrm-dash-toolbar">
        <label>
          Period type
          <select value={periodType} onChange={(e) => handlePeriodTypeChange(e.target.value)}>
            <option value="month">Month</option>
            <option value="quarter">Quarter</option>
            <option value="year">Year</option>
          </select>
        </label>
        <label>
          Period
          <select value={periodKey} onChange={(e) => setPeriodKey(e.target.value)}>
            {periodOptions.map((opt) => (
              <option key={opt} value={opt}>{formatPeriodLabel(periodType, opt)}</option>
            ))}
          </select>
        </label>
        <div className="employee-kpi-toolbar-actions">
          <button
            type="button"
            className="employee-kpi-btn employee-kpi-btn-secondary"
            onClick={() => exportHrmFullDashboardExcel(exportCtx)}
            disabled={!data}
          >
            <FaFileExcel style={{ marginRight: 6 }} />
            Full report
          </button>
          <button
            type="button"
            className="employee-kpi-btn employee-kpi-btn-secondary"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <FaSync className={isFetching ? 'spin' : ''} style={{ marginRight: 6 }} />
            Refresh
          </button>
        </div>
      </div>

      {isError ? (
        <div className="hrm-dash-error">
          {error?.data?.message || 'Failed to load dashboard data.'}
        </div>
      ) : null}

      <div className="hrm-dash-section-head">
        <h2>Key metrics</h2>
        <ExcelButton
          onClick={() => exportHrmSummaryExcel(exportCtx)}
          label="Export key metrics summary to Excel"
        />
      </div>

      <section className="hrm-dash-stats">
        <StatCard
          icon={FaUsers}
          label="Total employees"
          value={workforce.totalEmployees ?? '—'}
          hint={`${workforce.totalDepartments ?? 0} departments`}
          accent="purple"
          onClick={() => openBreakdown({ metric: 'total_employees' })}
        />
        <StatCard
          icon={FaUserCheck}
          label="Present"
          value={attendance.presentCount ?? '—'}
          hint={attendance.attendanceRate != null ? `${attendance.attendanceRate}% rate` : 'No attendance records'}
          accent="green"
          onClick={() => openBreakdown({ metric: 'present' })}
        />
        <StatCard
          icon={FaCalendarAlt}
          label="On leave today"
          value={leave.onLeaveToday ?? '—'}
          hint={`${leave.pendingApprovals ?? 0} pending approvals`}
          accent="blue"
          onClick={() => openBreakdown({ metric: 'on_leave_today' })}
          hintOnClick={() => openBreakdown({ metric: 'pending_approvals' })}
        />
        <StatCard
          icon={FaClipboardCheck}
          label="Open vacancies"
          value={workforce.openVacancies ?? '—'}
          hint={`${workforce.unassignedEmployees ?? 0} unassigned`}
          accent="amber"
          onClick={() => openBreakdown({ metric: 'open_vacancies' })}
          hintOnClick={() => openBreakdown({ metric: 'unassigned' })}
        />
        <StatCard
          icon={FaChartLine}
          label="Avg KPI score"
          value={kpi.system?.averageScore ?? kpi.smart?.averageScore ?? '—'}
          hint={kpi.system?.topPerformer?.employee_name ? `Top: ${kpi.system.topPerformer.employee_name}` : 'System + SMART KPI'}
          accent="violet"
          onClick={() => openBreakdown({ metric: 'avg_kpi' })}
        />
      </section>

      <section className="hrm-dash-grid hrm-dash-grid--2">
        <ChartPanel
          title="Attendance trend"
          subtitle={attendanceTrendSubtitle}
          empty={!attendanceTrend.length}
          onExport={() => exportHrmAttendanceExcel(exportCtx)}
          exportLabel="Export attendance detail to Excel"
        >
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <AreaChart data={attendanceTrend}>
              <defs>
                <linearGradient id="hrmPresentFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6b4c8a" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6b4c8a" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} width={32} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey="present"
                name="Present"
                stroke="#6b4c8a"
                fill="url(#hrmPresentFill)"
                strokeWidth={2}
                activeDot={{
                  r: 5,
                  cursor: 'pointer',
                  onClick: (_e, payload) => {
                    const bucket = payload?.payload?.label;
                    if (bucket) openBreakdown({ metric: 'present', bucket });
                  },
                }}
              />
              <Area
                type="monotone"
                dataKey="absent"
                name="Absent"
                stroke="#ef4444"
                fill="transparent"
                strokeWidth={2}
                activeDot={{
                  r: 5,
                  cursor: 'pointer',
                  onClick: (_e, payload) => {
                    const bucket = payload?.payload?.label;
                    if (bucket) openBreakdown({ metric: 'absent', bucket });
                  },
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          title="Leave requests"
          subtitle="By status · click a slice"
          empty={!leavePieData.length}
          onExport={() => exportHrmLeaveExcel(exportCtx)}
          exportLabel="Export leave detail to Excel"
        >
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <PieChart>
              <Pie
                data={leavePieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={78}
                label
                style={{ cursor: 'pointer' }}
                onClick={(entry) => {
                  if (entry?.status) {
                    openBreakdown({ metric: 'leave_status', status: entry.status });
                  }
                }}
              >
                {leavePieData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} style={{ cursor: 'pointer' }} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>
      </section>

      <section className="hrm-dash-grid hrm-dash-grid--2">
        <ChartPanel
          title="Headcount by department"
          subtitle={`${workforce.totalEmployees ?? 0} employees · click a bar`}
          empty={!deptBarData.length}
          onExport={() => exportHrmWorkforceExcel(exportCtx)}
          exportLabel="Export workforce detail to Excel"
        >
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart data={deptBarData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-24} textAnchor="end" height={48} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} width={32} />
              <Tooltip formatter={(value, _name, props) => [value, props.payload.fullName]} />
              <Bar
                dataKey="count"
                name="Employees"
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                onClick={(entry) => {
                  if (entry?.departmentCode) {
                    openBreakdown({
                      metric: 'department_headcount',
                      departmentCode: entry.departmentCode,
                    });
                  }
                }}
              >
                {deptBarData.map((_, index) => (
                  <Cell key={index} fill={DEPT_COLORS[index % DEPT_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          title="SMART KPI reviews"
          subtitle={`${kpi.smart?.reviewCount ?? 0} reviews · click a bar`}
          empty={!smartBarData.length}
          onExport={() => exportHrmKpiExcel(exportCtx)}
          exportLabel="Export KPI detail to Excel"
        >
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart data={smartBarData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-18} textAnchor="end" height={44} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} width={32} />
              <Tooltip />
              <Bar
                dataKey="count"
                name="Reviews"
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                onClick={(entry) => {
                  if (entry?.status) {
                    openBreakdown({ metric: 'smart_kpi_status', status: entry.status });
                  }
                }}
              >
                {smartBarData.map((_, index) => (
                  <Cell key={index} fill={SMART_STATUS_COLORS[index % SMART_STATUS_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </section>

      <section className="hrm-dash-grid hrm-dash-grid--2">
        <ChartPanel
          title="Upcoming holidays"
          subtitle={`Next ${holidayDaysAhead} days · marked calendar`}
          empty={!upcomingHolidays.length}
          emptyText="No marked holidays in the next window."
        >
          <ul className="hrm-dash-upcoming-list">
            {upcomingHolidays.map((row) => (
              <li key={`${row.holidayDate}-${row.id || row.holidayType}`} className="hrm-dash-upcoming-item">
                <div className="hrm-dash-upcoming-icon hrm-dash-upcoming-icon--holiday" aria-hidden>
                  <FaUmbrellaBeach />
                </div>
                <div className="hrm-dash-upcoming-body">
                  <strong>{row.description || row.holidayTypeLabel || 'Holiday'}</strong>
                  <span>
                    {formatShortDate(row.holidayDate)}
                    {row.holidayTypeLabel ? ` · ${row.holidayTypeLabel}` : ''}
                  </span>
                </div>
                <span className={`hrm-dash-upcoming-when${row.daysUntil === 0 ? ' is-today' : ''}`}>
                  {daysUntilLabel(row.daysUntil)}
                </span>
              </li>
            ))}
          </ul>
        </ChartPanel>

        <ChartPanel
          title="Upcoming birthdays"
          subtitle={`Next ${birthdayDaysAhead} days · employees`}
          empty={!upcomingBirthdays.length}
          emptyText="No employee birthdays in the next window."
        >
          <ul className="hrm-dash-upcoming-list">
            {upcomingBirthdays.map((row) => (
              <li key={row.employeeId} className="hrm-dash-upcoming-item">
                <div className="hrm-dash-upcoming-icon hrm-dash-upcoming-icon--birthday" aria-hidden>
                  <FaBirthdayCake />
                </div>
                <div className="hrm-dash-upcoming-body">
                  <strong>{row.employeeName}</strong>
                  <span>
                    {formatShortDate(row.nextBirthdayDate)}
                    {row.departmentName ? ` · ${row.departmentName}` : ''}
                    {row.empNo ? ` · ${row.empNo}` : ''}
                  </span>
                </div>
                <span className={`hrm-dash-upcoming-when${row.daysUntil === 0 ? ' is-today' : ''}`}>
                  {daysUntilLabel(row.daysUntil)}
                </span>
              </li>
            ))}
          </ul>
        </ChartPanel>
      </section>

      <section className="hrm-dash-quick-links">
        <div className="hrm-dash-section-head">
          <h2>Quick links</h2>
        </div>
        <div className="hrm-dash-quick-grid">
          {(data?.quickLinks || []).map((link) => {
            const Icon = quickLinkIcons[link.label] || FaUsers;
            return (
              <button
                key={link.path}
                type="button"
                className="hrm-dash-quick-card"
                onClick={() => navigate(withCurrentWingSearch(link.path, location.search))}
              >
                <Icon aria-hidden />
                <span>{link.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <HrmDashboardBreakdownModal
        open={breakdownOpen}
        loading={breakdownLoading}
        error={breakdownError}
        data={breakdownData}
        onClose={closeBreakdown}
      />
    </div>
  );
}
