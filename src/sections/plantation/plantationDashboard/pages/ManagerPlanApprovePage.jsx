import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';
import { toast } from 'react-toastify';
import {
  useGetApprovePlanContextQuery,
  useSubmitPlanApprovalMutation,
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

export default function ManagerPlanApprovePage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [selectedFieldIds, setSelectedFieldIds] = useState(new Set());
  const [chemLines, setChemLines] = useState([{ chemicalId: '', quantity: '' }]);
  const [timeOfDayId, setTimeOfDayId] = useState('');

  const { data: ctxRaw, isLoading, error } = useGetApprovePlanContextQuery(planId);
  const ctx = ctxRaw?.data || ctxRaw;
  const { data: chemicalsRaw } = useGetChemicalsQuery(undefined, { skip: step !== 1 });
  const { data: timesRaw } = useGetTimeOfDaysQuery(undefined, { skip: step !== 2 });
  const chemicals = chemicalsRaw?.data || chemicalsRaw || [];
  const times = timesRaw?.data || timesRaw || [];
  const [submitApproval, { isLoading: submitting }] = useSubmitPlanApprovalMutation();

  const missionTypeId = ctx?.plan?.missionTypeId;
  const usableFields = useMemo(
    () => (ctx?.fields || []).filter((f) => fieldUsable(f, missionTypeId)),
    [ctx, missionTypeId]
  );

  useEffect(() => {
    if (usableFields.length && selectedFieldIds.size === 0) {
      setSelectedFieldIds(new Set(usableFields.map((f) => f.id)));
    }
  }, [usableFields, selectedFieldIds.size]);

  const selectedSum = useMemo(() => {
    let sum = 0;
    for (const f of usableFields) {
      if (selectedFieldIds.has(f.id)) sum += Number(f.area) || 0;
    }
    return sum;
  }, [usableFields, selectedFieldIds]);

  const toggleField = (id) => {
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
      await submitApproval({
        planId: Number(planId),
        fieldIds,
        timeOfDayId: Number(timeOfDayId),
        chemicals: chemicalsPayload,
      }).unwrap();
      toast.success('Plan approved.');
      navigate(`${BASE}/manager`);
    } catch (err) {
      toast.error(err?.data?.message || 'Approval failed.');
    }
  };

  if (isLoading) {
    return (
      <div className="pd-wizard-loading">
        <Bars height={36} width={48} color="#2d6a4f" />
      </div>
    );
  }

  if (error || !ctx) {
    return (
      <div className="pd-wizard-page">
        <button type="button" className="pd-back-btn" onClick={() => navigate(`${BASE}/manager`)}>
          <FaArrowLeft /> Back
        </button>
        <p>Could not load approval context.</p>
      </div>
    );
  }

  return (
    <div className="pd-wizard-page">
      <button type="button" className="pd-back-btn" onClick={() => navigate(`${BASE}/manager`)}>
        <FaArrowLeft /> Back
      </button>
      <h1>Approve plan #{planId}</h1>
      <p>{ctx.plan?.pickedDate} · Selected {selectedSum.toFixed(2)} Ha</p>

      <div className="pd-wizard-steps">
        {['Fields', 'Chemicals', 'Time'].map((label, idx) => (
          <span key={label} className={`pd-wizard-step${step === idx ? ' active' : ''}`}>{label}</span>
        ))}
      </div>

      {step === 0 ? (
        <div className="pd-wizard-panel">
          {usableFields.map((f) => (
            <label key={f.id} className="pd-wizard-check">
              <input
                type="checkbox"
                checked={selectedFieldIds.has(f.id)}
                onChange={() => toggleField(f.id)}
              />
              {f.field || f.short_name} · {parseFloat(f.area || 0).toFixed(2)} Ha
            </label>
          ))}
          <button type="button" className="pd-calendar-btn" onClick={() => setStep(1)} disabled={selectedFieldIds.size === 0}>
            Next: Chemicals
          </button>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="pd-wizard-panel">
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
                placeholder="Qty"
                value={line.quantity}
                onChange={(e) => {
                  const next = [...chemLines];
                  next[idx] = { ...next[idx], quantity: e.target.value };
                  setChemLines(next);
                }}
              />
            </div>
          ))}
          <button type="button" className="plantation-action-btn" onClick={() => setChemLines([...chemLines, { chemicalId: '', quantity: '' }])}>
            Add chemical
          </button>
          <div className="pd-form-actions">
            <button type="button" className="plantation-action-btn" onClick={() => setStep(0)}>Back</button>
            <button type="button" className="pd-calendar-btn" onClick={() => setStep(2)}>Next: Time</button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="pd-wizard-panel">
          <select value={timeOfDayId} onChange={(e) => setTimeOfDayId(e.target.value)}>
            <option value="">Time of day</option>
            {(Array.isArray(times) ? times : []).map((t) => (
              <option key={t.id} value={t.id}>{t.time_of_day || t.name}</option>
            ))}
          </select>
          <div className="pd-form-actions">
            <button type="button" className="plantation-action-btn" onClick={() => setStep(1)}>Back</button>
            <button type="button" className="pd-calendar-btn" disabled={submitting} onClick={handleSubmit}>
              {submitting ? 'Submitting…' : 'Approve plan'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
