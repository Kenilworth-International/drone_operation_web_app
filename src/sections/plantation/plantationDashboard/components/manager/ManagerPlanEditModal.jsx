import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { Bars } from 'react-loader-spinner';
import {
  useGetManagerPlanEditContextQuery,
  useSubmitManagerPlanEditMutation,
  useGetManagerFieldRemoveReasonsQuery,
} from '../../../../../api/services NodeJs/plantationEstateManagerApi';
import { useGetChemicalsQuery } from '../../../../../api/services NodeJs/chemicalsApi';
import { useGetTimeOfDaysQuery } from '../../../../../api/services NodeJs/timeOfDaysApi';
import ManagerPlanFieldsStep, { useManagerFieldStepValidation } from './ManagerPlanFieldsStep';
import ManagerReasonList from './ManagerReasonList';
import { formatPlanDate, planReference } from './managerPlanUtils';
import {
  computeOverageCharge,
  filterChemicalsForMission,
  formatCharge,
  getMaxChemicalKgPerHa,
  getMissionBillingRate,
  isChemicalAllowanceEnforced,
  sumChemicalKgPerHa,
} from './chemicalBilling';

const STEPS = [
  { key: 'fields', label: 'Fields' },
  { key: 'chemicals', label: 'Chemicals' },
  { key: 'time', label: 'Time' },
];

export default function ManagerPlanEditModal({ open, planId, onClose, onSuccess }) {
  const [step, setStep] = useState(0);
  const [selectedFieldIds, setSelectedFieldIds] = useState(() => new Set());
  const [chemLines, setChemLines] = useState([{ chemicalId: '', quantity: '' }]);
  const [timeOfDayId, setTimeOfDayId] = useState('');
  const [overagePrompt, setOveragePrompt] = useState(null);
  const [removeReasonOpen, setRemoveReasonOpen] = useState(false);
  const [removeReasonId, setRemoveReasonId] = useState('');
  const initialFieldIdsRef = useRef([]);

  const { data: ctxRaw, isLoading, error, isFetching } = useGetManagerPlanEditContextQuery(planId, {
    skip: !open || !planId,
  });
  const ctx = ctxRaw?.data || ctxRaw;
  const missionTypeId = ctx?.plan?.missionTypeId;
  const startedIds = useMemo(() => new Set((ctx?.startedFieldIds || []).map(Number)), [ctx?.startedFieldIds]);

  const { data: chemicalsRaw } = useGetChemicalsQuery(undefined, { skip: !open || step !== 1 });
  const { data: timesRaw } = useGetTimeOfDaysQuery(undefined, { skip: !open || step !== 2 });
  const { data: removeReasonsRaw, isLoading: removeReasonsLoading } = useGetManagerFieldRemoveReasonsQuery(
    undefined,
    { skip: !open || !removeReasonOpen }
  );
  const chemicals = useMemo(
    () => filterChemicalsForMission(chemicalsRaw?.data || chemicalsRaw || [], missionTypeId),
    [chemicalsRaw, missionTypeId]
  );
  const times = timesRaw?.data || timesRaw || [];
  const removeReasons = removeReasonsRaw?.data || removeReasonsRaw || [];
  const [submitEdit, { isLoading: submitting }] = useSubmitManagerPlanEditMutation();

  const fieldValidation = useManagerFieldStepValidation(ctx, missionTypeId, selectedFieldIds);

  useEffect(() => {
    if (!open) {
      setStep(0);
      setSelectedFieldIds(new Set());
      setChemLines([{ chemicalId: '', quantity: '' }]);
      setTimeOfDayId('');
      setOveragePrompt(null);
      setRemoveReasonOpen(false);
      setRemoveReasonId('');
      initialFieldIdsRef.current = [];
    }
  }, [open, planId]);

  useEffect(() => {
    if (!ctx || !open) return;
    const initial = (ctx.selectedFieldIds || ctx.activePlanFields?.map((f) => f.fieldId || f.id) || [])
      .map(Number)
      .filter(Boolean);
    initialFieldIdsRef.current = initial;
    if (initial.length) setSelectedFieldIds(new Set(initial));
    if (ctx.timeOfDayId) setTimeOfDayId(String(ctx.timeOfDayId));
    if (ctx.chemicalLines?.length) {
      setChemLines(
        ctx.chemicalLines.map((l) => ({
          chemicalId: String(l.chemicalId),
          quantity: String(l.quantity),
        }))
      );
    } else {
      setChemLines([{ chemicalId: '', quantity: '' }]);
    }
  }, [ctx, open]);

  const getRemovedFieldIds = () => {
    const initial = new Set(initialFieldIdsRef.current);
    return [...initial].filter((id) => !selectedFieldIds.has(id));
  };

  const toggleField = (id) => {
    if (startedIds.has(id)) return;
    setSelectedFieldIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const validateChemsStep = () => {
    const lines = chemLines.filter((l) => l.chemicalId && String(l.quantity).trim() !== '');
    if (lines.length === 0) {
      toast.warning('Add at least one chemical with quantity.');
      return false;
    }
    for (const l of lines) {
      const q = Number(l.quantity);
      if (!Number.isFinite(q) || q <= 0) {
        toast.warning('Each chemical needs a quantity greater than zero.');
        return false;
      }
    }
    return true;
  };

  const proceedFromChemicalsStep = () => {
    setOveragePrompt(null);
    setStep(2);
  };

  const goNext = () => {
    if (step === 0) {
      if (!fieldValidation.valid) {
        toast.warning(fieldValidation.message);
        return;
      }
      for (const id of startedIds) {
        if (!selectedFieldIds.has(id)) {
          toast.warning('Fields where the pilot has started cannot be removed.');
          return;
        }
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!validateChemsStep()) return;
      const total = sumChemicalKgPerHa(chemLines);
      const maxKg = getMaxChemicalKgPerHa(ctx?.plantation, missionTypeId);
      if (isChemicalAllowanceEnforced(missionTypeId) && maxKg != null && total > maxKg) {
        const billing = getMissionBillingRate(ctx?.plantation, missionTypeId);
        const charge = computeOverageCharge(billing.rate, total, maxKg);
        const chargeLine =
          billing.rate != null && charge != null
            ? ` Estimated charge: (${formatCharge(billing.rate)} ÷ ${formatCharge(maxKg)}) × ${formatCharge(total)} = ${formatCharge(charge)}.`
            : '';
        setOveragePrompt({ total, maxKg, chargeLine });
        return;
      }
      proceedFromChemicalsStep();
    }
  };

  const goBack = () => {
    setOveragePrompt(null);
    if (step === 0) onClose();
    else setStep((s) => s - 1);
  };

  const buildPayload = (reasonId) => {
    const fieldIds = Array.from(selectedFieldIds);
    const chemicalsPayload = chemLines
      .filter((l) => l.chemicalId && l.quantity)
      .map((l) => ({ chemicalId: Number(l.chemicalId), quantity: parseFloat(l.quantity) }));
    return {
      planId: Number(planId),
      fieldIds,
      timeOfDayId: Number(timeOfDayId),
      chemicals: chemicalsPayload,
      ...(reasonId ? { removeReasonId: Number(reasonId) } : {}),
    };
  };

  const performSave = async (reasonId) => {
    try {
      await submitEdit(buildPayload(reasonId)).unwrap();
      toast.success('Plan updated.');
      setRemoveReasonOpen(false);
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Update failed.');
    }
  };

  const handleSubmit = async () => {
    if (!timeOfDayId) {
      toast.warning('Select a time of day.');
      return;
    }
    const removed = getRemovedFieldIds();
    if (removed.length > 0) {
      setRemoveReasonOpen(true);
      return;
    }
    await performSave();
  };

  const handleConfirmRemoveReason = async () => {
    if (!removeReasonId) {
      toast.warning('Select a reason for removing fields.');
      return;
    }
    await performSave(removeReasonId);
  };

  if (!open || !planId) return null;

  const loading = isLoading || isFetching;
  const notEditable = error || !ctx || ctx.editable === false;
  const errorMessage =
    error?.data?.message ||
    error?.data?.error ||
    (notEditable && !loading ? 'This plan cannot be edited.' : null);

  const canGoNext =
    step === 0
      ? fieldValidation.valid
      : step === 1
        ? chemLines.some((l) => l.chemicalId && Number(l.quantity) > 0)
        : true;

  const modal = (
    <>
      <div className="pd-mgr-modal-overlay" role="presentation" onClick={submitting ? undefined : onClose}>
        <div
          className="pd-mgr-modal pd-mgr-modal--wizard"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pd-mgr-edit-title"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="pd-mgr-modal-header pd-mgr-modal-header--wizard">
            <div>
              <h2 id="pd-mgr-edit-title" className="pd-mgr-modal-title">
                Edit {planReference(planId)}
              </h2>
              {ctx?.plan?.pickedDate ? (
                <p className="pd-mgr-modal-subtitle">{formatPlanDate(ctx.plan.pickedDate)}</p>
              ) : null}
            </div>
            <button
              type="button"
              className="pd-mgr-modal-close"
              onClick={onClose}
              disabled={submitting}
              aria-label="Close"
            >
              <FaTimes />
            </button>
          </header>

          <ol className="pd-mgr-wizard-steps pd-mgr-wizard-steps--modal" aria-label="Progress">
            {STEPS.map((s, idx) => (
              <li
                key={s.key}
                className={`pd-mgr-wizard-step pd-mgr-wizard-step--${idx < step ? 'done' : idx === step ? 'active' : 'upcoming'}`}
              >
                <span className="pd-mgr-wizard-step-index">{idx + 1}</span>
                <span className="pd-mgr-wizard-step-label">{s.label}</span>
              </li>
            ))}
          </ol>

          <div className="pd-mgr-modal-body pd-mgr-modal-body--wizard">
            {loading ? (
              <div className="pd-mgr-modal-loading">
                <Bars height={28} width={40} color="#1b5e40" />
                <span>Loading plan…</span>
              </div>
            ) : notEditable ? (
              <p className="pd-mgr-area-hint pd-mgr-area-hint--error">{errorMessage}</p>
            ) : (
              <>
                {step === 0 ? (
                  <ManagerPlanFieldsStep
                    ctx={ctx}
                    missionTypeId={missionTypeId}
                    selectedFieldIds={selectedFieldIds}
                    onToggleField={toggleField}
                    startedFieldIds={startedIds}
                  />
                ) : null}

                {step === 1 ? (
                  <>
                    <p className="pd-mgr-wizard-intro">Update chemicals and quantities (kg per Ha).</p>
                    {chemLines.map((line, idx) => (
                      <div key={idx} className="pd-mgr-chem-row">
                        <select
                          value={line.chemicalId}
                          onChange={(e) => {
                            const next = [...chemLines];
                            next[idx] = { ...next[idx], chemicalId: e.target.value };
                            setChemLines(next);
                          }}
                        >
                          <option value="">Select chemical</option>
                          {chemicals.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.chemical || c.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Qty (kg/Ha)"
                          value={line.quantity}
                          onChange={(e) => {
                            const next = [...chemLines];
                            next[idx] = { ...next[idx], quantity: e.target.value };
                            setChemLines(next);
                          }}
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      className="pd-mgr-btn pd-mgr-btn--ghost"
                      onClick={() => setChemLines([...chemLines, { chemicalId: '', quantity: '' }])}
                    >
                      + Add chemical
                    </button>
                    {overagePrompt ? (
                      <div className="pd-mgr-overage-box">
                        <p>
                          Allowance is {formatCharge(overagePrompt.maxKg)} kg per Ha. Your total is{' '}
                          {formatCharge(overagePrompt.total)} kg per Ha.
                          {overagePrompt.chargeLine}
                        </p>
                        <div className="pd-mgr-overage-actions">
                          <button
                            type="button"
                            className="pd-mgr-btn pd-mgr-btn--secondary"
                            onClick={() => setOveragePrompt(null)}
                          >
                            Go back
                          </button>
                          <button
                            type="button"
                            className="pd-mgr-btn pd-mgr-btn--primary"
                            onClick={proceedFromChemicalsStep}
                          >
                            Continue anyway
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}

                {step === 2 ? (
                  <>
                    <p className="pd-mgr-wizard-intro">Choose when this mission should run.</p>
                    <div className="pd-mgr-time-list">
                      {(Array.isArray(times) ? times : []).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className={`pd-mgr-time-option${String(timeOfDayId) === String(t.id) ? ' pd-mgr-time-option--on' : ''}`}
                          onClick={() => setTimeOfDayId(String(t.id))}
                        >
                          {t.time_of_day || t.name || `Time #${t.id}`}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
              </>
            )}
          </div>

          {!loading && ctx && !notEditable ? (
            <footer className="pd-mgr-modal-footer pd-mgr-modal-footer--split">
              <button type="button" className="pd-mgr-btn pd-mgr-btn--secondary" onClick={goBack} disabled={submitting}>
                {step === 0 ? 'Close' : 'Back'}
              </button>
              {step < 2 ? (
                <button
                  type="button"
                  className="pd-mgr-btn pd-mgr-btn--primary"
                  onClick={goNext}
                  disabled={!canGoNext || Boolean(overagePrompt)}
                >
                  Next: {STEPS[step + 1].label}
                </button>
              ) : (
                <button
                  type="button"
                  className="pd-mgr-btn pd-mgr-btn--primary"
                  disabled={submitting || !timeOfDayId}
                  onClick={handleSubmit}
                >
                  {submitting ? 'Saving…' : 'Save changes'}
                </button>
              )}
            </footer>
          ) : (
            <footer className="pd-mgr-modal-footer">
              <button type="button" className="pd-mgr-btn pd-mgr-btn--secondary pd-mgr-btn--block" onClick={onClose}>
                Close
              </button>
            </footer>
          )}
        </div>
      </div>

      {removeReasonOpen ? (
        <div
          className="pd-mgr-modal-overlay pd-mgr-modal-overlay--nested"
          role="presentation"
          onClick={submitting ? undefined : () => setRemoveReasonOpen(false)}
        >
          <div
            className="pd-mgr-modal pd-mgr-modal--form"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pd-mgr-remove-reason-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="pd-mgr-modal-close pd-mgr-modal-close--corner"
              onClick={() => setRemoveReasonOpen(false)}
              disabled={submitting}
              aria-label="Close"
            >
              <FaTimes />
            </button>
            <h2 id="pd-mgr-remove-reason-title" className="pd-mgr-modal-title pd-mgr-modal-title--center">
              Field remove reason
            </h2>
            <p className="pd-mgr-modal-hint">Select a reason for removing fields from this plan.</p>
            <div className="pd-mgr-modal-body pd-mgr-modal-body--scroll">
              {removeReasonsLoading ? (
                <div className="pd-mgr-modal-loading">
                  <Bars height={24} width={36} color="#1b5e40" />
                  <span>Loading reasons…</span>
                </div>
              ) : (
                <ManagerReasonList
                  reasons={Array.isArray(removeReasons) ? removeReasons : []}
                  selectedId={removeReasonId}
                  onSelect={setRemoveReasonId}
                  name="field-remove-reason"
                  disabled={submitting}
                />
              )}
            </div>
            <footer className="pd-mgr-modal-footer pd-mgr-modal-footer--split">
              <button
                type="button"
                className="pd-mgr-btn pd-mgr-btn--secondary"
                onClick={() => setRemoveReasonOpen(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="pd-mgr-btn pd-mgr-btn--primary"
                disabled={!removeReasonId || submitting || removeReasonsLoading}
                onClick={handleConfirmRemoveReason}
              >
                {submitting ? 'Saving…' : 'Save changes'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
