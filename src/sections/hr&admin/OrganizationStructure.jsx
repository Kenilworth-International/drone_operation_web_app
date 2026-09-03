import React, { useEffect, useMemo, useState } from 'react';
import {
  useGetOrgChartQuery,
  useGetDepartmentHeadcountQuery,
  useGetVacancyReportQuery,
} from '../../api/services NodeJs/employeeProfileApi';
import '../../styles/organizationStructure.css';
import OrgChartTree from './employeeProfile/OrgChartTree';
import OrgChartViewport from './employeeProfile/OrgChartViewport';
import { HeadcountReportViz, VacancyReportViz } from './empOrg/OrgStructureReports';
import { useNavigate, useLocation } from 'react-router-dom';
import { withCurrentWingSearch } from '../../config/wingRouteGuard';

function filterTree(nodes, query) {
  if (!query.trim()) return nodes;
  const q = query.trim().toLowerCase();

  function walk(node) {
    const children = (node.children || []).map(walk).filter(Boolean);
    const selfMatch =
      node.name?.toLowerCase().includes(q)
      || node.subtitle?.toLowerCase().includes(q)
      || node.designation?.toLowerCase().includes(q)
      || node.departmentName?.toLowerCase().includes(q)
      || node.nodeType?.toLowerCase().includes(q)
      || String(node.empNo || '').toLowerCase().includes(q);

    if (selfMatch || children.length) {
      return { ...node, children: children.length ? children : (selfMatch ? node.children || [] : []) };
    }
    return null;
  }

  return nodes.map(walk).filter(Boolean);
}

function countNodes(nodes) {
  let n = 0;
  const walk = (list) => {
    list.forEach((node) => {
      n += 1;
      if (node.children?.length) walk(node.children);
    });
  };
  walk(nodes);
  return n;
}

const CHART_MODES = [
  { id: 'structure', label: 'Structure' },
  { id: 'mixed', label: 'Mixed' },
  { id: 'employees', label: 'Employees' },
];

const CHART_LEGEND = [
  { type: 'ceo', label: 'CEO' },
  { type: 'chief', label: 'Chief' },
  { type: 'department', label: 'Department' },
  { type: 'hod', label: 'HOD' },
  { type: 'job_role', label: 'Role' },
  { type: 'employee', label: 'Staff' },
];

const OrganizationStructure = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [view, setView] = useState('chart');
  const [chartMode, setChartMode] = useState('mixed');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const root = document.querySelector('.content-dashboard');
    root?.classList.add('content-dashboard--organization-structure');
    return () => root?.classList.remove('content-dashboard--organization-structure');
  }, []);

  const { data: chartData, isLoading: loadingChart } = useGetOrgChartQuery(chartMode);
  const { data: headcountData, isLoading: loadingHeadcount } = useGetDepartmentHeadcountQuery();
  const { data: vacancyData, isLoading: loadingVacancy } = useGetVacancyReportQuery();

  const roots = chartData?.data?.roots || [];
  const totalEmployees = chartData?.data?.totalEmployees ?? 0;
  const headcount = headcountData?.data || [];
  const vacancies = vacancyData?.data || [];

  const filteredRoots = useMemo(() => filterTree(roots, search), [roots, search]);
  const visibleCount = useMemo(() => countNodes(filteredRoots), [filteredRoots]);

  const totalDepartments = headcount.length;
  const staffedDepartments = headcount.filter((d) => d.headcount > 0).length;
  const totalOpenVacancies = useMemo(
    () => vacancies.reduce((sum, v) => sum + Number(v.vacancies || 0), 0),
    [vacancies],
  );

  return (
    <div className="org-shell">
      <div className="org-shell-top">
        <div className="org-page-header org-page-header--row">
          <div>
            <h1 className="org-title">Organization structure</h1>
            <p className="org-subtitle">Org chart, department headcount, and vacancy overview.</p>
          </div>
          <button
            type="button"
            className="org-btn org-btn--primary"
            onClick={() => navigate(withCurrentWingSearch('/home/empOrgMaster', location.search))}
          >
            Employee org master data
          </button>
        </div>

        <div className="org-stats">
          <div className="org-stat-card">
            <span className="org-stat-label">Total employees</span>
            <strong className="org-stat-value">{totalEmployees}</strong>
          </div>
          <div className="org-stat-card">
            <span className="org-stat-label">Departments</span>
            <strong className="org-stat-value">{totalDepartments}</strong>
            <span className="org-stat-hint">{staffedDepartments} with staff</span>
          </div>
          <div className="org-stat-card org-stat-card--accent">
            <span className="org-stat-label">Open vacancies</span>
            <strong className="org-stat-value">{totalOpenVacancies}</strong>
            <span className="org-stat-hint">{vacancies.length} role slot{vacancies.length === 1 ? '' : 's'} below max</span>
          </div>
        </div>
      </div>

      <div className="org-panel">
        <div className="org-tabs">
          <button type="button" className={`org-tab ${view === 'chart' ? 'active' : ''}`} onClick={() => setView('chart')}>
            Org chart
          </button>
          <button type="button" className={`org-tab ${view === 'headcount' ? 'active' : ''}`} onClick={() => setView('headcount')}>
            Department headcount
          </button>
          <button type="button" className={`org-tab ${view === 'vacancy' ? 'active' : ''}`} onClick={() => setView('vacancy')}>
            Vacancy report
          </button>
        </div>

        {view === 'chart' && (
          <div className="org-panel-body">
            <div className="org-chart-section">
              <div className="org-chart-controls">
                <div className="org-toolbar">
                  <input
                    type="search"
                    className="org-search"
                    placeholder="Search name, department, role, EMP no…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <div className="org-toolbar-actions org-chart-mode-toggle org-segment">
                    {CHART_MODES.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className={`org-btn ${chartMode === m.id ? 'org-btn--active' : ''}`}
                        onClick={() => setChartMode(m.id)}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="org-chart-meta">
                  {visibleCount} node{visibleCount === 1 ? '' : 's'}
                  {search.trim() ? ` · matching “${search.trim()}”` : ''}
                  {' · '}
                  {chartMode === 'structure' && 'roles and structure only'}
                  {chartMode === 'employees' && 'people and reporting lines'}
                  {chartMode === 'mixed' && 'structure with assigned staff'}
                </p>
              </div>
              <div className="org-chart-wrap org-chart-wrap--tree">
                {loadingChart ? (
                  <p className="org-loading">Loading organization chart…</p>
                ) : filteredRoots.length === 0 ? (
                  <p className="org-empty">
                    {roots.length === 0
                      ? 'No organization data yet. Configure chief roles and assign employees with departments and reporting officers.'
                      : 'No nodes match your search.'}
                  </p>
                ) : (
                  <>
                    <OrgChartViewport
                      printTitle="Organization structure"
                      legend={(
                        <div className="org-chart-legend">
                          {CHART_LEGEND.map((item) => (
                            <span key={item.type} className="org-chart-legend-item">
                              <span className={`org-chart-legend-dot org-chart-legend-dot--${item.type}`} />
                              {item.label}
                            </span>
                          ))}
                        </div>
                      )}
                    >
                      <OrgChartTree roots={filteredRoots} />
                    </OrgChartViewport>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {view === 'headcount' && (
          <div className="org-panel-body">
            {loadingHeadcount ? (
              <p className="org-loading">Loading headcount…</p>
            ) : headcount.length === 0 ? (
              <p className="org-empty">No department data available.</p>
            ) : (
              <>
                <HeadcountReportViz rows={headcount} />
                <h4 className="org-viz-table-title">Department detail</h4>
                <div className="org-table-wrap">
                <table className="org-table">
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th>Code</th>
                      <th>Head of department</th>
                      <th className="org-th-num">Headcount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headcount.map((d) => (
                      <tr key={d.departmentCode || d.wingId} className={d.headcount === 0 ? 'org-row-warn' : ''}>
                        <td><strong>{d.departmentName || '—'}</strong></td>
                        <td><code className="org-code">{d.departmentCode || '—'}</code></td>
                        <td>{d.hodName || <span className="org-muted">Not assigned</span>}</td>
                        <td className="org-td-num">
                          <span className={`org-count-pill ${d.headcount === 0 ? 'org-count-pill--zero' : ''}`}>
                            {d.headcount}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </>
            )}
          </div>
        )}

        {view === 'vacancy' && (
          <div className="org-panel-body">
            {loadingVacancy ? (
              <p className="org-loading">Loading vacancy report…</p>
            ) : vacancies.length === 0 ? (
              <p className="org-empty org-empty--ok">All configured role limits are filled (or no max limits set).</p>
            ) : (
              <>
                <VacancyReportViz rows={vacancies} />
                <h4 className="org-viz-table-title">Vacancy detail</h4>
                <div className="org-table-wrap">
                <table className="org-table">
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th>Job role</th>
                      <th className="org-th-num">Current</th>
                      <th className="org-th-num">Max limit</th>
                      <th className="org-th-num">Open vacancies</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vacancies.map((v) => (
                      <tr key={`${v.departmentCode || v.deptId}-${v.jobRoleId}`}>
                        <td>
                          <strong>{v.departmentName || '—'}</strong>
                          {v.departmentCode ? (
                            <code className="org-code org-code--inline">{v.departmentCode}</code>
                          ) : null}
                        </td>
                        <td>
                          {v.jobRole || '—'}
                          {v.jrCode ? <span className="org-muted"> ({v.jrCode})</span> : null}
                        </td>
                        <td className="org-td-num">{v.currentCount}</td>
                        <td className="org-td-num">{v.maxLimit}</td>
                        <td className="org-td-num">
                          <span className="org-count-pill org-count-pill--vacancy">{v.vacancies}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizationStructure;
