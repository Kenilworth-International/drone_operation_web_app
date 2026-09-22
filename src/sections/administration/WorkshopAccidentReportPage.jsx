import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useGetWorkshopAccidentReportByIdQuery,
  useSaveWorkshopAccidentReportMutation,
  useSubmitWorkshopAccidentReportMutation,
} from '../../api/services NodeJs/investigationWorkflowApi';
import '../../styles/maintenance.css';
import './workshopAccidentReport.css';

const YES_NO = [
  { value: '', label: '—' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

const CHECKLIST_Q = [
  { key: 'landing_pad_suitable', label: 'Was the landing pad selected by you suitable for that purpose?' },
  { key: 'landing_pad_clear_6m', label: 'Was the landing pad free from obstacles within a radius of at least 6 metres?' },
  { key: 'airworthiness_inspected', label: 'Before flight, was the aircraft thoroughly inspected for airworthiness?' },
  { key: 'drone_sticks_360', label: 'Were the 360° inspections of the Drone Sticks carried out properly?' },
  { key: 'control_system_settings', label: 'Were all the settings of the aircraft’s control system checked?' },
  { key: 'camera_settings', label: 'Were the aircraft’s camera settings checked for correctness?' },
  { key: 'terrain_follow', label: 'Was the Terrain Follow setting of the aircraft activated?' },
  { key: 'obstacle_bypass', label: 'Was the Obstacle Bypass setting of the aircraft activated?' },
  { key: 'inflight_check', label: 'Did you carry out an in-flight check of the aircraft?' },
  { key: 'boundary_obstacles', label: 'Were Boundary Obstacles identified and marked?' },
  { key: 'inner_obstacles', label: 'Were Inner Obstacles identified and marked?' },
  { key: 'lines_buildings', label: 'Were high-voltage / telephone / railway lines and buildings identified and marked?' },
  { key: 'flight_path_clear', label: 'Was the flight path from Home Point free from obstacles?' },
];

const EMPTY_FORM = {
  pilot_full_name: '',
  licence_number: '',
  aircraft_type: '',
  aircraft_registration: '',
  aircraft_serial: '',
  accident_datetime: '',
  accident_place: '',
  persons_injured: '',
  injury_occurred: '',
  property_damaged: '',
  checklist: {},
  pilot_description: '',
  pilot_declaration_date: '',
  sketch_notes: '',
  investigation_notes_workshop: '',
  investigating_officer_cert: '',
  accident_cause: '',
  recommended_action_against_pilot: '',
  investigating_officer_date: '',
  damaged_items_cert_date: '',
  pilot_ack_date: '',
  flight_ops_date: '',
  technical_officer_date: '',
};

function getUserId() {
  try {
    return JSON.parse(localStorage.getItem('userData') || '{}')?.id || null;
  } catch {
    return null;
  }
}

export default function WorkshopAccidentReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: report, isLoading, refetch } = useGetWorkshopAccidentReportByIdQuery(id, { skip: !id });
  const [saveReport, { isLoading: saving }] = useSaveWorkshopAccidentReportMutation();
  const [submitReport, { isLoading: submitting }] = useSubmitWorkshopAccidentReportMutation();

  const [section, setSection] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [damagedItems, setDamagedItems] = useState([{ damaged_item: '', quantity: 1, item_value: '', remarks: '', recommended_action: '' }]);
  const [message, setMessage] = useState('');

  const submitted = report?.status === 'submitted';

  useEffect(() => {
    if (!report) return;
    const fd = report.form_data && typeof report.form_data === 'object' ? report.form_data : {};
    setForm({ ...EMPTY_FORM, ...fd, checklist: { ...EMPTY_FORM.checklist, ...(fd.checklist || {}) } });
    if (Array.isArray(report.damaged_items) && report.damaged_items.length) {
      setDamagedItems(report.damaged_items.map((d) => ({
        damaged_item: d.damaged_item || '',
        quantity: d.quantity ?? 1,
        item_value: d.item_value ?? '',
        remarks: d.remarks || '',
        recommended_action: d.recommended_action || '',
      })));
    }
  }, [report]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const setCheck = (key, value) => setForm((prev) => ({
    ...prev,
    checklist: { ...(prev.checklist || {}), [key]: value },
  }));

  const buildPayload = () => ({
    form_data: form,
    damaged_items: damagedItems.filter((d) => String(d.damaged_item || '').trim()),
  });

  const handleSave = async () => {
    try {
      await saveReport({ id, ...buildPayload() }).unwrap();
      setMessage('Draft saved.');
      refetch();
    } catch (err) {
      setMessage(err?.data?.message || err?.message || 'Save failed.');
    }
  };

  const handleSubmit = async () => {
    const userId = getUserId();
    if (!userId) {
      setMessage('Please sign in again.');
      return;
    }
    try {
      await submitReport({ id, submitted_by: userId, ...buildPayload() }).unwrap();
      setMessage('Report submitted. HR can now create an investigation.');
      refetch();
    } catch (err) {
      setMessage(err?.data?.message || err?.message || 'Submit failed.');
    }
  };

  const sections = useMemo(() => [
    { n: 1, title: 'Section 1 — Particulars' },
    { n: 2, title: 'Section 2 — Checklist' },
    { n: 3, title: 'Description & sketch' },
    { n: 4, title: 'Damaged items & certifications' },
    { n: 5, title: 'Value & acknowledgements' },
  ], []);

  if (isLoading) {
    return <div className="maintenance-container-maintenance">Loading workshop accident report…</div>;
  }
  if (!report) {
    return <div className="maintenance-container-maintenance">Report not found.</div>;
  }

  return (
    <div className="maintenance-container-maintenance war-page">
      <div className="maint-page-header">
        <div>
          <h1>Drone Aircraft Accident Report</h1>
          <p className="maint-page-subtitle">
            Workshop report for incident #{report.incident_id}
            {submitted ? ' · Submitted' : ' · Draft'}
          </p>
        </div>
        <div className="maint-page-actions">
          <button type="button" className="maintenance-button-secondary-maintenance" onClick={() => navigate(-1)}>
            Back
          </button>
          {!submitted ? (
            <>
              <button type="button" className="maintenance-button-secondary-maintenance" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save draft'}
              </button>
              <button type="button" className="maintenance-button-primary-maintenance" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {message ? <div className="maintenance-feedback-maintenance success">{message}</div> : null}

      <div className="war-tabs">
        {sections.map((s) => (
          <button
            key={s.n}
            type="button"
            className={`war-tab${section === s.n ? ' war-tab--active' : ''}`}
            onClick={() => setSection(s.n)}
          >
            {s.title}
          </button>
        ))}
      </div>

      <div className="war-panel">
        {section === 1 && (
          <div className="war-grid">
            {[
              ['pilot_full_name', "Pilot’s full name with initials"],
              ['licence_number', 'Licence / Certificate number'],
              ['aircraft_type', 'Aircraft type'],
              ['aircraft_registration', 'Aircraft registration number'],
              ['aircraft_serial', 'Aircraft serial number'],
              ['accident_datetime', 'Date and time of the accident'],
              ['accident_place', 'Place of the accident'],
              ['persons_injured', 'Persons injured'],
            ].map(([key, label]) => (
              <label key={key} className="war-field">
                <span>{label}</span>
                <input
                  disabled={submitted}
                  value={form[key] || ''}
                  onChange={(e) => setField(key, e.target.value)}
                />
              </label>
            ))}
            <label className="war-field">
              <span>Whether any person was injured</span>
              <select disabled={submitted} value={form.injury_occurred || ''} onChange={(e) => setField('injury_occurred', e.target.value)}>
                {YES_NO.map((o) => <option key={o.value || 'x'} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="war-field">
              <span>Whether any property was damaged</span>
              <select disabled={submitted} value={form.property_damaged || ''} onChange={(e) => setField('property_damaged', e.target.value)}>
                {YES_NO.map((o) => <option key={o.value || 'x'} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>
        )}

        {section === 2 && (
          <div className="war-checklist">
            {CHECKLIST_Q.map((q) => (
              <label key={q.key} className="war-check-row">
                <span>{q.label}</span>
                <select
                  disabled={submitted}
                  value={(form.checklist && form.checklist[q.key]) || ''}
                  onChange={(e) => setCheck(q.key, e.target.value)}
                >
                  {YES_NO.map((o) => <option key={o.value || 'x'} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            ))}
          </div>
        )}

        {section === 3 && (
          <div className="war-stack">
            <label className="war-field war-field--full">
              <span>Detailed description by the pilot</span>
              <textarea
                disabled={submitted}
                rows={6}
                value={form.pilot_description || ''}
                onChange={(e) => setField('pilot_description', e.target.value)}
              />
            </label>
            <label className="war-field war-field--full">
              <span>Sketch of the accident site (notes / description)</span>
              <textarea
                disabled={submitted}
                rows={4}
                value={form.sketch_notes || ''}
                onChange={(e) => setField('sketch_notes', e.target.value)}
                placeholder="Describe the site sketch or reference uploaded evidence"
              />
            </label>
            <label className="war-field war-field--full">
              <span>Investigation notes (workshop)</span>
              <textarea
                disabled={submitted}
                rows={4}
                value={form.investigation_notes_workshop || ''}
                onChange={(e) => setField('investigation_notes_workshop', e.target.value)}
              />
            </label>
            <label className="war-field">
              <span>Pilot declaration date</span>
              <input
                type="date"
                disabled={submitted}
                value={form.pilot_declaration_date || ''}
                onChange={(e) => setField('pilot_declaration_date', e.target.value)}
              />
            </label>
          </div>
        )}

        {section === 4 && (
          <div className="war-stack">
            <h3>List of items damaged</h3>
            {damagedItems.map((row, idx) => (
              <div key={`dmg-${idx}`} className="war-damage-row">
                <input
                  disabled={submitted}
                  placeholder="Damaged item"
                  value={row.damaged_item}
                  onChange={(e) => {
                    const next = [...damagedItems];
                    next[idx] = { ...next[idx], damaged_item: e.target.value };
                    setDamagedItems(next);
                  }}
                />
                <input
                  disabled={submitted}
                  type="number"
                  placeholder="Qty"
                  value={row.quantity}
                  onChange={(e) => {
                    const next = [...damagedItems];
                    next[idx] = { ...next[idx], quantity: e.target.value };
                    setDamagedItems(next);
                  }}
                />
                <input
                  disabled={submitted}
                  placeholder="Remarks / recommendation"
                  value={row.remarks}
                  onChange={(e) => {
                    const next = [...damagedItems];
                    next[idx] = { ...next[idx], remarks: e.target.value };
                    setDamagedItems(next);
                  }}
                />
                {!submitted ? (
                  <button
                    type="button"
                    className="maintenance-button-secondary-maintenance"
                    onClick={() => setDamagedItems(damagedItems.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
            {!submitted ? (
              <button
                type="button"
                className="maintenance-button-secondary-maintenance"
                onClick={() => setDamagedItems([...damagedItems, { damaged_item: '', quantity: 1, item_value: '', remarks: '', recommended_action: '' }])}
              >
                Add damaged item
              </button>
            ) : null}
            <label className="war-field war-field--full">
              <span>Investigating officer certification / reasons</span>
              <textarea
                disabled={submitted}
                rows={4}
                value={form.investigating_officer_cert || ''}
                onChange={(e) => setField('investigating_officer_cert', e.target.value)}
              />
            </label>
            <label className="war-field war-field--full">
              <span>Cause of accident</span>
              <textarea
                disabled={submitted}
                rows={3}
                value={form.accident_cause || ''}
                onChange={(e) => setField('accident_cause', e.target.value)}
              />
            </label>
            <label className="war-field war-field--full">
              <span>Recommended action against the pilot</span>
              <textarea
                disabled={submitted}
                rows={3}
                value={form.recommended_action_against_pilot || ''}
                onChange={(e) => setField('recommended_action_against_pilot', e.target.value)}
              />
            </label>
          </div>
        )}

        {section === 5 && (
          <div className="war-stack">
            <h3>Damaged items (value)</h3>
            {damagedItems.map((row, idx) => (
              <div key={`val-${idx}`} className="war-damage-row">
                <span>{row.damaged_item || `Item ${idx + 1}`}</span>
                <input
                  disabled={submitted}
                  type="number"
                  placeholder="Value"
                  value={row.item_value}
                  onChange={(e) => {
                    const next = [...damagedItems];
                    next[idx] = { ...next[idx], item_value: e.target.value };
                    setDamagedItems(next);
                  }}
                />
                <input
                  disabled={submitted}
                  placeholder="Recommended action"
                  value={row.recommended_action}
                  onChange={(e) => {
                    const next = [...damagedItems];
                    next[idx] = { ...next[idx], recommended_action: e.target.value };
                    setDamagedItems(next);
                  }}
                />
              </div>
            ))}
            <div className="war-grid">
              {[
                ['damaged_items_cert_date', 'Damaged items certification date'],
                ['pilot_ack_date', 'Pilot acknowledgement date'],
                ['flight_ops_date', 'Flight Operations Officer date'],
                ['technical_officer_date', 'Technical Officer date'],
                ['investigating_officer_date', 'Investigating Officer date'],
              ].map(([key, label]) => (
                <label key={key} className="war-field">
                  <span>{label}</span>
                  <input
                    type="date"
                    disabled={submitted}
                    value={form[key] || ''}
                    onChange={(e) => setField(key, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
