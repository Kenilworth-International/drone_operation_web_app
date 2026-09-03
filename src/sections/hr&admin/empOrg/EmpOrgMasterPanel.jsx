import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  useGetEmpDepartmentsQuery,
  useSaveEmpDepartmentMutation,
  useGetEmpSubDivisionsQuery,
  useSaveEmpSubDivisionMutation,
  useGetEmpManagementLayersQuery,
  useGetEmpJobRolesQuery,
  useSaveEmpJobRoleMutation,
  useGetEmpSpecializationsQuery,
  useSaveEmpSpecializationMutation,
  usePreviewEmpSpecializationMutation,
  useGetEmpDesignationsQuery,
  useGetEmpRoleMaxLimitsQuery,
  useSaveEmpRoleMaxLimitMutation,
} from '../../../api/services NodeJs/empOrgStructureApi';
import { useGetAllEmployeeRegistrationsQuery } from '../../../api/services NodeJs/jdManagementApi';
import ChiefJobRoleTab from './ChiefJobRoleTab';
import HodAssignmentTab from './HodAssignmentTab';
import {
  clampPowerToLayer,
  findLayerById,
  getLayerPowerBounds,
  isPowerInLayerRange,
  layerPowerHint,
} from './empOrgLayerPower';

const TABS = [
  { id: 'departments', label: 'Departments' },
  { id: 'subDivisions', label: 'Sub-divisions' },
  { id: 'roles', label: 'Job roles' },
  { id: 'chiefs', label: 'Chief job roles' },
  { id: 'hods', label: 'HOD assignments' },
  { id: 'limits', label: 'Max limits' },
  { id: 'specs', label: 'Specializations' },
  { id: 'designations', label: 'Designations' },
];

const EMPTY = {
  dept: { dept_code: '', department_name: '', hod_employee_id: '', sort_order: 0, activated: 1 },
  sub: { sub_division_name: '', sub_div_code: '', sort_order: 0, activated: 1 },
  role: { dept_id: '', jr_code: '', job_role: '', mgt_layer_id: '', power: 0, sort_order: 0, activated: 1 },
  spec: { dept_id: '', job_role_id: '', specialization: '', activated: 1 },
  limit: { max_limit: 0 },
};

function Msg({ text, type }) {
  if (!text) return null;
  return <p className={`emp-org-msg emp-org-msg--${type}`}>{text}</p>;
}

function Modal({ title, onClose, onSubmit, submitLabel, children, submitting }) {
  return (
    <div className="emp-org-modal-overlay" onClick={onClose} role="presentation">
      <div className="emp-org-modal" onClick={(e) => e.stopPropagation()}>
        <div className="emp-org-modal-header">
          <h4>{title}</h4>
          <button type="button" className="emp-org-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="emp-org-modal-body">{children}</div>
          <div className="emp-org-modal-footer">
            <button type="button" className="emp-org-btn emp-org-btn--secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="emp-org-btn" disabled={submitting}>
              {submitting ? 'Saving…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="emp-org-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ActiveCheckbox({ value, onChange }) {
  return (
    <label className="emp-org-check">
      <input
        type="checkbox"
        checked={Number(value) === 1}
        onChange={(e) => onChange(e.target.checked ? 1 : 0)}
      />
      Active
    </label>
  );
}

function CodeField({ label, value, onChange, readOnly, required = true, placeholder }) {
  return (
    <Field label={label}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.toLowerCase().replace(/\s+/g, ''))}
        readOnly={readOnly}
        required={required && !readOnly}
        placeholder={placeholder}
        style={readOnly ? { background: '#f5f5f5', cursor: 'not-allowed' } : undefined}
      />
      {readOnly ? (
        <span className="emp-org-field-hint">Code cannot be changed after creation.</span>
      ) : (
        <span className="emp-org-field-hint">Unique code; cannot be changed after saving.</span>
      )}
    </Field>
  );
}

function resolveDeptIdFromWing(departments, search) {
  const wing = new URLSearchParams(search).get('wing');
  if (!wing) return '';
  const norm = wing.trim().toLowerCase();
  const match = departments.find((d) => {
    const name = (d.department_name || '').toLowerCase();
    const short = name.replace(/\s+wing$/, '').trim();
    return name === norm || name.includes(norm) || norm.includes(short) || short.includes(norm);
  });
  return match ? String(match.id) : '';
}

export default function EmpOrgMasterPanel() {
  const location = useLocation();
  const [tab, setTab] = useState('departments');
  const [chiefTabRefresh, setChiefTabRefresh] = useState(0);
  const [hodTabRefresh, setHodTabRefresh] = useState(0);
  const [msg, setMsg] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [specPreview, setSpecPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [desSearch, setDesSearch] = useState('');

  const [selectedSubDeptId, setSelectedSubDeptId] = useState('');
  const [selectedRoleDeptId, setSelectedRoleDeptId] = useState('');
  const [showAllRoles, setShowAllRoles] = useState(false);
  const [selectedLimitDeptId, setSelectedLimitDeptId] = useState('');

  const { data: departments = [], refetch: refetchDepts } = useGetEmpDepartmentsQuery();
  const { data: employeesData } = useGetAllEmployeeRegistrationsQuery();
  const employees = useMemo(() => {
    if (!employeesData) return [];
    if (Array.isArray(employeesData)) return employeesData;
    if (Array.isArray(employeesData.data)) return employeesData.data;
    return [];
  }, [employeesData]);
  const employeeNameById = useMemo(() => {
    const map = new Map();
    employees.forEach((emp) => {
      map.set(Number(emp.id), emp.employeeName || emp.preferredName || emp.empNo || `Employee ${emp.id}`);
    });
    return map;
  }, [employees]);
  const { data: layers = [], refetch: refetchLayers } = useGetEmpManagementLayersQuery();
  const { data: jobRoles = [], refetch: refetchRoles } = useGetEmpJobRolesQuery();
  const { data: designations = [], refetch: refetchDes } = useGetEmpDesignationsQuery({});
  const { data: specializations = [], refetch: refetchSpecs } = useGetEmpSpecializationsQuery({});
  const { data: subDivisions = [], refetch: refetchSubs } = useGetEmpSubDivisionsQuery(
    selectedSubDeptId ? { dept_id: Number(selectedSubDeptId) } : undefined,
    { skip: !selectedSubDeptId },
  );
  const { data: roleMaxLimits = [], refetch: refetchLimits } = useGetEmpRoleMaxLimitsQuery(
    selectedLimitDeptId ? Number(selectedLimitDeptId) : undefined,
    { skip: !selectedLimitDeptId },
  );

  useEffect(() => {
    if (!departments.length) return;
    const fromWing = resolveDeptIdFromWing(departments, location.search);
    if (fromWing) {
      setSelectedRoleDeptId((prev) => prev || fromWing);
      setSelectedLimitDeptId((prev) => prev || fromWing);
      setSelectedSubDeptId((prev) => prev || fromWing);
    }
  }, [departments, location.search]);

  const [saveDept] = useSaveEmpDepartmentMutation();
  const [saveSub] = useSaveEmpSubDivisionMutation();
  const [saveRole] = useSaveEmpJobRoleMutation();
  const [saveSpec] = useSaveEmpSpecializationMutation();
  const [saveRoleMaxLimit] = useSaveEmpRoleMaxLimitMutation();
  const [previewSpec] = usePreviewEmpSpecializationMutation();

  const nonChiefJobRoles = useMemo(
    () => jobRoles.filter((r) => Number(r.chief) !== 1),
    [jobRoles],
  );

  const jobRolesForDept = useMemo(() => {
    if (!form.dept_id) return nonChiefJobRoles;
    const deptNum = Number(form.dept_id);
    return nonChiefJobRoles.filter((r) => (r.dept_ids || []).includes(deptNum));
  }, [nonChiefJobRoles, form.dept_id]);

  const rolesForSelectedDept = useMemo(() => {
    if (!selectedRoleDeptId) return [];
    const deptNum = Number(selectedRoleDeptId);
    return nonChiefJobRoles.filter((r) => (r.dept_ids || []).includes(deptNum));
  }, [nonChiefJobRoles, selectedRoleDeptId]);

  const roleCatalogRows = useMemo(
    () => [...nonChiefJobRoles].sort((a, b) => {
      const powerDiff = Number(b.power || 0) - Number(a.power || 0);
      if (powerDiff !== 0) return powerDiff;
      return (a.job_role || '').localeCompare(b.job_role || '');
    }),
    [nonChiefJobRoles],
  );

  const selectedRoleDeptName = useMemo(
    () => departments.find((d) => String(d.id) === String(selectedRoleDeptId))?.department_name || '',
    [departments, selectedRoleDeptId],
  );

  const selectedRoleLayer = useMemo(
    () => findLayerById(layers, form.mgt_layer_id),
    [layers, form.mgt_layer_id],
  );

  const selectedRolePowerBounds = useMemo(
    () => getLayerPowerBounds(selectedRoleLayer),
    [selectedRoleLayer],
  );

  const filteredDesignations = useMemo(() => {
    const q = desSearch.trim().toLowerCase();
    if (!q) return designations;
    return designations.filter((d) =>
      String(d.designation_title || '').toLowerCase().includes(q)
      || String(d.des_code || '').toLowerCase().includes(q)
      || String(d.dept_code || '').toLowerCase().includes(q)
    );
  }, [designations, desSearch]);

  const notify = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  };

  const handleTabClick = (tabId) => {
    setTab(tabId);
    switch (tabId) {
      case 'departments':
        refetchDepts();
        break;
      case 'subDivisions':
        refetchDepts();
        if (selectedSubDeptId) refetchSubs();
        break;
      case 'roles':
        refetchDepts();
        refetchRoles();
        refetchLayers();
        break;
      case 'chiefs':
        setChiefTabRefresh((n) => n + 1);
        break;
      case 'hods':
        setHodTabRefresh((n) => n + 1);
        refetchDepts();
        break;
      case 'limits':
        refetchDepts();
        refetchRoles();
        if (selectedLimitDeptId) refetchLimits();
        break;
      case 'specs':
        refetchDepts();
        refetchRoles();
        refetchSpecs();
        break;
      case 'designations':
        refetchDes();
        break;
      default:
        break;
    }
  };

  const openAdd = (type) => {
    setSpecPreview(null);
    if (type === 'sub' && !selectedSubDeptId) return notify('Select a department first.', 'error');
    if (type === 'role' && !selectedRoleDeptId) return notify('Select a department first.', 'error');
    const base = { ...EMPTY[type] };
    if (type === 'role') base.dept_id = selectedRoleDeptId;
    setForm(base);
    setModal({ type, mode: 'add' });
  };

  const openEdit = (type, row) => {
    setSpecPreview(null);
    if (type === 'dept') {
      setForm({
        id: row.id,
        dept_code: row.dept_code || '',
        department_name: row.department_name || '',
        hod_employee_id: row.hod_employee_id ? String(row.hod_employee_id) : '',
        sort_order: row.sort_order ?? 0,
        activated: row.activated ?? 1,
      });
    } else if (type === 'sub') {
      setForm({
        id: row.id,
        sub_division_name: row.sub_division_name || '',
        sub_div_code: row.sub_div_code || '',
        sort_order: row.sort_order ?? 0,
        activated: row.activated ?? 1,
      });
    } else if (type === 'role') {
      setForm({
        id: row.id,
        dept_id: row.dept_ids?.[0] ? String(row.dept_ids[0]) : '',
        jr_code: row.jr_code || '',
        job_role: row.job_role || '',
        mgt_layer_id: row.mgt_layer_id ? String(row.mgt_layer_id) : '',
        power: row.power ?? 0,
        sort_order: row.sort_order ?? 0,
        activated: row.activated ?? 1,
      });
    } else if (type === 'spec') {
      setForm({
        id: row.id,
        dept_id: String(row.dept_id || ''),
        job_role_id: String(row.job_role_id || ''),
        specialization: row.specialization || '',
        spe_code: row.spe_code || '',
        activated: row.activated ?? 1,
      });
    } else if (type === 'limit') {
      setForm({
        dept_id: selectedLimitDeptId,
        job_role_id: row.job_role_id,
        job_role_label: row.job_role,
        max_limit: row.max_limit != null ? row.max_limit : 0,
      });
    }
    setModal({ type, mode: 'edit' });
  };

  const openEditLimit = (row) => openEdit('limit', row);

  const closeModal = () => {
    setModal(null);
    setForm({});
    setSpecPreview(null);
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (modal.type === 'dept') {
        await saveDept({
          ...form,
          hod_employee_id: form.hod_employee_id ? Number(form.hod_employee_id) : null,
        }).unwrap();
        refetchDepts();
        refetchDes();
      } else if (modal.type === 'sub') {
        await saveSub({ ...form, dept_id: Number(selectedSubDeptId) }).unwrap();
        refetchSubs();
      } else if (modal.type === 'role') {
        const layer = findLayerById(layers, form.mgt_layer_id);
        if (!layer) {
          notify('Select a management layer.', 'error');
          setSaving(false);
          return;
        }
        if (!isPowerInLayerRange(form.power, layer)) {
          notify(layerPowerHint(layer) || 'Power is outside the allowed range for this layer.', 'error');
          setSaving(false);
          return;
        }
        await saveRole({
          ...form,
          dept_id: form.dept_id ? Number(form.dept_id) : undefined,
          mgt_layer_id: Number(form.mgt_layer_id),
          power: Number(form.power),
          sort_order: form.sort_order === '' || form.sort_order == null
            ? 0
            : Number(form.sort_order),
        }).unwrap();
        refetchRoles();
        refetchDes();
      } else if (modal.type === 'spec') {
        await saveSpec({
          ...form,
          dept_id: Number(form.dept_id),
          job_role_id: Number(form.job_role_id),
        }).unwrap();
        refetchSpecs();
        refetchDes();
      } else if (modal.type === 'limit') {
        await saveRoleMaxLimit({
          dept_id: Number(form.dept_id),
          job_role_id: Number(form.job_role_id),
          max_limit: Number(form.max_limit),
        }).unwrap();
        refetchLimits();
      }
      notify(modal.mode === 'edit' ? 'Updated successfully.' : 'Added successfully.');
      closeModal();
    } catch (err) {
      notify(err?.data?.message || 'Save failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSpecPreview = async () => {
    if (!form.dept_id || !form.job_role_id || !form.specialization) return;
    try {
      const res = await previewSpec({
        dept_id: Number(form.dept_id),
        job_role_id: Number(form.job_role_id),
        specialization: form.specialization,
      }).unwrap();
      setSpecPreview(res);
    } catch (err) {
      notify(err?.data?.message || 'Preview failed.', 'error');
    }
  };

  const panelActions = (type, addLabel) => (
    <div className="emp-org-panel-toolbar">
      <button type="button" className="emp-org-btn" onClick={() => openAdd(type)}>{addLabel}</button>
    </div>
  );

  const editBtn = (type, row) => (
    <button type="button" className="emp-org-link-btn" onClick={() => openEdit(type, row)}>Edit</button>
  );

  return (
    <section className="emp-org-master">
      <div className="emp-org-master-top">
        <div className="emp-org-master-header">
          <div>
            <h3 className="emp-org-master-title">Employee org master data</h3>
            <p className="emp-org-master-sub">Manage departments, HOD assignments, sub-divisions, roles, chief roles, specializations, and auto-generated designations.</p>
          </div>
        </div>
        <Msg text={msg?.text} type={msg?.type} />

        <div className="emp-org-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`emp-org-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => handleTabClick(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="emp-org-master-body">
      {tab === 'departments' && (
        <div className="emp-org-panel">
          {panelActions('dept', '+ Add department')}
          <table className="emp-org-table">
            <thead><tr><th>Code</th><th>Name</th><th>HOD</th><th>Sort</th><th>Active</th><th /></tr></thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id}>
                  <td>{d.dept_code}</td>
                  <td>{d.department_name}</td>
                  <td>{d.hod_employee_id ? (employeeNameById.get(Number(d.hod_employee_id)) || d.hod_employee_id) : '—'}</td>
                  <td>{d.sort_order}</td>
                  <td>{Number(d.activated) === 1 ? 'Yes' : 'No'}</td>
                  <td>{editBtn('dept', d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'subDivisions' && (
        <div className="emp-org-panel">
          <p className="emp-org-hint">
            Sub-divisions sit directly under a department. They appear in employee registration when assigning department placement.
          </p>
          <div className="emp-org-toolbar">
            <div className="emp-org-row">
              <select
                className="emp-org-dept-select"
                value={selectedSubDeptId}
                onChange={(e) => setSelectedSubDeptId(e.target.value)}
              >
                <option value="">Select department…</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.department_name}</option>
                ))}
              </select>
              <button
                type="button"
                className="emp-org-btn"
                onClick={() => openAdd('sub')}
                disabled={!selectedSubDeptId}
              >
                + Add sub-division
              </button>
            </div>
          </div>
          {selectedSubDeptId ? (
            <table className="emp-org-table">
              <thead><tr><th>Sub-division</th><th>Code</th><th>Sort</th><th>Active</th><th /></tr></thead>
              <tbody>
                {subDivisions.length === 0 ? (
                  <tr><td colSpan={5} className="emp-org-empty-cell">No sub-divisions yet. Click “Add sub-division”.</td></tr>
                ) : subDivisions.map((s) => (
                  <tr key={s.id}>
                    <td>{s.sub_division_name}</td>
                    <td>{s.sub_div_code || '—'}</td>
                    <td>{s.sort_order}</td>
                    <td>{Number(s.activated) === 1 ? 'Yes' : 'No'}</td>
                    <td>{editBtn('sub', s)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="emp-org-hint">Select a department to view and manage its sub-divisions.</p>
          )}
        </div>
      )}

      {tab === 'roles' && (
        <div className="emp-org-panel">
          <p className="emp-org-hint">
            Shared role catalog (hod, manager, executive, etc.) linked per department.
            Select a wing to see its roles — not every role is listed under every department in one row.
            Chief roles are under Chief job roles.
          </p>
          <div className="emp-org-toolbar">
            <div className="emp-org-row">
              <select
                className="emp-org-dept-select"
                value={selectedRoleDeptId}
                onChange={(e) => {
                  setSelectedRoleDeptId(e.target.value);
                  setShowAllRoles(false);
                }}
              >
                <option value="">Select department</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.department_name}</option>)}
              </select>
              <button
                type="button"
                className={`emp-org-btn emp-org-btn--secondary${showAllRoles ? ' emp-org-btn--active' : ''}`}
                onClick={() => {
                  setShowAllRoles(true);
                  setSelectedRoleDeptId('');
                }}
              >
                Show all
              </button>
            </div>
            {selectedRoleDeptId ? (
              <button type="button" className="emp-org-btn" onClick={() => openAdd('role')}>+ Add job role</button>
            ) : null}
          </div>
          {showAllRoles ? (
            <>
              <p className="emp-org-hint emp-org-hint--inline">
                <strong>All job roles</strong>
                {' · '}
                {roleCatalogRows.length} role{roleCatalogRows.length === 1 ? '' : 's'}
                {' · linked across departments'}
              </p>
              <table className="emp-org-table">
                <thead><tr><th>Code</th><th>Role</th><th>Layer</th><th>Power</th><th>Wings</th><th>Active</th><th /></tr></thead>
                <tbody>
                  {roleCatalogRows.length === 0 ? (
                    <tr><td colSpan={7} className="emp-org-empty-cell">No job roles yet.</td></tr>
                  ) : roleCatalogRows.map((r) => (
                    <tr key={r.id}>
                      <td><code className="org-code">{r.jr_code}</code></td>
                      <td>{r.job_role}</td>
                      <td>{r.layer_name || '—'}</td>
                      <td>{r.power}</td>
                      <td>{(r.dept_ids || []).length || '—'}</td>
                      <td>{Number(r.activated) === 1 ? 'Yes' : 'No'}</td>
                      <td>{editBtn('role', r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : selectedRoleDeptId ? (
            <>
              <p className="emp-org-hint emp-org-hint--inline">
                <strong>{selectedRoleDeptName}</strong>
                {' · '}
                {rolesForSelectedDept.length} role{rolesForSelectedDept.length === 1 ? '' : 's'}
              </p>
              <table className="emp-org-table">
                <thead><tr><th>Code</th><th>Role</th><th>Layer</th><th>Power</th><th>Active</th><th /></tr></thead>
                <tbody>
                  {rolesForSelectedDept.length === 0 ? (
                    <tr><td colSpan={6} className="emp-org-empty-cell">No job roles linked to this department yet.</td></tr>
                  ) : rolesForSelectedDept.map((r) => (
                    <tr key={r.id}>
                      <td><code className="org-code">{r.jr_code}</code></td>
                      <td>{r.job_role}</td>
                      <td>{r.layer_name || '—'}</td>
                      <td>{r.power}</td>
                      <td>{Number(r.activated) === 1 ? 'Yes' : 'No'}</td>
                      <td>{editBtn('role', r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="emp-org-hint">Select a department or click Show all to view job roles.</p>
          )}
        </div>
      )}

      {tab === 'chiefs' && <ChiefJobRoleTab notify={notify} refreshToken={chiefTabRefresh} />}
      {tab === 'hods' && <HodAssignmentTab notify={notify} refreshToken={hodTabRefresh} />}

      {tab === 'limits' && (
        <div className="emp-org-panel">
          <p className="emp-org-hint">Set maximum allowed headcount per job role in each department. Chief roles are excluded.</p>
          <div className="emp-org-row">
            <select className="emp-org-dept-select" value={selectedLimitDeptId} onChange={(e) => setSelectedLimitDeptId(e.target.value)}>
              <option value="">Select department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.department_name}</option>)}
            </select>
          </div>
          {selectedLimitDeptId ? (
            <table className="emp-org-table">
              <thead>
                <tr>
                  <th>Job role</th>
                  <th>Code</th>
                  <th>Current</th>
                  <th>Max limit</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {roleMaxLimits.map((row) => {
                  const current = Number(row.current_count || 0);
                  const max = row.max_limit != null ? Number(row.max_limit) : null;
                  const over = max != null && current > max;
                  const atCap = max != null && current === max;
                  return (
                    <tr key={row.job_role_id} className={over ? 'emp-org-row-over' : ''}>
                      <td>{row.job_role}</td>
                      <td>{row.jr_code}</td>
                      <td>{current}</td>
                      <td>{max != null ? max : '—'}</td>
                      <td>
                        {max == null ? 'Not set' : over ? 'Over limit' : atCap ? 'At limit' : 'OK'}
                      </td>
                      <td>
                        <button type="button" className="emp-org-link-btn" onClick={() => openEditLimit(row)}>
                          {max != null ? 'Edit' : 'Set'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="emp-org-hint">Select a department to view and edit role max limits.</p>
          )}
        </div>
      )}

      {tab === 'specs' && (
        <div className="emp-org-panel">
          {panelActions('spec', '+ Add specialization')}
          <table className="emp-org-table">
            <thead><tr><th>Code</th><th>Dept</th><th>Role</th><th>Specialization</th><th>Active</th><th /></tr></thead>
            <tbody>
              {specializations.map((s) => (
                <tr key={s.id}>
                  <td>{s.spe_code}</td>
                  <td>{s.department_name}</td>
                  <td>{s.job_role}</td>
                  <td>{s.specialization}</td>
                  <td>{Number(s.activated) === 1 ? 'Yes' : 'No'}</td>
                  <td>{editBtn('spec', s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'designations' && (
        <div className="emp-org-panel">
          <input
            className="emp-org-search"
            placeholder="Search designations…"
            value={desSearch}
            onChange={(e) => setDesSearch(e.target.value)}
          />
          <p className="emp-org-hint">
            {filteredDesignations.length} designation(s) — read-only list, auto-updated when you save departments, job roles, or specializations.
          </p>
          <table className="emp-org-table emp-org-table--scroll">
            <thead><tr><th>Title</th><th>Code</th><th>Power</th><th>Active</th></tr></thead>
            <tbody>
              {filteredDesignations.map((d) => (
                <tr key={d.id}>
                  <td>{d.designation_title}</td>
                  <td>{d.des_code}</td>
                  <td>{d.power}</td>
                  <td>{Number(d.activated) === 1 ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      </div>

      {modal?.type === 'dept' && (
        <Modal
          title={modal.mode === 'edit' ? 'Edit department' : 'Add department'}
          onClose={closeModal}
          onSubmit={handleModalSubmit}
          submitLabel={modal.mode === 'edit' ? 'Update' : 'Add'}
          submitting={saving}
        >
          <CodeField
            label="Code *"
            value={form.dept_code}
            onChange={(v) => setForm({ ...form, dept_code: v })}
            readOnly={modal.mode === 'edit'}
            placeholder="e.g. ictw"
          />
          <Field label="Department name *">
            <input value={form.department_name} onChange={(e) => setForm({ ...form, department_name: e.target.value })} required />
          </Field>
          <Field label="Head of Department (HOD)">
            <select
              value={form.hod_employee_id || ''}
              onChange={(e) => setForm({ ...form, hod_employee_id: e.target.value })}
            >
              <option value="">Not set</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employeeName || emp.preferredName || emp.empNo || `Employee ${emp.id}`}
                </option>
              ))}
            </select>
            <span className="emp-org-field-hint">The department head may also be set as reporting officer for employees (including themselves when they are the top approver).</span>
          </Field>
          <Field label="Sort order">
            <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
          </Field>
          <ActiveCheckbox value={form.activated} onChange={(v) => setForm({ ...form, activated: v })} />
        </Modal>
      )}

      {modal?.type === 'sub' && (
        <Modal
          title={modal.mode === 'edit' ? 'Edit sub-division' : 'Add sub-division'}
          onClose={closeModal}
          onSubmit={handleModalSubmit}
          submitLabel={modal.mode === 'edit' ? 'Update' : 'Add'}
          submitting={saving}
        >
          <Field label="Sub-division name *">
            <input value={form.sub_division_name} onChange={(e) => setForm({ ...form, sub_division_name: e.target.value })} required />
          </Field>
          <CodeField
            label="Sub code *"
            value={form.sub_div_code}
            onChange={(v) => setForm({ ...form, sub_div_code: v })}
            readOnly={modal.mode === 'edit'}
            placeholder="e.g. fow-north"
          />
          <Field label="Sort order">
            <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
          </Field>
          <ActiveCheckbox value={form.activated} onChange={(v) => setForm({ ...form, activated: v })} />
        </Modal>
      )}

      {modal?.type === 'role' && (
        <Modal
          title={modal.mode === 'edit' ? 'Edit job role' : 'Add job role'}
          onClose={closeModal}
          onSubmit={handleModalSubmit}
          submitLabel={modal.mode === 'edit' ? 'Update' : 'Add'}
          submitting={saving}
        >
          <CodeField
            label="Role code *"
            value={form.jr_code}
            onChange={(v) => setForm({ ...form, jr_code: v })}
            readOnly={modal.mode === 'edit'}
            placeholder="e.g. am"
          />
          <Field label="Department *">
            <select
              value={form.dept_id}
              onChange={(e) => setForm({ ...form, dept_id: e.target.value })}
              required={modal.mode === 'add'}
              disabled={modal.mode === 'edit'}
            >
              <option value="">— Select —</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.department_name}</option>)}
            </select>
            {modal.mode === 'edit' ? (
              <span className="emp-org-field-hint">Department link cannot be changed after creation.</span>
            ) : (
              <span className="emp-org-field-hint">Designation is created only for this department.</span>
            )}
          </Field>
          <Field label="Job role title *">
            <input value={form.job_role} onChange={(e) => setForm({ ...form, job_role: e.target.value })} required />
          </Field>
          <Field label="Management layer *">
            <select
              value={form.mgt_layer_id}
              onChange={(e) => {
                const layer = findLayerById(layers, e.target.value);
                setForm({
                  ...form,
                  mgt_layer_id: e.target.value,
                  power: layer ? clampPowerToLayer(form.power, layer) : '',
                });
              }}
              required
            >
              <option value="">— Select —</option>
              {layers.map((l) => {
                const bounds = getLayerPowerBounds(l);
                const range = bounds ? ` (${bounds.min}–${bounds.max})` : '';
                return (
                  <option key={l.id} value={l.id}>{l.layer_name}{range}</option>
                );
              })}
            </select>
          </Field>
          <Field label="Power *">
            <input
              type="number"
              value={form.power}
              onChange={(e) => setForm({ ...form, power: e.target.value })}
              min={selectedRolePowerBounds?.min}
              max={selectedRolePowerBounds?.max}
              required
              disabled={!form.mgt_layer_id}
            />
            {form.mgt_layer_id ? (
              <span className="emp-org-field-hint">{layerPowerHint(selectedRoleLayer)}</span>
            ) : (
              <span className="emp-org-field-hint">Select a management layer first.</span>
            )}
          </Field>
          <Field label="Sort order">
            <input
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              min={0}
            />
          </Field>
          <ActiveCheckbox value={form.activated} onChange={(v) => setForm({ ...form, activated: v })} />
        </Modal>
      )}

      {modal?.type === 'spec' && (
        <Modal
          title={modal.mode === 'edit' ? 'Edit specialization' : 'Add specialization'}
          onClose={closeModal}
          onSubmit={handleModalSubmit}
          submitLabel={modal.mode === 'edit' ? 'Update' : 'Add'}
          submitting={saving}
        >
          <Field label="Department *">
            <select
              value={form.dept_id}
              onChange={(e) => setForm({ ...form, dept_id: e.target.value, job_role_id: '' })}
              required
              disabled={modal.mode === 'edit'}
            >
              <option value="">— Select —</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.department_name}</option>)}
            </select>
          </Field>
          <Field label="Job role *">
            <select
              value={form.job_role_id}
              onChange={(e) => setForm({ ...form, job_role_id: e.target.value })}
              required
              disabled={modal.mode === 'edit' || !form.dept_id}
            >
              <option value="">— Select —</option>
              {jobRolesForDept.map((r) => <option key={r.id} value={r.id}>{r.job_role}</option>)}
            </select>
            {modal.mode === 'add' && form.dept_id && jobRolesForDept.length === 0 ? (
              <span className="emp-org-field-hint">No job roles linked to this department yet.</span>
            ) : null}
          </Field>
          <Field label="Specialization *">
            <input
              value={form.specialization}
              onChange={(e) => setForm({ ...form, specialization: e.target.value })}
              placeholder="Each word ≥3 letters"
              required
              readOnly={modal.mode === 'edit'}
              style={modal.mode === 'edit' ? { background: '#f5f5f5', cursor: 'not-allowed' } : undefined}
            />
            {modal.mode === 'edit' ? (
              <span className="emp-org-field-hint">Specialization and code cannot be changed after creation.</span>
            ) : null}
          </Field>
          {modal.mode === 'edit' && form.spe_code ? (
            <Field label="Code">
              <input value={form.spe_code} readOnly style={{ background: '#f5f5f5' }} />
            </Field>
          ) : null}
          {modal.mode === 'add' && (
            <div className="emp-org-modal-preview-row">
              <button type="button" className="emp-org-btn emp-org-btn--secondary" onClick={handleSpecPreview}>Preview code</button>
              {specPreview && (
                <span className="emp-org-preview">
                  {specPreview.spe_code} — {specPreview.designation_title}
                </span>
              )}
            </div>
          )}
          <ActiveCheckbox value={form.activated} onChange={(v) => setForm({ ...form, activated: v })} />
        </Modal>
      )}

      {modal?.type === 'limit' && (
        <Modal
          title="Set max headcount"
          onClose={closeModal}
          onSubmit={handleModalSubmit}
          submitLabel="Save"
          submitting={saving}
        >
          <Field label="Department">
            <input
              value={departments.find((d) => String(d.id) === String(form.dept_id))?.department_name || ''}
              readOnly
              style={{ background: '#f5f5f5' }}
            />
          </Field>
          <Field label="Job role">
            <input value={form.job_role_label || ''} readOnly style={{ background: '#f5f5f5' }} />
          </Field>
          <Field label="Max allowed headcount *">
            <input
              type="number"
              min="0"
              value={form.max_limit}
              onChange={(e) => setForm({ ...form, max_limit: e.target.value })}
              required
            />
          </Field>
        </Modal>
      )}
    </section>
  );
}
