import React, { useCallback, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Bars } from 'react-loader-spinner';
import {
  useGetKpiLeaderboardQuery,
  useLazyGetKpiEmployeeDetailQuery,
} from '../../../api/services NodeJs/employeeKpiApi';
import { useGetEmpDepartmentsQuery, useGetEmpDesignationsQuery } from '../../../api/services NodeJs/empOrgStructureApi';

const EMPTY_LIST = [];

function getWingFromUrl(searchParams, location) {
  const fromParams = searchParams.get('wing');
  if (fromParams) return fromParams;
  const fromLocation = new URLSearchParams(location.search || '').get('wing');
  if (fromLocation) return fromLocation;
  const hash = window.location.hash || '';
  const qIdx = hash.indexOf('?');
  if (qIdx >= 0) {
    return new URLSearchParams(hash.slice(qIdx + 1)).get('wing') || '';
  }
  return '';
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function defaultPeriodKey(periodType) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (periodType === 'year') return String(y);
  if (periodType === 'quarter') return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
  return `${y}-${pad2(m)}`;
}

function periodLabel(periodType, periodKey) {
  if (periodType === 'month') {
    const [y, m] = periodKey.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  }
  if (periodType === 'quarter') return periodKey.replace('-', ' ');
  return periodKey;
}

function buildMonthOptions(count = 18) {
  const options = [];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
  }
  return options;
}

function buildQuarterOptions(count = 8) {
  const options = [];
  const now = new Date();
  let y = now.getFullYear();
  let q = Math.floor(now.getMonth() / 3) + 1;
  for (let i = 0; i < count; i += 1) {
    options.push(`${y}-Q${q}`);
    q -= 1;
    if (q < 1) {
      q = 4;
      y -= 1;
    }
  }
  return options;
}

function buildYearOptions(count = 5) {
  const y = new Date().getFullYear();
  return Array.from({ length: count }, (_, i) => String(y - i));
}

export default function EmployeeKpiSystemMetrics() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const wingLabel = getWingFromUrl(searchParams, location);

  const [periodType, setPeriodType] = useState('month');
  const [periodKey, setPeriodKey] = useState(defaultPeriodKey('month'));
  const [empDepartmentId, setEmpDepartmentId] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [search, setSearch] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);

  const queryBody = useMemo(
    () => ({
      periodType,
      periodKey,
      empDepartmentId: empDepartmentId ? Number(empDepartmentId) : undefined,
      designationId: designationId ? Number(designationId) : undefined,
      search: search.trim() || undefined,
      limit: 200,
      offset: 0,
    }),
    [periodType, periodKey, empDepartmentId, designationId, search],
  );

  const { data: leaderboard, isLoading, isFetching, error, refetch } = useGetKpiLeaderboardQuery(queryBody);
  const [fetchDetail, { data: detail, isFetching: detailLoading }] = useLazyGetKpiEmployeeDetailQuery();

  const { data: departmentsRaw } = useGetEmpDepartmentsQuery();
  const { data: designationsRaw } = useGetEmpDesignationsQuery({ activated: 1 });

  const departments = useMemo(() => {
    const list = Array.isArray(departmentsRaw) ? departmentsRaw : [];
    return [...list].sort((a, b) => String(a.department_name || a.dept_code || '').localeCompare(String(b.department_name || b.dept_code || '')));
  }, [departmentsRaw]);

  const designations = useMemo(() => {
    const list = Array.isArray(designationsRaw) ? designationsRaw : [];
    return [...list]
      .filter((d) => Number(d.activated) !== 0)
      .sort((a, b) => String(a.designation_title || a.des_code || '').localeCompare(String(b.designation_title || b.des_code || '')));
  }, [designationsRaw]);

  const rows = leaderboard?.rows || EMPTY_LIST;
  const definitions = leaderboard?.definitions || EMPTY_LIST;
  const summary = leaderboard?.summary || {};

  const periodOptions = useMemo(() => {
    if (periodType === 'quarter') return buildQuarterOptions();
    if (periodType === 'year') return buildYearOptions();
    return buildMonthOptions();
  }, [periodType]);

  const handlePeriodTypeChange = (nextType) => {
    setPeriodType(nextType);
    setPeriodKey(defaultPeriodKey(nextType));
  };

  const openDetail = useCallback(
    (employeeId) => {
      setSelectedEmployeeId(employeeId);
      fetchDetail({ employeeId, periodType, periodKey });
    },
    [fetchDetail, periodType, periodKey],
  );

  const exportExcel = () => {
    if (!rows.length) return;
    const metricCodes = definitions.map((d) => d.code);
    const sheetRows = rows.map((row) => {
      const base = {
        Rank: row.rank,
        'Emp No': row.emp_no,
        Employee: row.employee_name,
        Designation: row.designation,
        Department: row.department,
        Composite: row.composite_score,
        Band: row.rating_label,
      };
      for (const code of metricCodes) {
        const metric = (row.metrics || []).find((m) => m.code === code);
        base[code] = metric?.normalized_score ?? '';
      }
      return base;
    });
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'System Metrics');
    XLSX.writeFile(wb, `system-metrics-${periodType}-${periodKey}.xlsx`);
  };

  const profileHref = selectedEmployeeId
    ? `#/home/employees?employee=${selectedEmployeeId}${wingLabel ? `&wing=${encodeURIComponent(wingLabel)}` : ''}`
    : '#';

  return (
    <>
      <p className="smart-kpi-tab-intro">
        Auto-computed HR metrics from attendance, leave, training, and conduct. Configure weights in ICT Master Data.
      </p>

      <div className="employee-kpi-toolbar">
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
              <option key={opt} value={opt}>{periodLabel(periodType, opt)}</option>
            ))}
          </select>
        </label>
        <label>
          Department
          <select value={empDepartmentId} onChange={(e) => setEmpDepartmentId(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.department_name || d.dept_code}</option>
            ))}
          </select>
        </label>
        <label>
          Designation
          <select value={designationId} onChange={(e) => setDesignationId(e.target.value)}>
            <option value="">All designations</option>
            {designations.map((d) => (
              <option key={d.id} value={d.id}>{d.designation_title || d.des_code || `Designation #${d.id}`}</option>
            ))}
          </select>
        </label>
        <label>
          Search
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or emp no" />
        </label>
        <div className="employee-kpi-toolbar-actions">
          <button type="button" className="employee-kpi-btn employee-kpi-btn-secondary" onClick={() => refetch()}>Refresh</button>
          <button type="button" className="employee-kpi-btn employee-kpi-btn-primary" onClick={exportExcel} disabled={!rows.length}>Export Excel</button>
        </div>
      </div>

      {error ? (
        <div className="employee-kpi-error">
          {error?.data?.message || error?.message || 'Failed to load system metrics.'}
        </div>
      ) : null}

      <div className="employee-kpi-summary">
        <div className="employee-kpi-card">
          <div className="employee-kpi-card-label">Top performer</div>
          <div className="employee-kpi-card-value">{summary.top_performer?.employee_name || '—'}</div>
          <div className="employee-kpi-card-sub">
            {summary.top_performer?.composite_score != null ? `${summary.top_performer.composite_score} composite` : 'No rated employees'}
          </div>
        </div>
        <div className="employee-kpi-card">
          <div className="employee-kpi-card-label">Average score</div>
          <div className="employee-kpi-card-value">{summary.average_score != null ? summary.average_score : '—'}</div>
          <div className="employee-kpi-card-sub">{periodLabel(periodType, periodKey)}</div>
        </div>
        <div className="employee-kpi-card">
          <div className="employee-kpi-card-label">Employees rated</div>
          <div className="employee-kpi-card-value">{summary.rated_employees ?? 0}</div>
          <div className="employee-kpi-card-sub">of {summary.total_employees ?? 0} active employees</div>
        </div>
      </div>

      {isLoading || isFetching ? (
        <div className="employee-kpi-loading"><Bars height={40} width={40} color="#004b71" /></div>
      ) : rows.length === 0 ? (
        <div className="employee-kpi-empty">No system metric data for this period.</div>
      ) : (
        <div className="employee-kpi-table-wrap">
          <table className="employee-kpi-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Employee</th>
                <th>Designation</th>
                <th>Composite</th>
                <th>Band</th>
                {definitions.map((def) => <th key={def.code}>{def.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.employee_id} onClick={() => openDetail(row.employee_id)}>
                  <td className="employee-kpi-rank">{row.rank}</td>
                  <td>
                    <div>{row.employee_name}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{row.emp_no}</div>
                  </td>
                  <td>{row.designation}</td>
                  <td className="employee-kpi-score">{row.composite_score ?? '—'}</td>
                  <td>
                    <span className="employee-kpi-band">
                      <span className="employee-kpi-band-dot" style={{ backgroundColor: row.rating_color || '#64748b' }} />
                      {row.rating_label}
                    </span>
                  </td>
                  {definitions.map((def) => {
                    const metric = (row.metrics || []).find((m) => m.code === def.code);
                    return <td key={def.code}>{metric?.normalized_score ?? '—'}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedEmployeeId && (
        <div className="employee-kpi-drawer-overlay">
          <div className="employee-kpi-drawer">
            <div className="employee-kpi-drawer-header">
              <div>
                <h2>{detail?.employee?.employee_name || 'Employee detail'}</h2>
                <p>
                  {detail?.employee?.emp_no ? `${detail.employee.emp_no} · ` : ''}
                  {detail?.employee?.designation || ''}
                  {detail?.employee?.department ? ` · ${detail.employee.department}` : ''}
                </p>
              </div>
              <button type="button" className="employee-kpi-drawer-close" onClick={() => setSelectedEmployeeId(null)}>×</button>
            </div>
            <div className="employee-kpi-drawer-body">
              {detailLoading ? (
                <div className="employee-kpi-loading">Loading detail…</div>
              ) : (
                <>
                  <div className="employee-kpi-card" style={{ marginBottom: 16 }}>
                    <div className="employee-kpi-card-label">Composite score</div>
                    <div className="employee-kpi-card-value">{detail?.composite_score ?? '—'}</div>
                    <div className="employee-kpi-card-sub">
                      <span className="employee-kpi-band">
                        <span className="employee-kpi-band-dot" style={{ backgroundColor: detail?.rating_color || '#64748b' }} />
                        {detail?.rating_label}
                      </span>
                      {' · '}
                      {periodLabel(periodType, periodKey)}
                    </div>
                  </div>
                  {(detail?.metrics || []).map((metric) => (
                    <div key={metric.code} className="employee-kpi-metric-row">
                      <div>
                        <div className="employee-kpi-metric-name">{metric.name}</div>
                        <div className="employee-kpi-metric-values">Raw: {metric.raw_value ?? '—'} · Target: {metric.target_value}</div>
                      </div>
                      <div className="employee-kpi-metric-score">{metric.normalized_score ?? '—'}</div>
                    </div>
                  ))}
                  <a className="employee-kpi-profile-link" href={profileHref}>Open employee profile →</a>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
