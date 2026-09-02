import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { hrSupportRequest } from '../api/hrSupportApi';

function flattenOrgNodes(nodes = [], depth = 0, out = []) {
  for (const node of nodes) {
    out.push({ ...node, depth });
    if (node.children?.length) flattenOrgNodes(node.children, depth + 1, out);
  }
  return out;
}

export default function HrAdminTab({ token, refreshing, refresh }) {
  const [segment, setSegment] = useState('organization');
  const [loading, setLoading] = useState(false);
  const [orgSummary, setOrgSummary] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  const loadOrganization = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await hrSupportRequest('/api/hr/organization/summary', token, { method: 'POST', body: JSON.stringify({ view: 'structure' }) });
      setOrgSummary(data || null);
    } catch (err) {
      setError(err?.message || 'Failed to load organization data.');
      setOrgSummary(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadEmployees = useCallback(async (q = '') => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await hrSupportRequest('/api/hr/employees/list', token, { method: 'POST', body: JSON.stringify({ search: q }) });
      setEmployees(Array.isArray(data) ? data : (data?.employees || data?.list || []));
    } catch (err) {
      setError(err?.message || 'Failed to load employees.');
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (segment === 'organization') loadOrganization();
    else loadEmployees(search);
  }, [segment, loadOrganization, loadEmployees, search]);

  useEffect(() => {
    if (refreshing) {
      if (segment === 'organization') loadOrganization();
      else loadEmployees(search);
    }
  }, [refreshing]);

  const viewEmployee = async (emp) => {
    if (!token || !emp?.id) return;
    setDetailLoading(true);
    setSelectedEmployee(emp);
    try {
      const detail = await hrSupportRequest('/api/hr/employees/view', token, { method: 'POST', body: JSON.stringify({ employeeId: emp.id }) });
      setSelectedEmployee(detail || emp);
    } catch {
      // keep basic emp
    } finally {
      setDetailLoading(false);
    }
  };

  const orgFlat = useMemo(() => flattenOrgNodes(orgSummary?.roots || []).slice(0, 60), [orgSummary]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  if (selectedEmployee) {
    const emp = selectedEmployee;
    return (
      <div>
        <button type="button" className="hrsup-btn hrsup-btn--secondary hrsup-btn--sm" style={{ marginBottom: 12 }} onClick={() => setSelectedEmployee(null)}>← Back</button>
        {detailLoading ? (
          <div className="hrsup-loading">Loading…</div>
        ) : (
          <div className="hrsup-card">
            <div className="hrsup-profile-header" style={{ marginBottom: 12 }}>
              <div className="hrsup-profile-avatar">{(emp.employeeName || emp.name || '?').charAt(0).toUpperCase()}</div>
              <div>
                <p className="hrsup-profile-name">{emp.employeeName || emp.name}</p>
                <p className="hrsup-profile-role">{emp.designation || emp.jobRole || '—'}</p>
              </div>
            </div>
            {[
              ['Employee No', emp.employeeNo || emp.employee_no],
              ['Department', emp.department],
              ['Email', emp.email],
              ['Mobile', emp.mobile],
              ['Status', emp.status],
              ['Branch', emp.branch],
              ['Joined', emp.joinedDate && new Date(emp.joinedDate).toLocaleDateString()],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="hrsup-dl-row"><span className="hrsup-dl-label">{k}</span><span className="hrsup-dl-value">{v}</span></div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="hrsup-segments" style={{ marginBottom: 0 }}>
          <button type="button" className={`hrsup-segment-btn${segment === 'organization' ? ' hrsup-segment-btn--active' : ''}`} onClick={() => setSegment('organization')}>Organization</button>
          <button type="button" className={`hrsup-segment-btn${segment === 'employees' ? ' hrsup-segment-btn--active' : ''}`} onClick={() => setSegment('employees')}>Employees</button>
        </div>
        <button type="button" className="hrsup-refresh-btn" onClick={refresh} disabled={refreshing}><span className={refreshing ? 'hrsup-spin' : ''}>↻</span></button>
      </div>

      {error && <div className="hrsup-error-box">{error} <button type="button" className="hrsup-error-dismiss" onClick={() => setError('')}>✕</button></div>}

      {segment === 'organization' && (
        <>
          {loading ? (
            <div className="hrsup-loading">Loading organization…</div>
          ) : orgFlat.length === 0 ? (
            <p className="hrsup-empty">No organization data found.</p>
          ) : (
            orgFlat.map((node, idx) => (
              <div key={idx} className="hrsup-org-node" style={{ marginLeft: Math.min(node.depth * 16, 64) }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                  {(node.name || node.employeeName || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="hrsup-org-node-name">{node.name || node.employeeName}</div>
                  <div className="hrsup-org-node-role">{node.role || node.designation || node.jobRole || '—'}{node.department ? ` · ${node.department}` : ''}</div>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {segment === 'employees' && (
        <>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input type="text" className="hrsup-input" placeholder="Search by name or employee no…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} style={{ flex: 1 }} />
            <button type="submit" className="hrsup-btn hrsup-btn--primary">Search</button>
          </form>
          {loading ? (
            <div className="hrsup-loading">Loading…</div>
          ) : employees.length === 0 ? (
            <p className="hrsup-empty">No employees found.</p>
          ) : (
            employees.map((emp) => (
              <div key={emp.id || emp.employeeId} className="hrsup-card" style={{ cursor: 'pointer' }} onClick={() => viewEmployee(emp)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && viewEmployee(emp)}>
                <div className="hrsup-card-head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                      {(emp.employeeName || emp.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="hrsup-list-title">{emp.employeeName || emp.name}</div>
                      <div className="hrsup-list-meta">{emp.employeeNo || emp.employee_no || '—'} · {emp.department || '—'}</div>
                    </div>
                  </div>
                  <span className={`hrsup-badge ${emp.status === 'active' ? 'hrsup-badge--green' : 'hrsup-badge--gray'}`}>{emp.status || '—'}</span>
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
