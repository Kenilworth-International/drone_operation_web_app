import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  FaMoneyCheckAlt,
  FaCalculator,
  FaUsers,
  FaCogs,
  FaChartLine,
  FaEnvelope,
  FaFilePdf,
  FaEye,
  FaLock,
  FaCheck,
  FaPlus,
  FaSyncAlt,
  FaTrash,
} from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  useGetPayrollComponentsQuery,
  useCreatePayrollComponentMutation,
  useUpdatePayrollComponentMutation,
  useGetPayrollSchemesQuery,
  useSavePayrollSchemeMutation,
  useGetPayrollAssignmentMatrixQuery,
  useSetEmployeePayrollAssignmentsMutation,
  useMigratePayrollAssignmentsMutation,
  useGetPayrollStatutoryRatesQuery,
  useCreatePayrollStatutoryRateMutation,
  useGetPayrollMailSettingsQuery,
  useSavePayrollMailSettingsMutation,
  useGetPayrollPeriodsQuery,
  useCreatePayrollPeriodMutation,
  useCalculatePayrollPeriodMutation,
  useLockPayrollPeriodMutation,
  useMarkPayrollPeriodPaidMutation,
  useGetPayrollPayslipsQuery,
  useGetPayrollPayslipQuery,
  useEmailPayrollPayslipMutation,
  useBulkEmailPayrollPeriodMutation,
} from '../../../api/services NodeJs/payrollApi';
import { useGetAllEmployeeRegistrationsQuery } from '../../../api/services NodeJs/jdManagementApi';
import { getEmployeeDisplayName } from '../../hr&admin/employeeProfile/employeeProfileUtils';
import { getNodeBackendUrl, getToken } from '../../../api/services NodeJs/nodeBackendUrl';
import '../../../styles/payroll.css';

const TABS = [
  { key: 'run', label: 'Payroll run', icon: FaCalculator },
  { key: 'components', label: 'Components', icon: FaCogs },
  { key: 'assignments', label: 'Assignments', icon: FaUsers },
  { key: 'schemes', label: 'Performance', icon: FaChartLine },
  { key: 'settings', label: 'Settings', icon: FaEnvelope },
];

const CALC_TYPE_LABELS = {
  fixed: 'Fixed amount',
  percent_of: 'Percent of base',
  formula: 'Formula',
  nopay_amount: 'No-pay deduction',
  statutory_epf_employee: 'EPF (employee)',
  statutory_epf_employer: 'EPF (employer)',
  statutory_etf_employer: 'ETF (employer)',
  performance_ha: 'Ha performance',
};

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function money(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function flashOk(text) {
  toast.success(text);
}

function flashErr(e, fallback = 'Request failed') {
  toast.error(e?.data?.message || e?.error || e?.message || fallback);
}

function StatusBadge({ status }) {
  const key = String(status || 'draft').toLowerCase();
  return <span className={`payroll-badge ${key}`}>{status || 'draft'}</span>;
}

function CategoryBadge({ category }) {
  const key = String(category || '').toLowerCase();
  return <span className={`payroll-badge ${key}`}>{category}</span>;
}

const Payroll = () => {
  const [tab, setTab] = useState('run');
  const { data: periods = [] } = useGetPayrollPeriodsQuery();

  const periodStats = useMemo(() => {
    const stats = { draft: 0, calculated: 0, locked: 0, paid: 0 };
    (periods || []).forEach((p) => {
      const s = String(p.status || 'draft').toLowerCase();
      if (stats[s] != null) stats[s] += 1;
    });
    return stats;
  }, [periods]);

  return (
    <div className="payroll-page">
      <ToastContainer position="top-right" autoClose={2800} />

      <div className="payroll-top">
        <div className="payroll-title-block">
          <h2>
            <FaMoneyCheckAlt aria-hidden /> Payroll
          </h2>
          <p>Monthly salary runs, components, statutory rates, and payslips.</p>
        </div>
        <div className="payroll-summary">
          <div className="payroll-summary-card draft">
            <span>Draft</span>
            <strong>{periodStats.draft}</strong>
          </div>
          <div className="payroll-summary-card calculated">
            <span>Calculated</span>
            <strong>{periodStats.calculated}</strong>
          </div>
          <div className="payroll-summary-card locked">
            <span>Locked</span>
            <strong>{periodStats.locked}</strong>
          </div>
          <div className="payroll-summary-card paid">
            <span>Paid</span>
            <strong>{periodStats.paid}</strong>
          </div>
        </div>
      </div>

      <nav className="payroll-nav" aria-label="Payroll sections">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              className={`payroll-nav-btn${tab === t.key ? ' active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <Icon aria-hidden /> {t.label}
            </button>
          );
        })}
      </nav>

      {tab === 'run' && <RunPanel />}
      {tab === 'components' && <ComponentsPanel />}
      {tab === 'assignments' && <AssignmentsPanel />}
      {tab === 'schemes' && <SchemesPanel />}
      {tab === 'settings' && <SettingsPanel />}
    </div>
  );
};

function Field({ label, children, className = '' }) {
  return (
    <div className={`payroll-field ${className}`.trim()}>
      <label>{label}</label>
      {children}
    </div>
  );
}

function formatComponentConfig(c) {
  const f = c?.formulaJson || {};
  switch (c?.calcType) {
    case 'fixed':
      return `Amount ${money(f.amount)}`;
    case 'percent_of':
      return `${f.percent ?? 0}% of ${f.baseCode || (Array.isArray(f.baseCodes) ? f.baseCodes.join(', ') : '—')}`;
    case 'formula':
      return f.expression || '—';
    case 'nopay_amount':
      return `LOP × ${f.dailyRateCode || 'nopay_daily_rate'}`;
    case 'performance_ha':
      return f.schemeCode ? `Scheme: ${f.schemeCode}` : 'No scheme linked';
    case 'statutory_epf_employee':
    case 'statutory_epf_employer':
    case 'statutory_etf_employer':
      return 'From statutory rates';
    default:
      return '—';
  }
}

const EMPTY_COMPONENT_FORM = {
  code: '',
  name: '',
  category: 'earning',
  calcType: 'fixed',
  amount: 0,
  expression: '',
  percent: 0,
  baseCode: 'basic',
  schemeCode: '',
  includeInEpfBase: false,
  isTaxable: true,
  sortOrder: 100,
};

function ComponentsPanel() {
  const { data: components = [], refetch, isFetching } = useGetPayrollComponentsQuery(true);
  const { data: schemes = [] } = useGetPayrollSchemesQuery();
  const [createComponent, { isLoading: creating }] = useCreatePayrollComponentMutation();
  const [updateComponent, { isLoading: updating }] = useUpdatePayrollComponentMutation();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_COMPONENT_FORM);
  const expressionRef = useRef(null);

  const availableCodes = useMemo(
    () =>
      (components || [])
        .filter((c) => c.active !== false && String(c.id) !== String(editingId))
        .map((c) => ({ code: c.code, name: c.name, category: c.category })),
    [components, editingId]
  );

  const insertIntoExpression = (token) => {
    const el = expressionRef.current;
    const current = form.expression || '';
    if (el && typeof el.selectionStart === 'number') {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = `${current.slice(0, start)}${token}${current.slice(end)}`;
      setForm((prev) => ({ ...prev, expression: next }));
      requestAnimationFrame(() => {
        const pos = start + token.length;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
      return;
    }
    const needsSpace = current && !/[\s(+\-*/)]$/.test(current);
    setForm((prev) => ({
      ...prev,
      expression: `${current}${needsSpace ? ' ' : ''}${token}`,
    }));
  };

  const buildFormula = () => {
    if (form.calcType === 'fixed') return { amount: Number(form.amount) || 0 };
    if (form.calcType === 'percent_of') return { percent: Number(form.percent) || 0, baseCode: form.baseCode };
    if (form.calcType === 'formula') return { expression: form.expression || '' };
    if (form.calcType === 'nopay_amount') return { dailyRateCode: 'nopay_daily_rate' };
    if (form.calcType === 'performance_ha') return { schemeCode: form.schemeCode || null };
    return {};
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_COMPONENT_FORM);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_COMPONENT_FORM);
    setModalOpen(true);
  };

  const openEdit = (c) => {
    const f = c.formulaJson || {};
    setEditingId(c.id);
    setForm({
      code: c.code || '',
      name: c.name || '',
      category: c.category || 'earning',
      calcType: c.calcType || 'fixed',
      amount: f.amount ?? 0,
      expression: f.expression || '',
      percent: f.percent ?? f.pct ?? 0,
      baseCode: f.baseCode || (Array.isArray(f.baseCodes) ? f.baseCodes[0] : 'basic') || 'basic',
      schemeCode: f.schemeCode || '',
      includeInEpfBase: Boolean(c.includeInEpfBase),
      isTaxable: c.isTaxable !== false,
      sortOrder: c.sortOrder ?? 100,
    });
    setModalOpen(true);
  };

  const onSave = async () => {
    if (!String(form.code || '').trim() || !String(form.name || '').trim()) {
      toast.error('Code and name are required');
      return;
    }
    const payload = {
      name: form.name,
      category: form.category,
      calcType: form.calcType,
      formulaJson: buildFormula(),
      includeInEpfBase: form.includeInEpfBase,
      isTaxable: form.isTaxable,
      sortOrder: Number(form.sortOrder) || 100,
    };
    try {
      if (editingId) {
        await updateComponent({ id: editingId, ...payload }).unwrap();
        flashOk('Component updated');
      } else {
        await createComponent({ code: form.code, ...payload }).unwrap();
        flashOk('Component created');
      }
      closeModal();
      refetch();
    } catch (e) {
      flashErr(e, editingId ? 'Update failed' : 'Create failed');
    }
  };

  const toggleActive = async (row) => {
    try {
      await updateComponent({ id: row.id, active: !row.active }).unwrap();
      flashOk(row.active ? 'Component deactivated' : 'Component activated');
      refetch();
    } catch (e) {
      flashErr(e, 'Update failed');
    }
  };

  return (
    <div className="payroll-panel">
      <div className="payroll-panel-head">
        <div>
          <h3>Salary components</h3>
          <p>Earnings, deductions, and employer lines used in payroll calculation.</p>
        </div>
        <div className="payroll-actions" style={{ marginBottom: 0 }}>
          <button type="button" className="payroll-btn ghost" onClick={refetch} disabled={isFetching}>
            <FaSyncAlt /> Refresh
          </button>
          <button type="button" className="payroll-btn" onClick={openAdd}>
            <FaPlus /> Add component
          </button>
        </div>
      </div>

      <div className="payroll-table-wrap">
        <table className="payroll-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Category</th>
              <th>Calculation</th>
              <th>Config</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(components || []).length === 0 ? (
              <tr>
                <td colSpan={7} className="payroll-empty">No components yet. Click Add component to create one.</td>
              </tr>
            ) : (
              (components || []).map((c) => (
                <tr key={c.id}>
                  <td><code>{c.code}</code></td>
                  <td>{c.name}</td>
                  <td><CategoryBadge category={c.category} /></td>
                  <td>{CALC_TYPE_LABELS[c.calcType] || c.calcType}</td>
                  <td className="muted">{formatComponentConfig(c)}</td>
                  <td>
                    <span className={`payroll-badge ${c.active ? 'on' : 'off'}`}>
                      {c.active ? 'Active' : 'Off'}
                    </span>
                  </td>
                  <td>
                    <div className="payroll-row-actions">
                      <button type="button" className="payroll-btn ghost payroll-btn-sm" onClick={() => openEdit(c)}>
                        Edit
                      </button>
                      <button type="button" className="payroll-btn secondary payroll-btn-sm" onClick={() => toggleActive(c)}>
                        {c.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div
          className="payroll-modal-overlay"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
          role="presentation"
        >
          <div className="payroll-modal" role="dialog" aria-modal="true" aria-labelledby="payroll-comp-modal-title">
            <header className="payroll-modal-header">
              <div>
                <h3 id="payroll-comp-modal-title">{editingId ? 'Edit component' : 'Add component'}</h3>
                <p>
                  {editingId
                    ? `Update “${form.name || form.code}”. Code stays fixed.`
                    : 'Define how this earning or deduction is calculated.'}
                </p>
              </div>
              <button type="button" className="payroll-modal-close" onClick={closeModal} aria-label="Close">
                ×
              </button>
            </header>
            <div className="payroll-modal-body">
              <div className="payroll-form-grid">
                <Field label="Code">
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="e.g. housing"
                    disabled={Boolean(editingId)}
                  />
                </Field>
                <Field label="Name">
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Display name" />
                </Field>
                <Field label="Category">
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="earning">Earning</option>
                    <option value="deduction">Deduction</option>
                    <option value="employer">Employer</option>
                  </select>
                </Field>
                <Field label="Calculation">
                  <select value={form.calcType} onChange={(e) => setForm({ ...form, calcType: e.target.value })}>
                    {Object.entries(CALC_TYPE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                </Field>
                {form.calcType === 'fixed' && (
                  <Field label="Amount">
                    <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                  </Field>
                )}
                {form.calcType === 'percent_of' && (
                  <>
                    <Field label="Percent">
                      <input type="number" value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value })} />
                    </Field>
                    <Field label="Base code">
                      <select value={form.baseCode} onChange={(e) => setForm({ ...form, baseCode: e.target.value })}>
                        <option value="">Select component…</option>
                        {availableCodes.map((c) => (
                          <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                        ))}
                      </select>
                    </Field>
                  </>
                )}
                {form.calcType === 'formula' && (
                  <Field label="Expression" className="span-2">
                    <input
                      ref={expressionRef}
                      value={form.expression}
                      onChange={(e) => setForm({ ...form, expression: e.target.value })}
                      placeholder="(basic + incentive) / 30"
                    />
                  </Field>
                )}
                {form.calcType === 'performance_ha' && (
                  <Field label="Scheme">
                    <select value={form.schemeCode} onChange={(e) => setForm({ ...form, schemeCode: e.target.value })}>
                      <option value="">Select scheme…</option>
                      {(schemes || []).map((s) => (
                        <option key={s.id} value={s.code}>{s.code} - {s.name}</option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label="Sort order">
                  <input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
                </Field>
              </div>

              <div className="payroll-code-picker">
                <div className="payroll-code-picker-head">
                  <strong>Available codes</strong>
                  <span>
                    {form.calcType === 'formula'
                      ? 'Click a code or operator to insert into the formula.'
                      : form.calcType === 'percent_of'
                        ? 'Click a code to use it as the percent base.'
                        : 'Existing component codes you can reference.'}
                  </span>
                </div>
                {form.calcType === 'formula' && (
                  <div className="payroll-code-ops">
                    {['+', '-', '*', '/', '(', ')', '30'].map((op) => (
                      <button
                        key={op}
                        type="button"
                        className="payroll-code-chip op"
                        onClick={() => insertIntoExpression(op)}
                      >
                        {op}
                      </button>
                    ))}
                  </div>
                )}
                <div className="payroll-code-chips">
                  {availableCodes.length === 0 ? (
                    <span className="muted">No other components yet.</span>
                  ) : (
                    availableCodes.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        className={`payroll-code-chip ${c.category}`}
                        title={c.name}
                        onClick={() => {
                          if (form.calcType === 'formula') insertIntoExpression(c.code);
                          else if (form.calcType === 'percent_of') setForm((prev) => ({ ...prev, baseCode: c.code }));
                        }}
                      >
                        <code>{c.code}</code>
                        <small>{c.name}</small>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <label className="payroll-toggle-row" htmlFor="epf-base">
                <input
                  id="epf-base"
                  type="checkbox"
                  checked={form.includeInEpfBase}
                  onChange={(e) => setForm({ ...form, includeInEpfBase: e.target.checked })}
                />
                <span className="payroll-toggle-text">
                  <strong>Include in EPF base</strong>
                  <span>Add this component into the statutory EPF contribution base when eligible.</span>
                </span>
              </label>
            </div>
            <div className="payroll-modal-footer">
              <button type="button" className="payroll-btn ghost" onClick={closeModal}>Cancel</button>
              <button type="button" className="payroll-btn" onClick={onSave} disabled={creating || updating}>
                {editingId ? 'Update component' : 'Add component'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AssignmentsPanel() {
  const { data: allEmployeesResponse } = useGetAllEmployeeRegistrationsQuery();
  const { data: matrix, refetch } = useGetPayrollAssignmentMatrixQuery();
  const [setAssignments, { isLoading }] = useSetEmployeePayrollAssignmentsMutation();
  const [migrate, { isLoading: migrating }] = useMigratePayrollAssignmentsMutation();
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState({});
  const [amounts, setAmounts] = useState({});

  const employees = useMemo(() => {
    const raw = Array.isArray(allEmployeesResponse)
      ? allEmployeesResponse
      : allEmployeesResponse?.data?.data || allEmployeesResponse?.data || [];
    return Array.isArray(raw) ? raw : [];
  }, [allEmployeesResponse]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((emp) => {
      const name = getEmployeeDisplayName(emp).toLowerCase();
      const code = String(emp.empNo || emp.emp_no || '').toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [employees, search]);

  const components = matrix?.components || [];
  const selectedEmp = employees.find((e) => String(e.id) === String(selectedId));

  useEffect(() => {
    if (!selectedId && filteredEmployees.length) {
      setSelectedId(filteredEmployees[0].id);
    }
  }, [filteredEmployees, selectedId]);

  useEffect(() => {
    if (!selectedId || !matrix) return;
    const existing = matrix.byEmployee?.[String(selectedId)] || {};
    const nextDraft = {};
    const nextAmounts = {};
    components.forEach((c) => {
      nextDraft[c.id] = Boolean(existing[c.id]?.enabled);
      const amt = existing[c.id]?.overrideJson?.amount;
      nextAmounts[c.id] = amt != null ? amt : c.formulaJson?.amount ?? '';
    });
    setDraft(nextDraft);
    setAmounts(nextAmounts);
  }, [selectedId, matrix, components]);

  const onSave = async () => {
    try {
      const assignments = components.map((c) => ({
        componentId: c.id,
        enabled: Boolean(draft[c.id]),
        overrideJson:
          c.calcType === 'fixed'
            ? { amount: Number(amounts[c.id]) || 0 }
            : c.calcType === 'performance_ha'
              ? { schemeCode: amounts[c.id] || c.formulaJson?.schemeCode || null }
              : null,
      }));
      await setAssignments({ employeeId: selectedId, assignments }).unwrap();
      flashOk('Assignments saved');
      refetch();
    } catch (e) {
      flashErr(e, 'Save failed');
    }
  };

  const onMigrate = async () => {
    try {
      const res = await migrate({}).unwrap();
      flashOk(`Migrated ${res.migrated || 0} employees from profile fields`);
      refetch();
    } catch (e) {
      flashErr(e, 'Migrate failed');
    }
  };

  return (
    <div className="payroll-panel payroll-panel--fill">
      <div className="payroll-panel-head">
        <div>
          <h3>Employee assignments</h3>
          <p>Enable components per employee and set fixed amounts or scheme codes.</p>
        </div>
        <div className="payroll-actions" style={{ marginBottom: 0 }}>
          <button type="button" className="payroll-btn secondary" disabled={migrating} onClick={onMigrate}>
            Migrate from profile
          </button>
          <button type="button" className="payroll-btn" disabled={!selectedId || isLoading} onClick={onSave}>
            <FaCheck /> Save assignment
          </button>
        </div>
      </div>

      <div className="payroll-split" style={{ marginTop: '0.15rem' }}>
        <div className="payroll-emp-pane">
          <div className="payroll-emp-pane-head">
            <input
              type="search"
              placeholder="Search employee…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="payroll-emp-list">
            {filteredEmployees.map((emp) => (
              <button
                key={emp.id}
                type="button"
                className={`payroll-emp-item${String(selectedId) === String(emp.id) ? ' active' : ''}`}
                onClick={() => setSelectedId(emp.id)}
              >
                <span className="payroll-emp-name">{getEmployeeDisplayName(emp)}</span>
                {(emp.empNo || emp.emp_no) && <small>{emp.empNo || emp.emp_no}</small>}
              </button>
            ))}
          </div>
        </div>

        <div className="payroll-assign-pane">
          {!selectedId ? (
            <div className="payroll-assign-empty">
              <div className="payroll-empty-icon" aria-hidden>
                <FaUsers />
              </div>
              <strong>Select an employee</strong>
              <p>Choose someone from the list to enable earnings, deductions, and scheme overrides.</p>
            </div>
          ) : (
            <>
              <div className="payroll-panel-head">
                <div>
                  <h3>{getEmployeeDisplayName(selectedEmp)}</h3>
                  <p>{selectedEmp?.empNo || selectedEmp?.emp_no || `ID ${selectedId}`}</p>
                </div>
              </div>
              <div className="payroll-checks">
                {components.map((c) => (
                  <label key={c.id} className="payroll-check">
                    <input
                      type="checkbox"
                      checked={Boolean(draft[c.id])}
                      onChange={(e) => setDraft((prev) => ({ ...prev, [c.id]: e.target.checked }))}
                    />
                    <span>
                      <strong>{c.name}</strong>
                      <div className="muted">{c.code} · {CALC_TYPE_LABELS[c.calcType] || c.calcType}</div>
                    </span>
                    {c.calcType === 'fixed' && (
                      <input
                        type="number"
                        value={amounts[c.id] ?? ''}
                        onChange={(e) => setAmounts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        placeholder="Amount"
                      />
                    )}
                    {c.calcType === 'performance_ha' && (
                      <input
                        type="text"
                        value={amounts[c.id] ?? ''}
                        onChange={(e) => setAmounts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        placeholder="Scheme"
                      />
                    )}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTierSummary(tiers, payout) {
  if (!Array.isArray(tiers) || !tiers.length) return '—';
  return tiers
    .map((t) => {
      const ha = Number(t.minHa) || 0;
      if (payout === 'flat_amount') {
        return `${ha} Ha+ → ${money(t.amount)}`;
      }
      return `${ha} Ha+ → ${money(t.ratePerHa ?? t.rate)} / Ha`;
    })
    .join(' · ');
}

const EMPTY_SCHEME_FORM = {
  code: '',
  name: '',
  periodType: 'daily',
  tierMode: 'marginal',
  aggregation: 'daily_then_sum',
  payout: 'rate_times_ha',
};

const DEFAULT_TIERS = [
  { minHa: '3', ratePerHa: '100', amount: '' },
  { minHa: '7', ratePerHa: '200', amount: '' },
];

function SchemesPanel() {
  const { data: schemes = [], refetch } = useGetPayrollSchemesQuery();
  const [saveScheme, { isLoading: saving }] = useSavePayrollSchemeMutation();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_SCHEME_FORM);
  const [tiers, setTiers] = useState(DEFAULT_TIERS);

  const updateTier = (index, key, value) => {
    setTiers((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const addTier = () => {
    setTiers((prev) => {
      const last = prev[prev.length - 1];
      const nextHa = last ? Number(last.minHa || 0) + 5 : 0;
      return [...prev, { minHa: String(nextHa), ratePerHa: '', amount: '' }];
    });
  };

  const removeTier = (index) => {
    setTiers((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_SCHEME_FORM);
    setTiers(DEFAULT_TIERS);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_SCHEME_FORM);
    setTiers(DEFAULT_TIERS);
    setModalOpen(true);
  };

  const openEdit = (s) => {
    setEditingId(s.id);
    setForm({
      code: s.code || '',
      name: s.name || '',
      periodType: s.periodType || 'daily',
      tierMode: s.tierMode || 'marginal',
      aggregation: s.aggregation || 'daily_then_sum',
      payout: s.payout || 'rate_times_ha',
    });
    const rows = Array.isArray(s.tiers) && s.tiers.length
      ? s.tiers.map((t) => ({
          minHa: String(t.minHa ?? ''),
          ratePerHa: String(t.ratePerHa ?? t.rate ?? ''),
          amount: String(t.amount ?? ''),
        }))
      : [{ minHa: '', ratePerHa: '', amount: '' }];
    setTiers(rows);
    setModalOpen(true);
  };

  const buildTiersPayload = () => {
    const cleaned = tiers
      .map((t) => ({
        minHa: Number(t.minHa),
        ratePerHa: Number(t.ratePerHa),
        amount: Number(t.amount),
      }))
      .filter((t) => Number.isFinite(t.minHa));

    if (!cleaned.length) {
      toast.error('Add at least one tier with a Ha threshold');
      return null;
    }

    if (form.payout === 'flat_amount') {
      if (cleaned.some((t) => !Number.isFinite(t.amount))) {
        toast.error('Enter a flat amount for every tier');
        return null;
      }
      return cleaned
        .sort((a, b) => a.minHa - b.minHa)
        .map((t) => ({ minHa: t.minHa, amount: t.amount }));
    }

    if (cleaned.some((t) => !Number.isFinite(t.ratePerHa))) {
      toast.error('Enter a rate per Ha for every tier');
      return null;
    }
    return cleaned
      .sort((a, b) => a.minHa - b.minHa)
      .map((t) => ({ minHa: t.minHa, ratePerHa: t.ratePerHa }));
  };

  const onSave = async () => {
    const payloadTiers = buildTiersPayload();
    if (!payloadTiers) return;
    if (!String(form.code || '').trim() || !String(form.name || '').trim()) {
      toast.error('Code and name are required');
      return;
    }
    try {
      await saveScheme({
        id: editingId || undefined,
        code: form.code,
        name: form.name,
        periodType: form.periodType,
        tierMode: form.tierMode,
        aggregation: form.aggregation,
        payout: form.payout,
        tiers: payloadTiers,
      }).unwrap();
      flashOk(editingId ? 'Performance scheme updated' : 'Performance scheme saved');
      closeModal();
      refetch();
    } catch (e) {
      flashErr(e, 'Save failed');
    }
  };

  return (
    <div className="payroll-panel">
      <div className="payroll-panel-head">
        <div>
          <h3>Performance schemes</h3>
          <p>Ha-based payout rules for pilots and other performance components.</p>
        </div>
        <button type="button" className="payroll-btn" onClick={openAdd}>
          <FaPlus /> Add scheme
        </button>
      </div>

      <div className="payroll-table-wrap">
        <table className="payroll-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Mode</th>
              <th>Aggregation</th>
              <th>Tiers</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(schemes || []).length === 0 ? (
              <tr><td colSpan={6} className="payroll-empty">No performance schemes yet. Click Add scheme to create one.</td></tr>
            ) : (
              (schemes || []).map((s) => (
                <tr key={s.id}>
                  <td><code>{s.code}</code></td>
                  <td>{s.name}</td>
                  <td>{s.periodType} / {s.tierMode}</td>
                  <td>{s.aggregation}</td>
                  <td className="muted">{formatTierSummary(s.tiers, s.payout)}</td>
                  <td>
                    <button
                      type="button"
                      className="payroll-btn ghost payroll-btn-sm"
                      onClick={() => openEdit(s)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div
          className="payroll-modal-overlay"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
          role="presentation"
        >
          <div className="payroll-modal wide" role="dialog" aria-modal="true" aria-labelledby="payroll-scheme-modal-title">
            <header className="payroll-modal-header">
              <div>
                <h3 id="payroll-scheme-modal-title">{editingId ? 'Edit performance scheme' : 'Add performance scheme'}</h3>
                <p>
                  {editingId
                    ? `Update “${form.name || form.code}”. Code stays fixed.`
                    : 'Set period rules and Ha tiers. Marginal: 3 Ha @ 100 then 7 Ha @ 200 means 0→3 at 100 and 3→7 at 200.'}
                </p>
              </div>
              <button type="button" className="payroll-modal-close" onClick={closeModal} aria-label="Close">
                ×
              </button>
            </header>
            <div className="payroll-modal-body">
              <div className="payroll-form-grid">
                <Field label="Code">
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="e.g. pilot_daily"
                    disabled={Boolean(editingId)}
                  />
                </Field>
                <Field label="Name">
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Display name" />
                </Field>
                <Field label="Period">
                  <select value={form.periodType} onChange={(e) => setForm({ ...form, periodType: e.target.value })}>
                    <option value="daily">Daily</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </Field>
                <Field label="Tier mode">
                  <select value={form.tierMode} onChange={(e) => setForm({ ...form, tierMode: e.target.value })}>
                    <option value="marginal">Marginal (band by band)</option>
                    <option value="absolute">Absolute (highest match)</option>
                  </select>
                </Field>
                <Field label="Aggregation">
                  <select value={form.aggregation} onChange={(e) => setForm({ ...form, aggregation: e.target.value })}>
                    <option value="daily_then_sum">Daily then sum</option>
                    <option value="monthly_total">Monthly total</option>
                  </select>
                </Field>
                <Field label="Payout type">
                  <select value={form.payout} onChange={(e) => setForm({ ...form, payout: e.target.value })}>
                    <option value="rate_times_ha">Rate × Ha</option>
                    <option value="flat_amount">Flat amount</option>
                  </select>
                </Field>
              </div>

              <div className="payroll-tiers-box">
                <div className="payroll-panel-head" style={{ marginBottom: '0.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '0.85rem' }}>Ha tiers</h3>
                    <p>
                      {form.payout === 'flat_amount'
                        ? 'Set Ha threshold and the flat payout for that level.'
                        : 'Set Ha threshold and the rate paid per hectare for that band.'}
                    </p>
                  </div>
                  <button type="button" className="payroll-btn secondary payroll-btn-sm" onClick={addTier}>
                    <FaPlus /> Add tier
                  </button>
                </div>
                <div className="payroll-table-wrap">
                  <table className="payroll-table">
                    <thead>
                      <tr>
                        <th style={{ width: '3.5rem' }}>#</th>
                        <th>From Ha</th>
                        {form.payout === 'flat_amount' ? (
                          <th>Flat amount (LKR)</th>
                        ) : (
                          <th>Rate per Ha (LKR)</th>
                        )}
                        <th style={{ width: '4.5rem' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {tiers.map((row, index) => (
                        <tr key={`tier-${index}`}>
                          <td className="muted">{index + 1}</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.minHa}
                              onChange={(e) => updateTier(index, 'minHa', e.target.value)}
                              placeholder="e.g. 3"
                              style={{ width: '100%', maxWidth: '9rem' }}
                            />
                          </td>
                          <td>
                            {form.payout === 'flat_amount' ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.amount}
                                onChange={(e) => updateTier(index, 'amount', e.target.value)}
                                placeholder="e.g. 3000"
                                style={{ width: '100%', maxWidth: '11rem' }}
                              />
                            ) : (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.ratePerHa}
                                onChange={(e) => updateTier(index, 'ratePerHa', e.target.value)}
                                placeholder="e.g. 100"
                                style={{ width: '100%', maxWidth: '11rem' }}
                              />
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="payroll-btn danger payroll-btn-sm"
                              onClick={() => removeTier(index)}
                              disabled={tiers.length <= 1}
                              title="Remove tier"
                            >
                              <FaTrash />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="payroll-modal-footer">
              <button type="button" className="payroll-btn ghost" onClick={closeModal}>Cancel</button>
              <button type="button" className="payroll-btn" onClick={onSave} disabled={saving}>
                {editingId ? 'Update scheme' : 'Save scheme'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsPanel() {
  const { data: rates = [], refetch: refetchRates } = useGetPayrollStatutoryRatesQuery();
  const [createRate] = useCreatePayrollStatutoryRateMutation();
  const { data: mail, refetch: refetchMail } = useGetPayrollMailSettingsQuery();
  const [saveMail] = useSavePayrollMailSettingsMutation();
  const [rateForm, setRateForm] = useState({
    effectiveFrom: new Date().toISOString().slice(0, 10),
    epfEmployeePct: 8,
    epfEmployerPct: 12,
    etfEmployerPct: 3,
    notes: '',
  });
  const [mailForm, setMailForm] = useState({
    fromName: '',
    fromEmail: '',
    smtpHost: '',
    smtpPort: 465,
    smtpSecure: true,
    smtpUser: '',
    smtpPassword: '',
    pdfPasswordMode: 'nic_last6',
    contactEmail: '',
    contactPhone: '',
    footerNote: '',
  });

  useEffect(() => {
    if (!mail) return;
    setMailForm((prev) => ({
      ...prev,
      fromName: mail.fromName || '',
      fromEmail: mail.fromEmail || '',
      smtpHost: mail.smtpHost || '',
      smtpPort: mail.smtpPort || 465,
      smtpSecure: mail.smtpSecure !== false,
      smtpUser: mail.smtpUser || '',
      pdfPasswordMode: mail.pdfPasswordMode || 'nic_last6',
      contactEmail: mail.contactEmail || '',
      contactPhone: mail.contactPhone || '',
      footerNote: mail.footerNote || '',
    }));
  }, [mail]);

  const onAddRate = async () => {
    try {
      await createRate(rateForm).unwrap();
      flashOk('Statutory rate saved');
      refetchRates();
    } catch (e) {
      flashErr(e, 'Save failed');
    }
  };

  const onSaveMail = async () => {
    try {
      const body = { ...mailForm };
      if (!body.smtpPassword) delete body.smtpPassword;
      await saveMail(body).unwrap();
      flashOk('Mail settings saved');
      refetchMail();
    } catch (e) {
      flashErr(e, 'Save failed');
    }
  };

  return (
    <div className="payroll-settings-grid">
      <div className="payroll-section-card">
        <h4>Statutory rates</h4>
        <p className="payroll-hint">Stored in the database — change anytime. Used automatically when eligible.</p>
        <div className="payroll-form-grid">
          <Field label="Effective from">
            <input type="date" value={rateForm.effectiveFrom} onChange={(e) => setRateForm({ ...rateForm, effectiveFrom: e.target.value })} />
          </Field>
          <Field label="EPF employee %">
            <input type="number" step="0.0001" value={rateForm.epfEmployeePct} onChange={(e) => setRateForm({ ...rateForm, epfEmployeePct: e.target.value })} />
          </Field>
          <Field label="EPF employer %">
            <input type="number" step="0.0001" value={rateForm.epfEmployerPct} onChange={(e) => setRateForm({ ...rateForm, epfEmployerPct: e.target.value })} />
          </Field>
          <Field label="ETF employer %">
            <input type="number" step="0.0001" value={rateForm.etfEmployerPct} onChange={(e) => setRateForm({ ...rateForm, etfEmployerPct: e.target.value })} />
          </Field>
          <Field label="Notes" className="span-2">
            <input value={rateForm.notes} onChange={(e) => setRateForm({ ...rateForm, notes: e.target.value })} />
          </Field>
        </div>
        <div className="payroll-actions">
          <button type="button" className="payroll-btn" onClick={onAddRate}><FaPlus /> Add rate</button>
        </div>
        <div className="payroll-table-wrap">
          <table className="payroll-table">
            <thead>
              <tr>
                <th>Effective</th>
                <th>EPF emp</th>
                <th>EPF er</th>
                <th>ETF</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {(rates || []).map((r) => (
                <tr key={r.id}>
                  <td>{String(r.effectiveFrom).slice(0, 10)}</td>
                  <td className="num">{r.epfEmployeePct}%</td>
                  <td className="num">{r.epfEmployerPct}%</td>
                  <td className="num">{r.etfEmployerPct}%</td>
                  <td className="muted">{r.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="payroll-section-card">
        <h4>Shared payroll mailbox</h4>
        <p className="payroll-hint">One mailbox for all payslip emails — not per-user webmail.</p>
        <div className="payroll-form-grid">
          <Field label="From name"><input value={mailForm.fromName} onChange={(e) => setMailForm({ ...mailForm, fromName: e.target.value })} /></Field>
          <Field label="From email"><input value={mailForm.fromEmail} onChange={(e) => setMailForm({ ...mailForm, fromEmail: e.target.value })} /></Field>
          <Field label="SMTP host"><input value={mailForm.smtpHost} onChange={(e) => setMailForm({ ...mailForm, smtpHost: e.target.value })} /></Field>
          <Field label="SMTP port"><input type="number" value={mailForm.smtpPort} onChange={(e) => setMailForm({ ...mailForm, smtpPort: e.target.value })} /></Field>
          <Field label="SMTP user"><input value={mailForm.smtpUser} onChange={(e) => setMailForm({ ...mailForm, smtpUser: e.target.value })} /></Field>
          <Field label="SMTP password">
            <input
              type="password"
              value={mailForm.smtpPassword}
              onChange={(e) => setMailForm({ ...mailForm, smtpPassword: e.target.value })}
              placeholder={mail?.hasPassword ? '(unchanged)' : ''}
            />
          </Field>
          <Field label="PDF password">
            <select value={mailForm.pdfPasswordMode} onChange={(e) => setMailForm({ ...mailForm, pdfPasswordMode: e.target.value })}>
              <option value="nic_last6">NIC last 6</option>
              <option value="employee_code">Employee code</option>
            </select>
          </Field>
          <Field label="Contact email"><input value={mailForm.contactEmail} onChange={(e) => setMailForm({ ...mailForm, contactEmail: e.target.value })} /></Field>
          <Field label="Contact phone"><input value={mailForm.contactPhone} onChange={(e) => setMailForm({ ...mailForm, contactPhone: e.target.value })} /></Field>
          <Field label="Footer note" className="span-2">
            <textarea value={mailForm.footerNote} onChange={(e) => setMailForm({ ...mailForm, footerNote: e.target.value })} />
          </Field>
        </div>
        <div className="payroll-actions">
          <button type="button" className="payroll-btn" onClick={onSaveMail}><FaCheck /> Save mail settings</button>
        </div>
      </div>
    </div>
  );
}

function RunPanel() {
  const now = new Date();
  const { data: periods = [], refetch: refetchPeriods } = useGetPayrollPeriodsQuery();
  const [createPeriod] = useCreatePayrollPeriodMutation();
  const [calculatePeriod, { isLoading: calculating }] = useCalculatePayrollPeriodMutation();
  const [lockPeriod] = useLockPayrollPeriodMutation();
  const [markPaid] = useMarkPayrollPeriodPaidMutation();
  const [bulkEmail] = useBulkEmailPayrollPeriodMutation();
  const [emailPayslip] = useEmailPayrollPayslipMutation();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedPeriodId, setSelectedPeriodId] = useState(null);
  const [selectedPayslipId, setSelectedPayslipId] = useState(null);
  const [slipSearch, setSlipSearch] = useState('');

  const { data: payslips = [], refetch: refetchPayslips } = useGetPayrollPayslipsQuery(selectedPeriodId, {
    skip: !selectedPeriodId,
  });
  const { data: payslip } = useGetPayrollPayslipQuery(selectedPayslipId, { skip: !selectedPayslipId });

  const selectedPeriod = (periods || []).find((p) => p.id === selectedPeriodId);

  const filteredSlips = useMemo(() => {
    const q = slipSearch.trim().toLowerCase();
    if (!q) return payslips || [];
    return (payslips || []).filter(
      (s) =>
        String(s.employeeName || '').toLowerCase().includes(q) ||
        String(s.employeeCode || '').toLowerCase().includes(q)
    );
  }, [payslips, slipSearch]);

  const slipTotals = useMemo(() => {
    const list = payslips || [];
    return {
      count: list.length,
      gross: list.reduce((s, r) => s + Number(r.grossEarnings || 0), 0),
      net: list.reduce((s, r) => s + Number(r.netPay || 0), 0),
    };
  }, [payslips]);

  useEffect(() => {
    if (!selectedPeriodId && periods?.length) setSelectedPeriodId(periods[0].id);
  }, [periods, selectedPeriodId]);

  const onCreate = async () => {
    try {
      const p = await createPeriod({ year: Number(year), month: Number(month) }).unwrap();
      flashOk('Period created');
      refetchPeriods();
      setSelectedPeriodId(p.id);
    } catch (e) {
      flashErr(e, 'Create failed');
    }
  };

  const onCalculate = async () => {
    try {
      const res = await calculatePeriod({ id: selectedPeriodId }).unwrap();
      flashOk(`Calculated ${res.calculated} payslips`);
      refetchPeriods();
      refetchPayslips();
    } catch (e) {
      flashErr(e, 'Calculate failed');
    }
  };

  const openPdf = async (id) => {
    try {
      const token = getToken();
      const base = String(getNodeBackendUrl() || '').replace(/\/$/, '');
      const url = `${base}/api/payroll/payslips/${id}/pdf`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('PDF download failed');
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (e) {
      flashErr(e, 'PDF failed');
    }
  };

  return (
    <>
      <div className="payroll-panel">
        <div className="payroll-panel-head">
          <div>
            <h3>Monthly run</h3>
            <p>Create a period, calculate payslips from assignments and HR no-pay days, then lock and pay.</p>
          </div>
          {selectedPeriod && <StatusBadge status={selectedPeriod.status} />}
        </div>

        <div className="payroll-filters">
          <Field label="Year">
            <input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
          </Field>
          <Field label="Month">
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              {MONTH_LABELS.map((label, i) => (
                <option key={label} value={i + 1}>{label}</option>
              ))}
            </select>
          </Field>
          <div className="payroll-actions" style={{ marginBottom: 0, paddingBottom: 2 }}>
            <button type="button" className="payroll-btn" onClick={onCreate}>
              <FaPlus /> Create period
            </button>
          </div>
          <Field label="Open period">
            <select
              value={selectedPeriodId || ''}
              onChange={(e) => {
                setSelectedPeriodId(Number(e.target.value) || null);
                setSelectedPayslipId(null);
              }}
              style={{ minWidth: '12rem' }}
            >
              <option value="">Select period</option>
              {(periods || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {MONTH_LABELS[p.month - 1]} {p.year} ({p.status})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Search slips">
            <input
              type="search"
              value={slipSearch}
              onChange={(e) => setSlipSearch(e.target.value)}
              placeholder="Employee…"
              autoComplete="off"
            />
          </Field>
        </div>

        <div className="payroll-actions">
          <button type="button" className="payroll-btn" disabled={!selectedPeriodId || calculating} onClick={onCalculate}>
            <FaCalculator /> {calculating ? 'Calculating…' : 'Calculate'}
          </button>
          <button
            type="button"
            className="payroll-btn secondary"
            disabled={!selectedPeriodId}
            onClick={async () => {
              try {
                await lockPeriod(selectedPeriodId).unwrap();
                flashOk('Period locked');
                refetchPeriods();
                refetchPayslips();
              } catch (e) {
                flashErr(e, 'Lock failed');
              }
            }}
          >
            <FaLock /> Lock
          </button>
          <button
            type="button"
            className="payroll-btn secondary"
            disabled={!selectedPeriodId}
            onClick={async () => {
              try {
                await markPaid({ id: selectedPeriodId }).unwrap();
                flashOk('Marked paid');
                refetchPeriods();
                refetchPayslips();
              } catch (e) {
                flashErr(e, 'Mark paid failed');
              }
            }}
          >
            <FaCheck /> Mark paid
          </button>
          <button
            type="button"
            className="payroll-btn ghost"
            disabled={!selectedPeriodId}
            onClick={async () => {
              try {
                const res = await bulkEmail(selectedPeriodId).unwrap();
                flashOk(`Emailed ${res.sent}, failed ${res.failed}`);
                refetchPayslips();
              } catch (e) {
                flashErr(e, 'Bulk email failed');
              }
            }}
          >
            <FaEnvelope /> Email all
          </button>
        </div>

        {selectedPeriodId && (
          <div className="payroll-summary" style={{ marginBottom: '0.65rem' }}>
            <div className="payroll-summary-card calculated">
              <span>Payslips</span>
              <strong>{slipTotals.count}</strong>
            </div>
            <div className="payroll-summary-card draft">
              <span>Gross</span>
              <strong style={{ fontSize: '0.95rem' }}>{money(slipTotals.gross)}</strong>
            </div>
            <div className="payroll-summary-card paid">
              <span>Net</span>
              <strong style={{ fontSize: '0.95rem' }}>{money(slipTotals.net)}</strong>
            </div>
          </div>
        )}

        <div className="payroll-table-wrap">
          <table className="payroll-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Code</th>
                <th>Status</th>
                <th className="num">LOP</th>
                <th className="num">Gross</th>
                <th className="num">Deductions</th>
                <th className="num">Net</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!selectedPeriodId ? (
                <tr><td colSpan={8} className="payroll-empty">Create or select a payroll period to begin.</td></tr>
              ) : filteredSlips.length === 0 ? (
                <tr><td colSpan={8} className="payroll-empty">No payslips yet. Click Calculate after assigning components.</td></tr>
              ) : (
                filteredSlips.map((s) => (
                  <tr key={s.id} style={selectedPayslipId === s.id ? { background: '#f0f7fb' } : undefined}>
                    <td>{s.employeeName}</td>
                    <td className="muted">{s.employeeCode || '—'}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td className="num">{s.lopDays}</td>
                    <td className="num">{money(s.grossEarnings)}</td>
                    <td className="num">{money(s.totalDeductions)}</td>
                    <td className="num"><strong>{money(s.netPay)}</strong></td>
                    <td>
                      <div className="payroll-row-actions">
                        <button type="button" className="payroll-btn ghost payroll-btn-sm" onClick={() => setSelectedPayslipId(s.id)} title="View">
                          <FaEye /> View
                        </button>
                        <button type="button" className="payroll-btn ghost payroll-btn-sm" onClick={() => openPdf(s.id)} title="PDF">
                          <FaFilePdf /> PDF
                        </button>
                        <button
                          type="button"
                          className="payroll-btn ghost payroll-btn-sm"
                          onClick={async () => {
                            try {
                              await emailPayslip({ id: s.id }).unwrap();
                              flashOk('Payslip emailed');
                              refetchPayslips();
                            } catch (e) {
                              flashErr(e, 'Email failed');
                            }
                          }}
                          title="Email"
                        >
                          <FaEnvelope />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {payslip && <PayslipView slip={payslip} onClose={() => setSelectedPayslipId(null)} />}
    </>
  );
}

function PayslipView({ slip, onClose }) {
  const periodLabel = `${MONTH_LABELS[(slip.period?.month || 1) - 1]} ${slip.period?.year}`;
  return (
    <div className="payslip-view">
      <div className="payslip-view-head">
        <div>
          <h3>{slip.organization?.name || 'Company'}</h3>
          <div className="payslip-meta">
            {slip.organization?.address || '—'}
            <br />
            {periodLabel} · Pay date {slip.period?.payDate || '—'} · {slip.currency}
          </div>
        </div>
        <button type="button" className="payroll-btn ghost payroll-btn-sm" onClick={onClose}>Close</button>
      </div>

      <div className="payslip-view-body">
        <div className="payslip-section">
          <h4>Employee</h4>
          <div className="payslip-kv-grid">
            <div className="payslip-kv"><span>Name</span><div>{slip.employee?.name}</div></div>
            <div className="payslip-kv"><span>ID</span><div>{slip.employee?.employeeCode || slip.employee?.id}</div></div>
            <div className="payslip-kv"><span>Designation</span><div>{slip.employee?.designation || '—'}</div></div>
            <div className="payslip-kv"><span>Department</span><div>{slip.employee?.department || '—'}</div></div>
            <div className="payslip-kv"><span>Joined</span><div>{slip.employee?.joinedDate || '—'}</div></div>
            <div className="payslip-kv"><span>Employment</span><div>{slip.employee?.employmentType || '—'}</div></div>
            <div className="payslip-kv"><span>Bank</span><div>{slip.bank?.bankName || '—'} / {slip.bank?.accountNumberMasked || '—'}</div></div>
            <div className="payslip-kv"><span>Tax ID</span><div>{slip.employee?.taxIdMasked || '—'}</div></div>
            <div className="payslip-kv"><span>Days worked</span><div>{slip.daysWorked}</div></div>
            <div className="payslip-kv"><span>Leave</span><div>{slip.leaveDays}</div></div>
            <div className="payslip-kv"><span>LOP</span><div>{slip.lopDays}</div></div>
          </div>
        </div>

        <div className="payslip-section">
          <h4>Earnings</h4>
          <div className="payroll-table-wrap">
            <table className="payroll-table">
              <tbody>
                {(slip.earnings || []).map((r) => (
                  <tr key={r.code}><td>{r.label}</td><td className="num">{money(r.amount)}</td></tr>
                ))}
                <tr>
                  <td><strong>Gross earnings</strong></td>
                  <td className="num"><strong>{money(slip.grossEarnings)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="payslip-section">
          <h4>Deductions</h4>
          <div className="payroll-table-wrap">
            <table className="payroll-table">
              <tbody>
                {(slip.deductions || []).map((r) => (
                  <tr key={r.code}><td>{r.label}</td><td className="num">{money(r.amount)}</td></tr>
                ))}
                <tr>
                  <td><strong>Total deductions</strong></td>
                  <td className="num"><strong>{money(slip.totalDeductions)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="payslip-net-box">
          <div>
            <div className="muted" style={{ fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 700 }}>Net pay</div>
            <strong>{money(slip.netPay)} {slip.currency}</strong>
            <div><em>{slip.netPayWords}</em></div>
          </div>
          <div className="payslip-kv">
            <span>Payment</span>
            <div>{slip.paymentMode || 'bank_transfer'} · {slip.paymentRef || '—'}</div>
          </div>
        </div>

        {(slip.employerLines || []).length > 0 && (
          <div className="payslip-section">
            <h4>Employer contributions</h4>
            <div className="payroll-table-wrap">
              <table className="payroll-table">
                <tbody>
                  {slip.employerLines.map((r) => (
                    <tr key={r.code}><td>{r.label}</td><td className="num">{money(r.amount)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {slip.ytd && (
          <div className="payslip-section">
            <h4>Year-to-date</h4>
            <div className="payslip-kv-grid">
              <div className="payslip-kv"><span>YTD gross</span><div>{money(slip.ytd.ytdGross)}</div></div>
              <div className="payslip-kv"><span>YTD tax</span><div>{money(slip.ytd.ytdTax)}</div></div>
              <div className="payslip-kv"><span>YTD net</span><div>{money(slip.ytd.ytdNet)}</div></div>
            </div>
          </div>
        )}

        <div className="payslip-footer">
          This is a system-generated payslip and does not require a signature. Confidential.
        </div>
      </div>
    </div>
  );
}

export default Payroll;
