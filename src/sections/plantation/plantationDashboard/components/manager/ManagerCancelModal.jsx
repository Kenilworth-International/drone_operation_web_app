import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes } from 'react-icons/fa';
import { Bars } from 'react-loader-spinner';
import ManagerReasonList from './ManagerReasonList';
import { planReference } from './managerPlanUtils';

export default function ManagerCancelModal({
  open,
  planId,
  reasons = [],
  reasonsLoading = false,
  submitting = false,
  onClose,
  onConfirm,
}) {
  const [selectedReasonId, setSelectedReasonId] = useState('');

  useEffect(() => {
    if (open) setSelectedReasonId('');
  }, [open, planId]);

  if (!open || !planId) return null;

  const canConfirm = selectedReasonId && !submitting && !reasonsLoading;

  const modal = (
    <div className="pd-mgr-modal-overlay" role="presentation" onClick={submitting ? undefined : onClose}>
      <div
        className="pd-mgr-modal pd-mgr-modal--form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pd-mgr-cancel-title"
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

        <h2 id="pd-mgr-cancel-title" className="pd-mgr-modal-title pd-mgr-modal-title--center">
          Cancel plan
        </h2>
        <p className="pd-mgr-modal-subtitle pd-mgr-modal-subtitle--center">{planReference(planId)}</p>
        <p className="pd-mgr-modal-hint">Select a reason for cancelling this plan.</p>

        <div className="pd-mgr-modal-body pd-mgr-modal-body--scroll">
          {reasonsLoading ? (
            <div className="pd-mgr-modal-loading">
              <Bars height={24} width={36} color="#1b5e40" />
              <span>Loading reasons…</span>
            </div>
          ) : (
            <ManagerReasonList
              reasons={reasons}
              selectedId={selectedReasonId}
              onSelect={setSelectedReasonId}
              name="cancel-reason"
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
            className="pd-mgr-btn pd-mgr-btn--danger-solid"
            disabled={!canConfirm}
            onClick={() => onConfirm(Number(selectedReasonId))}
          >
            {submitting ? 'Cancelling…' : 'Confirm cancel'}
          </button>
        </footer>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
