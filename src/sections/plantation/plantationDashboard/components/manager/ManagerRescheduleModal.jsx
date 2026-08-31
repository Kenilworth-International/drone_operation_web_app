import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes } from 'react-icons/fa';
import { Bars } from 'react-loader-spinner';
import ManagerReasonList from './ManagerReasonList';
import { formatPlanDate, planReference } from './managerPlanUtils';

export default function ManagerRescheduleModal({
  open,
  plan,
  reasons = [],
  reasonsLoading = false,
  submitting = false,
  onClose,
  onConfirm,
}) {
  const [newDate, setNewDate] = useState('');
  const [selectedReasonId, setSelectedReasonId] = useState('');

  useEffect(() => {
    if (open && plan) {
      setNewDate('');
      setSelectedReasonId('');
    }
  }, [open, plan?.id]);

  if (!open || !plan) return null;

  const currentDate = String(plan.pickedDate || '').slice(0, 10);
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(newDate.trim());
  const canConfirm =
    dateValid &&
    newDate.trim() !== currentDate &&
    selectedReasonId &&
    !submitting &&
    !reasonsLoading;

  const modal = (
    <div className="pd-mgr-modal-overlay" role="presentation" onClick={submitting ? undefined : onClose}>
      <div
        className="pd-mgr-modal pd-mgr-modal--form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pd-mgr-reschedule-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="pd-mgr-modal-close pd-mgr-modal-close--corner"
          onClick={onClose}
          disabled={submitting}
          aria-label="Close"
        >
          <FaTimes />
        </button>

        <h2 id="pd-mgr-reschedule-title" className="pd-mgr-modal-title">
          Reschedule plan
        </h2>
        <p className="pd-mgr-modal-subtitle">{planReference(plan.id)}</p>
        <p className="pd-mgr-modal-hint">
          Current date: {formatPlanDate(plan.pickedDate)}. Choose a new date and reason for your request.
        </p>

        <div className="pd-mgr-modal-body">
          <label className="pd-mgr-field">
            <span className="pd-mgr-field-label">New date</span>
            <input
              type="date"
              value={newDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setNewDate(e.target.value)}
              disabled={submitting}
            />
          </label>

          <span className="pd-mgr-field-label">Reason</span>
          {reasonsLoading ? (
            <div className="pd-mgr-modal-loading pd-mgr-modal-loading--compact">
              <Bars height={20} width={32} color="#1b5e40" />
            </div>
          ) : (
            <ManagerReasonList
              reasons={reasons}
              selectedId={selectedReasonId}
              onSelect={setSelectedReasonId}
              name="reschedule-reason"
              disabled={submitting}
            />
          )}
        </div>

        <footer className="pd-mgr-modal-footer pd-mgr-modal-footer--split">
          <button type="button" className="pd-mgr-btn pd-mgr-btn--secondary" onClick={onClose} disabled={submitting}>
            Close
          </button>
          <button
            type="button"
            className="pd-mgr-btn pd-mgr-btn--primary"
            disabled={!canConfirm}
            onClick={() => onConfirm({ newDate: newDate.trim(), reasonId: Number(selectedReasonId) })}
          >
            {submitting ? 'Submitting…' : 'Submit request'}
          </button>
        </footer>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
