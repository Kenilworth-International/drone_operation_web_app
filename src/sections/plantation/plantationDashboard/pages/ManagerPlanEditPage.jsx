import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';
import { toast } from 'react-toastify';
import {
  useGetManagerPlanEditContextQuery,
  useSubmitManagerPlanEditMutation,
  useGetManagerFieldRemoveReasonsQuery,
} from '../../../../api/services NodeJs/plantationEstateManagerApi';
import { useGetChemicalsQuery } from '../../../../api/services NodeJs/chemicalsApi';
import { useGetTimeOfDaysQuery } from '../../../../api/services NodeJs/timeOfDaysApi';
import { Bars } from 'react-loader-spinner';
import '../../../../styles/plantationDashboard.css';

const BASE = '/home/plantation-dashboard';

function fieldUsable(f, missionTypeId) {
  const mt = String(missionTypeId || '').toLowerCase();
  if (Number(f.activated) !== 1) return false;
  if (mt === 'spy') return Number(f.can_spray) === 1;
  if (mt === 'spd') return Number(f.can_spread) === 1;
  return false;
}

export default function ManagerPlanEditPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [selectedFieldIds, setSelectedFieldIds] = useState(new Set());
  const [chemLines, setChemLines] = useState([{ chemicalId: '', quantity: '' }]);
  const [timeOfDayId, setTimeOfDayId] = useState('');
  const [removeReasonId, setRemoveReasonId] = useState('');

  const { data: ctxRaw, isLoading, error } = useGetManagerPlanEditContextQuery(planId);
  const ctx = ctxRaw?.data || ctxRaw;
  const { data: chemicalsRaw } = useGetChemicalsQuery();
  const { data: timesRaw } = useGetTimeOfDaysQuery();
  const { data: removeReasonsRaw } = useGetManagerFieldRemoveReasonsQuery();
  const chemicals = chemicalsRaw?.data || chemicalsRaw || [];
  const times = timesRaw?.data || timesRaw || [];
  const removeReasons = removeReasonsRaw?.data || removeReasonsRaw || [];
  const [submitEdit, { isLoading: submitting }] = useSubmitManagerPlanEditMutation();

  const missionTypeId = ctx?.plan?.missionTypeId;
  const startedIds = new Set((ctx?.startedFieldIds || []).map(Number));
  const usableFields = useMemo(
    () => (ctx?.fields || []).filter((f) => fieldUsable(f, missionTypeId)),
    [ctx, missionTypeId]
  );

  useEffect(() => {
    if (!ctx) return;
    const initial = (ctx.selectedFieldIds || ctx.activePlanFields?.map((f) => f.fieldId || f.id) || [])
      .map(Number)
      .filter(Boolean);
    if (initial.length) setSelectedFieldIds(new Set(initial));
    if (ctx.timeOfDayId) setTimeOfDayId(String(ctx.timeOfDayId));
    if (ctx.chemicalLines?.length) {
      setChemLines(ctx.chemicalLines.map((l) => ({
        chemicalId: String(l.chemicalId),
        quantity: String(l.quantity),
      })));
    }
  }, [ctx]);

  const toggleField = (id) => {
    if (startedIds.has(id)) return;
    setSelectedFieldIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    const fieldIds = Array.from(selectedFieldIds);
    const chemicalsPayload = chemLines
      .filter((l) => l.chemicalId && l.quantity)
      .map((l) => ({ chemicalId: Number(l.chemicalId), quantity: parseFloat(l.quantity) }));
    if (!fieldIds.length || !timeOfDayId) {
      toast.error('Select fields and time of day.');
      return;
    }
    try {
      await submitEdit({
        planId: Number(planId),
        fieldIds,
        timeOfDayId: Number(timeOfDayId),
        chemicals: chemicalsPayload,
        ...(removeReasonId ? { removeReasonId: Number(removeReasonId) } : {}),
      }).unwrap();
      toast.success('Plan updated.');
      navigate(`${BASE}/manager`);
    } catch (err) {
      toast.error(err?.data?.message || 'Update failed.');
    }
  };

  if (isLoading) {
    return (
      <div className="pd-wizard-loading">
        <Bars height={36} width={48} color="#2d6a4f" />
      </div>
    );
  }

  if (error || !ctx || ctx.editable === false) {
    return (
      <div className="pd-wizard-page">
        <button type="button" className="pd-back-btn" onClick={() => navigate(`${BASE}/manager`)}>
          <FaArrowLeft /> Back
        </button>
        <p>This plan cannot be edited.</p>
      </div>
    );
  }

  return (
    <div className="pd-wizard-page">
      <button type="button" className="pd-back-btn" onClick={() => navigate(`${BASE}/manager`)}>
        <FaArrowLeft /> Back
      </button>
      <h1>Edit plan #{planId}</h1>
      <p>{ctx.plan?.pickedDate}</p>

      <div className="pd-wizard-panel">
        <h3>Fields</h3>
        {usableFields.map((f) => (
          <label key={f.id} className="pd-wizard-check">
            <input
              type="checkbox"
              checked={selectedFieldIds.has(f.id)}
              disabled={startedIds.has(f.id)}
              onChange={() => toggleField(f.id)}
            />
            {f.field || f.short_name} · {parseFloat(f.area || 0).toFixed(2)} Ha
            {startedIds.has(f.id) ? ' (started)' : ''}
          </label>
        ))}

        <h3>Chemicals</h3>
        {chemLines.map((line, idx) => (
          <div key={idx} className="pd-wizard-chem-row">
            <select
              value={line.chemicalId}
              onChange={(e) => {
                const next = [...chemLines];
                next[idx] = { ...next[idx], chemicalId: e.target.value };
                setChemLines(next);
              }}
            >
              <option value="">Chemical</option>
              {(Array.isArray(chemicals) ? chemicals : []).map((c) => (
                <option key={c.id} value={c.id}>{c.chemical || c.name}</option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              value={line.quantity}
              onChange={(e) => {
                const next = [...chemLines];
                next[idx] = { ...next[idx], quantity: e.target.value };
                setChemLines(next);
              }}
            />
          </div>
        ))}

        <h3>Time of day</h3>
        <select value={timeOfDayId} onChange={(e) => setTimeOfDayId(e.target.value)}>
          <option value="">Select</option>
          {(Array.isArray(times) ? times : []).map((t) => (
            <option key={t.id} value={t.id}>{t.time_of_day || t.name}</option>
          ))}
        </select>

        <h3>Field remove reason (if removing fields)</h3>
        <select value={removeReasonId} onChange={(e) => setRemoveReasonId(e.target.value)}>
          <option value="">Optional</option>
          {(Array.isArray(removeReasons) ? removeReasons : []).map((r) => (
            <option key={r.id} value={r.id}>{r.recen || r.reason}</option>
          ))}
        </select>

        <div className="pd-form-actions">
          <button type="button" className="plantation-action-btn" onClick={() => navigate(`${BASE}/manager`)}>
            Cancel
          </button>
          <button type="button" className="pd-calendar-btn" disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
