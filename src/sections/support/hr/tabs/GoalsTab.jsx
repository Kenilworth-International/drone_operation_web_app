import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { hrSupportRequest } from '../api/hrSupportApi';

function pad2(n) { return String(n).padStart(2, '0'); }

function defaultPeriodKey(periodType) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (periodType === 'year') return String(y);
  if (periodType === 'quarter') return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
  return `${y}-${pad2(m)}`;
}

function periodLabel(periodType, key) {
  if (periodType === 'month') {
    const [y, mo] = String(key || '').split('-');
    const d = new Date(Number(y), Number(mo) - 1, 1);
    return Number.isNaN(d.getTime()) ? key : d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  }
  if (periodType === 'quarter') return String(key || '').replace('-', ' ');
  return key;
}

function buildPeriodOptions(periodType) {
  const now = new Date();
  if (periodType === 'year') {
    const y = now.getFullYear();
    return Array.from({ length: 5 }, (_, i) => String(y - i));
  }
  if (periodType === 'quarter') {
    const opts = [];
    let y = now.getFullYear();
    let q = Math.floor(now.getMonth() / 3) + 1;
    for (let i = 0; i < 8; i++) {
      opts.push(`${y}-Q${q}`);
      q -= 1;
      if (q < 1) { q = 4; y -= 1; }
    }
    return opts;
  }
  const opts = [];
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
  }
  return opts;
}

function formatGoalValue(field, values) {
  if (!field) return '—';
  const value = values?.[field.key];
  if (field.inputType === 'multi_metric') {
    const rows = Array.isArray(value) ? value : [];
    if (!rows.length) return '—';
    return rows.map((row) => `${row.label || row.key}: ${row.value ?? '—'}`).join(' · ');
  }
  if (value == null || String(value).trim() === '') return '—';
  return String(value);
}

export default function GoalsTab({ token, refreshing, onRefresh }) {
  const [periodType, setPeriodType] = useState('quarter');
  const [periodKey, setPeriodKey] = useState(() => defaultPeriodKey('quarter'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [draftItems, setDraftItems] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const periodOptions = useMemo(() => buildPeriodOptions(periodType), [periodType]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await hrSupportRequest('/api/hr/smart-kpi/my', token, { method: 'POST', body: JSON.stringify({ periodType, periodKey }) });
      setDetail(data || null);
      setDraftItems((data?.items || []).map((item) => ({ id: item.id, values: { ...item.resultValues } })));
    } catch (err) {
      setError(err?.message || 'Failed to load goals.');
    } finally {
      setLoading(false);
    }
  }, [token, periodType, periodKey]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (refreshing) load();
  }, [refreshing]);

  const openEdit = (idx) => { setEditingIdx(idx); setModalOpen(true); setSaveError(''); };

  const saveResults = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await hrSupportRequest('/api/hr/smart-kpi/save-results', token, { method: 'POST', body: JSON.stringify({ periodType, periodKey, items: draftItems }) });
      await load();
      setModalOpen(false);
    } catch (err) {
      setSaveError(err?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const submitGoals = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await hrSupportRequest('/api/hr/smart-kpi/submit', token, { method: 'POST', body: JSON.stringify({ periodType, periodKey }) });
      await load();
    } catch (err) {
      setSaveError(err?.message || 'Failed to submit.');
    } finally {
      setSaving(false);
    }
  };

  const updateDraft = (idx, key, value) => {
    setDraftItems((prev) => prev.map((item, i) => i === idx ? { ...item, values: { ...item.values, [key]: value } } : item));
  };

  const editingItem = editingIdx != null ? draftItems[editingIdx] : null;
  const editingDef = editingIdx != null ? detail?.items?.[editingIdx] : null;

  return (
    <div>
      <div className="hrsup-segments" style={{ marginBottom: 12 }}>
        {['month', 'quarter', 'year'].map((pt) => (
          <button key={pt} type="button" className={`hrsup-segment-btn${periodType === pt ? ' hrsup-segment-btn--active' : ''}`}
            onClick={() => { setPeriodType(pt); setPeriodKey(defaultPeriodKey(pt)); }}>
            {pt.charAt(0).toUpperCase() + pt.slice(1)}
          </button>
        ))}
      </div>

      <div className="hrsup-field">
        <label className="hrsup-label">Period</label>
        <select className="hrsup-input hrsup-select" value={periodKey} onChange={(e) => setPeriodKey(e.target.value)}>
          {periodOptions.map((opt) => <option key={opt} value={opt}>{periodLabel(periodType, opt)}</option>)}
        </select>
      </div>

      {error && <div className="hrsup-error-box">{error} <button type="button" className="hrsup-error-dismiss" onClick={() => setError('')}>✕</button></div>}
      {saveError && <div className="hrsup-error-box">{saveError} <button type="button" className="hrsup-error-dismiss" onClick={() => setSaveError('')}>✕</button></div>}

      {loading ? (
        <div className="hrsup-loading">Loading goals…</div>
      ) : !detail ? (
        <p className="hrsup-empty">No goal plan found for this period.</p>
      ) : (
        <>
          <div className="hrsup-card" style={{ marginBottom: 12 }}>
            <h3 className="hrsup-card-title">{detail.planName || 'SMART KPI Plan'}</h3>
            <div className="hrsup-dl-row"><span className="hrsup-dl-label">Period</span><span className="hrsup-dl-value">{periodLabel(periodType, periodKey)}</span></div>
            <div className="hrsup-dl-row"><span className="hrsup-dl-label">Status</span><span className="hrsup-dl-value">{detail.submissionStatus || '—'}</span></div>
          </div>

          {(detail.items || []).map((item, idx) => {
            const draft = draftItems[idx];
            return (
              <div key={item.id || idx} className="hrsup-goal-card">
                <p className="hrsup-goal-name">{item.kpiName || item.name}</p>
                {item.description && <p className="hrsup-goal-desc">{item.description}</p>}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {(item.resultFields || []).map((f) => (
                      <div key={f.key}><strong>{f.label}:</strong> {formatGoalValue(f, draft?.values)}</div>
                    ))}
                  </div>
                  {detail.submissionStatus !== 'submitted' && (
                    <button type="button" className="hrsup-btn hrsup-btn--secondary hrsup-btn--sm" onClick={() => openEdit(idx)}>Edit</button>
                  )}
                </div>
              </div>
            );
          })}

          {detail.submissionStatus !== 'submitted' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button type="button" className="hrsup-btn hrsup-btn--secondary" disabled={saving} onClick={saveResults} style={{ flex: 1 }}>
                {saving ? 'Saving…' : 'Save Results'}
              </button>
              <button type="button" className="hrsup-btn hrsup-btn--primary" disabled={saving} onClick={submitGoals} style={{ flex: 1 }}>
                {saving ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Edit modal */}
      {modalOpen && editingDef && editingItem && (
        <div className="hrsup-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="hrsup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hrsup-modal-head">
              <h3 className="hrsup-modal-title">{editingDef.kpiName || editingDef.name}</h3>
              <button type="button" className="hrsup-modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="hrsup-modal-body">
              {(editingDef.resultFields || []).map((field) => (
                <div key={field.key} className="hrsup-field">
                  <label className="hrsup-label">{field.label}</label>
                  {field.inputType === 'textarea' ? (
                    <textarea className="hrsup-input" rows={3} value={editingItem.values?.[field.key] || ''} onChange={(e) => updateDraft(editingIdx, field.key, e.target.value)} style={{ resize: 'vertical' }} />
                  ) : field.inputType === 'number' ? (
                    <input type="number" className="hrsup-input" value={editingItem.values?.[field.key] || ''} onChange={(e) => updateDraft(editingIdx, field.key, e.target.value)} />
                  ) : (
                    <input type="text" className="hrsup-input" value={editingItem.values?.[field.key] || ''} onChange={(e) => updateDraft(editingIdx, field.key, e.target.value)} />
                  )}
                </div>
              ))}
            </div>
            <div className="hrsup-modal-foot">
              <button type="button" className="hrsup-btn hrsup-btn--secondary" onClick={() => setModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
