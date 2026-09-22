import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { HrmPageHeader, HrmSubTabs } from '../shell/HrmShell';
import {
  useGetInvestigationRecommendationsQuery,
  useRejectInvestigationRecommendationMutation,
  useCreateHrInvestigationMutation,
  useGetHrInvestigationsQuery,
  useCreateHrAccidentReportMutation,
  useGetHrAccidentReportByInvestigationQuery,
  useSaveHrAccidentReportMutation,
  useSubmitHrAccidentReportMutation,
} from '../../../api/services NodeJs/investigationWorkflowApi';
import './hrmInvestigations.css';

function getUserId() {
  try {
    return JSON.parse(localStorage.getItem('userData') || '{}')?.id || null;
  } catch {
    return null;
  }
}

const EMPTY_HR_FORM = {
  accident_datetime: '',
  location: '',
  drone_model_serial: '',
  pilot_name: '',
  flight_operation_type: '',
  pilot_statement: '',
  immediate_cause_pilot: '',
  evidence: {
    photos: false,
    flight_logs: false,
    controller_logs: false,
    video: false,
    pilot_statements: false,
    site_inspection: false,
  },
  damage_assessment: '',
  immediate_actions: {
    flight_stopped: false,
    battery_disconnected: false,
    area_secured: false,
    photos_taken: false,
    reported_supervisor: false,
    sent_to_workshop: false,
    other: '',
  },
  technical_findings: '',
  workshop_officer_name: '',
  primary_cause: '',
  secondary_causes: '',
  preventive_measures: '',
  severity: '',
  management_decision: [],
  remarks: '',
  total_repair_cost: '',
  company_coverage: '',
  pilot_liability: '',
  payment_method: '',
};

const EVIDENCE_KEYS = [
  ['photos', 'Photos'],
  ['flight_logs', 'Flight Logs'],
  ['controller_logs', 'Drone Controller Logs'],
  ['video', 'Video Evidence'],
  ['pilot_statements', 'Pilot Statements'],
  ['site_inspection', 'Site Inspection'],
];

const ACTION_KEYS = [
  ['flight_stopped', 'Flight stopped'],
  ['battery_disconnected', 'Battery disconnected'],
  ['area_secured', 'Area secured'],
  ['photos_taken', 'Photos taken'],
  ['reported_supervisor', 'Reported to supervisor'],
  ['sent_to_workshop', 'Drone sent to workshop'],
];

const DECISION_OPTS = [
  'No action required',
  'Pilot warning',
  'Pilot retraining',
  'Suspension from flying',
  'Cost recovery required',
  'Insurance claim initiated',
];

function RecommendationsTab() {
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useGetInvestigationRecommendationsQuery({ status: 'pending' });
  const [rejectRec] = useRejectInvestigationRecommendationMutation();
  const [createInv] = useCreateHrInvestigationMutation();
  const [message, setMessage] = useState('');

  const rows = Array.isArray(data) ? data : [];

  const handleCreate = async (rec) => {
    const userId = getUserId();
    if (!userId) {
      setMessage('Please sign in again.');
      return;
    }
    try {
      const inv = await createInv({
        recommendation_id: rec.id,
        created_by: userId,
      }).unwrap();
      setMessage(`Investigation #${inv.id} created.`);
      refetch();
      navigate(`/home/hrm/investigations/${inv.id}`);
    } catch (err) {
      setMessage(err?.data?.message || err?.message || 'Could not create investigation.');
    }
  };

  const handleReject = async (rec) => {
    const userId = getUserId();
    const notes = window.prompt('Reject notes (optional):') || '';
    try {
      await rejectRec({ id: rec.id, rejected_by: userId, reject_notes: notes }).unwrap();
      setMessage(`Recommendation #${rec.id} rejected.`);
      refetch();
    } catch (err) {
      setMessage(err?.data?.message || err?.message || 'Reject failed.');
    }
  };

  return (
    <div>
      {message ? <div className="hrm-inv-msg">{message}</div> : null}
      <div className="hrm-inv-table-wrap">
        <table className="hrm-inv-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Incident</th>
              <th>Pilot</th>
              <th>Reason</th>
              <th>Suspected fault</th>
              <th>Workshop report</th>
              <th>Recommended by</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="8">Loading…</td></tr>
            ) : rows.length ? (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>#{r.id}</td>
                  <td>#{r.incident_id}</td>
                  <td>{r.incident_pilot_name || '—'}</td>
                  <td className="hrm-inv-clip">{r.reason || '—'}</td>
                  <td className="hrm-inv-clip">{r.suspected_fault || '—'}</td>
                  <td>
                    {r.workshop_report_status === 'submitted'
                      ? <span className="hrm-inv-pill hrm-inv-pill--ok">Submitted</span>
                      : <span className="hrm-inv-pill">Pending workshop</span>}
                  </td>
                  <td>{r.recommended_by_name || '—'}</td>
                  <td>
                    <div className="hrm-inv-actions">
                      <button
                        type="button"
                        className="hrm-inv-btn"
                        disabled={r.workshop_report_status !== 'submitted'}
                        title={r.workshop_report_status !== 'submitted' ? 'Workshop accident report required first' : 'Create investigation'}
                        onClick={() => handleCreate(r)}
                      >
                        Create investigation
                      </button>
                      <button type="button" className="hrm-inv-btn hrm-inv-btn--ghost" onClick={() => handleReject(r)}>
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="8">No pending recommendations.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InvestigationsListTab() {
  const navigate = useNavigate();
  const { data, isLoading } = useGetHrInvestigationsQuery({});
  const rows = Array.isArray(data) ? data : [];

  return (
    <div className="hrm-inv-table-wrap">
      <table className="hrm-inv-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Incident</th>
            <th>Status</th>
            <th>Workshop report</th>
            <th>HR report</th>
            <th>Created by</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr><td colSpan="7">Loading…</td></tr>
          ) : rows.length ? (
            rows.map((r) => (
              <tr key={r.id}>
                <td>#{r.id}</td>
                <td>#{r.incident_id}</td>
                <td>{r.status}</td>
                <td>{r.workshop_report_status || '—'}</td>
                <td>{r.hr_report_status || '—'}</td>
                <td>{r.created_by_name || '—'}</td>
                <td>
                  <button type="button" className="hrm-inv-btn" onClick={() => navigate(`/home/hrm/investigations/${r.id}`)}>
                    Open
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr><td colSpan="7">No investigations yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function HrmInvestigationsPage() {
  const [tab, setTab] = useState('recommendations');
  return (
    <div className="hrm-inv-page">
      <HrmPageHeader
        title="Accident Investigations"
        hint="Receive Fleet recommendations, create investigations after workshop reports, and complete the HR investigation report."
        wingLabel="HRM"
      />
      <HrmSubTabs
        tabs={[
          { key: 'recommendations', label: 'Recommendations' },
          { key: 'investigations', label: 'Investigations' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'recommendations' ? <RecommendationsTab /> : <InvestigationsListTab />}
    </div>
  );
}

export function HrmInvestigationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: list } = useGetHrInvestigationsQuery({});
  const investigation = useMemo(
    () => (Array.isArray(list) ? list.find((r) => Number(r.id) === Number(id)) : null),
    [list, id]
  );

  const [createHrReport] = useCreateHrAccidentReportMutation();
  const { data: hrReport, refetch } = useGetHrAccidentReportByInvestigationQuery(id, { skip: !id });
  const [saveHrReport, { isLoading: saving }] = useSaveHrAccidentReportMutation();
  const [submitHrReport, { isLoading: submitting }] = useSubmitHrAccidentReportMutation();

  const [form, setForm] = useState(EMPTY_HR_FORM);
  const [message, setMessage] = useState('');
  const [reportId, setReportId] = useState(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const submitted = hrReport?.status === 'submitted';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id || bootstrapped) return;
      try {
        if (hrReport?.id) {
          if (!cancelled) {
            setReportId(hrReport.id);
            const fd = hrReport.form_data && typeof hrReport.form_data === 'object' ? hrReport.form_data : {};
            setForm({
              ...EMPTY_HR_FORM,
              ...fd,
              evidence: { ...EMPTY_HR_FORM.evidence, ...(fd.evidence || {}) },
              immediate_actions: { ...EMPTY_HR_FORM.immediate_actions, ...(fd.immediate_actions || {}) },
              management_decision: fd.management_decision || [],
            });
            setBootstrapped(true);
          }
          return;
        }
        const created = await createHrReport({
          hr_investigation_id: Number(id),
          created_by: getUserId(),
        }).unwrap();
        if (!cancelled) {
          setReportId(created.id);
          const fd = created.form_data && typeof created.form_data === 'object' ? created.form_data : {};
          setForm({
            ...EMPTY_HR_FORM,
            ...fd,
            evidence: { ...EMPTY_HR_FORM.evidence, ...(fd.evidence || {}) },
            immediate_actions: { ...EMPTY_HR_FORM.immediate_actions, ...(fd.immediate_actions || {}) },
            management_decision: fd.management_decision || [],
          });
          setBootstrapped(true);
          refetch();
        }
      } catch (err) {
        if (!cancelled) {
          setMessage(err?.data?.message || err?.message || 'Could not load HR report.');
          setBootstrapped(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [id, hrReport, createHrReport, bootstrapped, refetch]);

  const setField = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const handleSave = async () => {
    if (!reportId) return;
    try {
      await saveHrReport({ id: reportId, form_data: form }).unwrap();
      setMessage('Draft saved.');
      refetch();
    } catch (err) {
      setMessage(err?.data?.message || err?.message || 'Save failed.');
    }
  };

  const handleSubmit = async () => {
    if (!reportId) return;
    try {
      await submitHrReport({ id: reportId, submitted_by: getUserId(), form_data: form }).unwrap();
      setMessage('HR investigation report submitted.');
      refetch();
    } catch (err) {
      setMessage(err?.data?.message || err?.message || 'Submit failed.');
    }
  };

  if (!investigation && list) {
    return <div className="hrm-inv-page">Investigation not found.</div>;
  }

  return (
    <div className="hrm-inv-page">
      <HrmPageHeader
        title={`Investigation #${id}`}
        hint={`Incident #${investigation?.incident_id || '—'} · ${investigation?.status || ''}`}
        wingLabel="HRM"
        actions={(
          <>
            <button type="button" className="hrm-inv-btn hrm-inv-btn--ghost" onClick={() => navigate('/home/hrm/investigations')}>
              Back
            </button>
            {!submitted ? (
              <>
                <button type="button" className="hrm-inv-btn hrm-inv-btn--ghost" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save draft'}
                </button>
                <button type="button" className="hrm-inv-btn" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit report'}
                </button>
              </>
            ) : null}
          </>
        )}
      />

      {message ? <div className="hrm-inv-msg">{message}</div> : null}

      <div className="hrm-inv-form">
        <h3>1. Accident information</h3>
        <div className="hrm-inv-grid">
          {[
            ['accident_datetime', 'Accident date & time'],
            ['location', 'Location (GPS / Estate / Site)'],
            ['drone_model_serial', 'Drone model / serial'],
            ['pilot_name', 'Pilot / operator'],
            ['flight_operation_type', 'Flight operation type'],
          ].map(([k, label]) => (
            <label key={k}>
              <span>{label}</span>
              <input disabled={submitted} value={form[k] || ''} onChange={(e) => setField(k, e.target.value)} />
            </label>
          ))}
        </div>

        <h3>2. Pilot incident statement</h3>
        <label className="hrm-inv-full">
          <span>Detailed description</span>
          <textarea disabled={submitted} rows={5} value={form.pilot_statement || ''} onChange={(e) => setField('pilot_statement', e.target.value)} />
        </label>
        <label className="hrm-inv-full">
          <span>Immediate cause / what happened (pilot opinion)</span>
          <textarea disabled={submitted} rows={3} value={form.immediate_cause_pilot || ''} onChange={(e) => setField('immediate_cause_pilot', e.target.value)} />
        </label>

        <h3>3. Evidence reviewed</h3>
        <div className="hrm-inv-checks">
          {EVIDENCE_KEYS.map(([k, label]) => (
            <label key={k}>
              <input
                type="checkbox"
                disabled={submitted}
                checked={Boolean(form.evidence?.[k])}
                onChange={(e) => setForm((p) => ({
                  ...p,
                  evidence: { ...p.evidence, [k]: e.target.checked },
                }))}
              />
              {label}
            </label>
          ))}
        </div>

        <h3>4. Damage assessment</h3>
        <label className="hrm-inv-full">
          <span>Notes / refer repair quotation</span>
          <textarea disabled={submitted} rows={3} value={form.damage_assessment || ''} onChange={(e) => setField('damage_assessment', e.target.value)} />
        </label>

        <h3>5. Immediate actions taken</h3>
        <div className="hrm-inv-checks">
          {ACTION_KEYS.map(([k, label]) => (
            <label key={k}>
              <input
                type="checkbox"
                disabled={submitted}
                checked={Boolean(form.immediate_actions?.[k])}
                onChange={(e) => setForm((p) => ({
                  ...p,
                  immediate_actions: { ...p.immediate_actions, [k]: e.target.checked },
                }))}
              />
              {label}
            </label>
          ))}
        </div>
        <label className="hrm-inv-full">
          <span>Other</span>
          <input
            disabled={submitted}
            value={form.immediate_actions?.other || ''}
            onChange={(e) => setForm((p) => ({
              ...p,
              immediate_actions: { ...p.immediate_actions, other: e.target.value },
            }))}
          />
        </label>

        <h3>6. Technical inspection findings</h3>
        <label className="hrm-inv-full">
          <span>Findings</span>
          <select disabled={submitted} value={form.technical_findings || ''} onChange={(e) => setField('technical_findings', e.target.value)}>
            <option value="">—</option>
            <option value="no_mechanical">No mechanical fault detected</option>
            <option value="possible_hardware">Possible hardware fault</option>
            <option value="confirmed_hardware">Confirmed hardware fault</option>
          </select>
        </label>
        <label>
          <span>Workshop officer</span>
          <input disabled={submitted} value={form.workshop_officer_name || ''} onChange={(e) => setField('workshop_officer_name', e.target.value)} />
        </label>

        <h3>7. Root cause analysis</h3>
        <div className="hrm-inv-grid">
          <label>
            <span>Primary cause</span>
            <input disabled={submitted} value={form.primary_cause || ''} onChange={(e) => setField('primary_cause', e.target.value)} />
          </label>
          <label>
            <span>Secondary causes</span>
            <input disabled={submitted} value={form.secondary_causes || ''} onChange={(e) => setField('secondary_causes', e.target.value)} />
          </label>
        </div>
        <label className="hrm-inv-full">
          <span>Preventive measures</span>
          <textarea disabled={submitted} rows={3} value={form.preventive_measures || ''} onChange={(e) => setField('preventive_measures', e.target.value)} />
        </label>

        <h3>8. Accident severity</h3>
        <select disabled={submitted} value={form.severity || ''} onChange={(e) => setField('severity', e.target.value)}>
          <option value="">—</option>
          <option value="minor">Minor</option>
          <option value="major">Major</option>
          <option value="total_loss">Total Loss</option>
        </select>

        <h3>9. Management decision</h3>
        <div className="hrm-inv-checks">
          {DECISION_OPTS.map((opt) => (
            <label key={opt}>
              <input
                type="checkbox"
                disabled={submitted}
                checked={(form.management_decision || []).includes(opt)}
                onChange={(e) => {
                  const cur = form.management_decision || [];
                  setField(
                    'management_decision',
                    e.target.checked ? [...cur, opt] : cur.filter((x) => x !== opt)
                  );
                }}
              />
              {opt}
            </label>
          ))}
        </div>

        <h3>10. Remarks</h3>
        <label className="hrm-inv-full">
          <textarea disabled={submitted} rows={3} value={form.remarks || ''} onChange={(e) => setField('remarks', e.target.value)} />
        </label>

        <h3>11. Cost recovery</h3>
        <div className="hrm-inv-grid">
          {[
            ['total_repair_cost', 'Total repair cost'],
            ['company_coverage', 'Company coverage'],
            ['pilot_liability', 'Pilot liability'],
            ['payment_method', 'Payment method'],
          ].map(([k, label]) => (
            <label key={k}>
              <span>{label}</span>
              <input disabled={submitted} value={form[k] || ''} onChange={(e) => setField(k, e.target.value)} />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

export default HrmInvestigationsPage;
