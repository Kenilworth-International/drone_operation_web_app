import React, { useEffect, useMemo, useState } from 'react';
import {
  useGetOrgChartQuery,
  useGetDepartmentHeadcountQuery,
  useGetVacancyReportQuery,
} from '../../api/services NodeJs/employeeProfileApi';
import { useGetEmpJobRolesQuery } from '../../api/services NodeJs/empOrgStructureApi';
import '../../styles/organizationStructure.css';
import OrgChartTree from './employeeProfile/OrgChartTree';
import OrgChartViewport from './employeeProfile/OrgChartViewport';
import { HeadcountReportViz, VacancyReportViz } from './empOrg/OrgStructureReports';
import { useNavigate, useLocation } from 'react-router-dom';
import { withCurrentWingSearch } from '../../config/wingRouteGuard';
import { HrmPageHeader, HrmSubTabs } from './shell/HrmShell';

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

/** Hide posts with nobody assigned (vacant roles / empty HOD cards). */
function pruneUnassignedPosts(nodes) {
  function walk(node) {
    if (!node) return null;

    const walkedChildren = [];
    (node.children || []).forEach((child) => {
      const result = walk(child);
      if (!result) return;
      if (Array.isArray(result)) walkedChildren.push(...result);
      else walkedChildren.push(result);
    });

    // Never list empty job roles
    if (node.nodeType === 'job_role') {
      const empty = Boolean(node.vacant) || Number(node.headcount || 0) === 0;
      if (empty) return null;
    }

    // Vacant HOD: don't show the empty seat — lift children up
    if (node.nodeType === 'hod' && (node.vacant || !node.employeeId)) {
      return walkedChildren.length ? walkedChildren : null;
    }

    // Vacant chief/CEO with no filled children: hide
    if ((node.nodeType === 'chief' || node.nodeType === 'ceo') && node.vacant && walkedChildren.length === 0) {
      return null;
    }

    // Empty department with nothing under it: hide
    if (node.nodeType === 'department' && walkedChildren.length === 0) {
      return null;
    }

    return { ...node, children: walkedChildren, vacant: false };
  }

  const out = [];
  (nodes || []).forEach((node) => {
    const result = walk(node);
    if (!result) return;
    if (Array.isArray(result)) out.push(...result);
    else out.push(result);
  });
  return out;
}

/**
 * Structure mode: stack sibling job roles as a vertical power ladder
 * (highest power on top, one role under the next). Sort staff under each role by power then EMP no.
 */
function chainStructureRolesByPower(nodes, powerByCode = new Map()) {
  const rolePower = (node) => {
    if (node.power != null && node.power !== '') return Number(node.power) || 0;
    const code = String(node.subtitle || '').trim().toLowerCase();
    if (code && powerByCode.has(code)) return Number(powerByCode.get(code)) || 0;
    return 0;
  };

  const byPowerThenEmpNo = (a, b) => {
    const diff = rolePower(b) - rolePower(a);
    if (diff !== 0) return diff;
    return String(a.empNo || '').localeCompare(String(b.empNo || ''), undefined, { numeric: true });
  };

  const sortStaffDeep = (list) => {
    const items = list || [];
    const employees = items.filter((n) => n.nodeType === 'employee');
    const others = items.filter((n) => n.nodeType !== 'employee');
    const walkEmp = (n) => ({
      ...n,
      children: n.children?.length ? sortStaffDeep(n.children) : [],
    });
    const walkOther = (n) => ({
      ...n,
      children: n.children?.length ? sortStaffDeep(n.children) : (n.children || []),
    });
    const sortedEmp = [...employees].sort(byPowerThenEmpNo).map(walkEmp);
    const walkedOthers = others.map(walkOther);
    if (sortedEmp.length && walkedOthers.length) return [...sortedEmp, ...walkedOthers];
    if (sortedEmp.length) return sortedEmp;
    return walkedOthers;
  };

  const chainRoles = (roleNodes) => {
    if (!roleNodes.length) return [];
    const sorted = [...roleNodes].sort((a, b) => {
      const diff = rolePower(b) - rolePower(a);
      if (diff !== 0) return diff;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    if (sorted.length === 1) {
      return sorted.map((n) => ({
        ...n,
        children: sortStaffDeep(
          chainStructureRolesByPower(n.children || [], powerByCode),
        ),
      }));
    }

    const chained = sorted.map((n) => ({
      ...n,
      children: sortStaffDeep(
        chainStructureRolesByPower(n.children || [], powerByCode),
      ),
    }));
    for (let i = 0; i < chained.length - 1; i += 1) {
      const existing = (chained[i].children || []).filter((c) => c.nodeType !== 'job_role');
      chained[i] = { ...chained[i], children: [...existing, chained[i + 1]] };
    }
    return [chained[0]];
  };

  return (nodes || []).map((node) => {
    const children = node.children || [];
    const roleChildren = children.filter((c) => c.nodeType === 'job_role');
    const otherChildren = children.filter((c) => c.nodeType !== 'job_role');

    if (roleChildren.length > 1 && (node.nodeType === 'department' || node.nodeType === 'hod')) {
      return {
        ...node,
        children: [
          ...sortStaffDeep(
            otherChildren.map((c) => chainStructureRolesByPower([c], powerByCode)[0]).filter(Boolean),
          ),
          ...chainRoles(roleChildren),
        ],
      };
    }

    return {
      ...node,
      children: sortStaffDeep(
        children.flatMap((c) => chainStructureRolesByPower([c], powerByCode)),
      ),
    };
  });
}

/** Collect every employee node under a subtree (flattens role wrappers). */
function collectEmployeeNodes(node, into = []) {
  if (!node) return into;
  if (node.nodeType === 'employee' || (node.nodeType === 'hod' && node.employeeId)) {
    into.push({
      ...node,
      nodeType: 'employee',
      id: `emp-${node.employeeId || node.id}`,
      children: [],
      subtitle: null,
    });
  }
  (node.children || []).forEach((child) => collectEmployeeNodes(child, into));
  return into;
}

/**
 * Employees mode: under each department, reporting-officer tree of names only (no role boxes).
 */
function toEmployeesReportingView(nodes) {
  const rebuildForestFromOriginal = (originalChildren) => {
    const flat = [];
    (originalChildren || []).forEach((c) => collectEmployeeNodes(c, flat));
    // De-dupe by employeeId
    const unique = [];
    const seen = new Set();
    flat.forEach((n) => {
      const id = Number(n.employeeId || String(n.id || '').replace(/^emp-/, ''));
      if (!Number.isFinite(id) || seen.has(id)) return;
      seen.add(id);
      unique.push({ ...n, employeeId: id, id: `emp-${id}` });
    });
    if (!unique.length) return [];

    const parentOf = new Map();
    const walk = (list, parentEmpId = null) => {
      (list || []).forEach((n) => {
        // Role / HOD wrappers are not reporting parents — only employee→employee links.
        if (n.nodeType === 'job_role' || n.nodeType === 'hod') {
          walk(n.children, null);
          return;
        }
        if (n.nodeType === 'employee') {
          const id = Number(n.employeeId || String(n.id || '').replace(/^emp-/, ''));
          if (parentEmpId != null && Number.isFinite(id)) parentOf.set(id, parentEmpId);
          walk(n.children, id);
          return;
        }
        walk(n.children, parentEmpId);
      });
    };
    walk(originalChildren);

    const byId = new Map();
    unique.forEach((n) => {
      byId.set(n.employeeId, {
        ...n,
        nodeType: 'employee',
        subtitle: null,
        children: [],
      });
    });

    const roots = [];
    byId.forEach((node, id) => {
      const mgrId = node.reportingOfficerId != null && node.reportingOfficerId !== ''
        ? Number(node.reportingOfficerId)
        : parentOf.get(id);
      if (mgrId && byId.has(mgrId) && mgrId !== id) {
        byId.get(mgrId).children.push(node);
      } else {
        roots.push(node);
      }
    });

    const byPowerThenEmpNo = (a, b) => {
      const diff = Number(b.power || 0) - Number(a.power || 0);
      if (diff !== 0) return diff;
      return String(a.empNo || '').localeCompare(String(b.empNo || ''), undefined, { numeric: true });
    };
    const sortTree = (list) => {
      list.sort(byPowerThenEmpNo);
      list.forEach((n) => {
        if (n.children?.length) sortTree(n.children);
      });
    };
    sortTree(roots);
    return roots;
  };

  return (nodes || []).map((node) => {
    const children = node.children || [];
    if (node.nodeType === 'department') {
      return {
        ...node,
        children: rebuildForestFromOriginal(children),
      };
    }
    return {
      ...node,
      children: toEmployeesReportingView(children),
    };
  });
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
  { id: 'employees', label: 'Employees' },
  { id: 'mixed', label: 'Mixed' },
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
  const [chartMode, setChartMode] = useState('structure');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const root = document.querySelector('.content-dashboard');
    root?.classList.add('content-dashboard--organization-structure');
    return () => root?.classList.remove('content-dashboard--organization-structure');
  }, []);

  const { data: chartData, isLoading: loadingChart } = useGetOrgChartQuery(chartMode);
  const { data: jobRolesData } = useGetEmpJobRolesQuery();
  const { data: headcountData, isLoading: loadingHeadcount } = useGetDepartmentHeadcountQuery();
  const { data: vacancyData, isLoading: loadingVacancy } = useGetVacancyReportQuery();

  const powerByCode = useMemo(() => {
    const map = new Map();
    const roles = Array.isArray(jobRolesData) ? jobRolesData : (jobRolesData?.data || []);
    roles.forEach((r) => {
      const code = String(r.jr_code || '').trim().toLowerCase();
      if (code) map.set(code, Number(r.power || 0));
    });
    return map;
  }, [jobRolesData]);

  const roots = useMemo(() => {
    const pruned = pruneUnassignedPosts(chartData?.data?.roots || []);
    if (chartMode === 'employees') return toEmployeesReportingView(pruned);
    if (chartMode === 'structure') return chainStructureRolesByPower(pruned, powerByCode);
    return pruned;
  }, [chartData, chartMode, powerByCode]);
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

  const ORG_TABS = [
    { key: 'chart', label: 'Org Chart' },
    { key: 'headcount', label: 'Department Headcount' },
    { key: 'vacancy', label: 'Vacancy Report' },
  ];

  return (
    <div className="org-shell">
      <HrmPageHeader
        title="Organization Structure"
        hint="Org chart, department headcount, and vacancy overview."
        actions={
          <button
            type="button"
            className="org-btn org-btn--secondary"
            onClick={() => navigate(withCurrentWingSearch('/home/empOrgMaster', location.search))}
          >
            Org Master Data
          </button>
        }
      />

      <div className="org-shell-top">
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

      <HrmSubTabs tabs={ORG_TABS} active={view} onChange={setView} />

      <div className="org-panel">

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
                  {chartMode === 'structure' && 'below department: roles by power, one under another'}
                  {chartMode === 'employees' && 'below department: reporting lines (names only)'}
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
                          {(chartMode === 'employees'
                            ? CHART_LEGEND.filter((item) => item.type !== 'job_role' && item.type !== 'hod')
                            : CHART_LEGEND
                          ).map((item) => (
                            <span key={item.type} className="org-chart-legend-item">
                              <span className={`org-chart-legend-dot org-chart-legend-dot--${item.type}`} />
                              {item.type === 'employee' && chartMode === 'employees' ? 'Person' : item.label}
                            </span>
                          ))}
                        </div>
                      )}
                    >
                      <OrgChartTree
                        roots={filteredRoots}
                        stackBelowDepartment={chartMode === 'structure' || chartMode === 'employees'}
                        nameOnlyPeople={chartMode === 'employees'}
                      />
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
