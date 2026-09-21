import React from 'react';
import { FaTimes } from 'react-icons/fa';

const TITLES = {
  decline: 'Decline incident report',
  start_investigation: 'Start investigation',
  investigation_notes: 'Update investigation notes',
  submit_review: 'Submit investigation for review',
  complete_investigation: 'Complete investigation',
  approve: 'Approve for technician',
  repair: 'Approve for technician',
};

export default function ActionModal({
  actionType,
  form,
  technicians,
  onChange,
  onClose,
  onSubmit,
}) {
  const title = TITLES[actionType] || 'Incident action';
  const isDecline = actionType === 'decline';
  const isApprove = actionType === 'approve' || actionType === 'repair';
  const isStartInv = actionType === 'start_investigation';
  const isNotes = actionType === 'investigation_notes';
  const isSubmitReview = actionType === 'submit_review';
  const isCompleteInv = actionType === 'complete_investigation';

  return (
    <div className="accidentreports-modal-overlay" role="presentation">
      <div className="accidentreports-modal-content accidentreports-modal-content--action" role="dialog" aria-modal="true">
        <div className="accidentreports-modal-header">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} className="accidentreports-modal-close" aria-label="Close">
            <FaTimes />
          </button>
        </div>
        <form onSubmit={onSubmit} className="accidentreports-action-form">
          {isDecline ? (
            <div className="accidentreports-form-group">
              <label htmlFor="decline-reason">Decline reason *</label>
              <textarea
                id="decline-reason"
                value={form.decline_reason}
                onChange={(e) => onChange({ ...form, decline_reason: e.target.value })}
                required
                className="accidentreports-form-textarea"
                rows="4"
                placeholder="Enter reason for declining this incident"
              />
            </div>
          ) : null}

          {isStartInv || isNotes ? (
            <div className="accidentreports-form-group">
              <label htmlFor="inv-notes">
                Investigation notes {isNotes ? '*' : '(optional)'}
              </label>
              <textarea
                id="inv-notes"
                value={form.notes}
                onChange={(e) => onChange({ ...form, notes: e.target.value })}
                required={isNotes}
                className="accidentreports-form-textarea"
                rows="4"
                placeholder="Record unusual findings, pilot fault indicators, etc."
              />
            </div>
          ) : null}

          {isSubmitReview ? (
            <p className="accidentreports-action-hint">
              Move this investigation to review so findings can be finalized. You can still approve for technician while investigation continues.
            </p>
          ) : null}

          {isCompleteInv ? (
            <div className="accidentreports-form-group">
              <label htmlFor="inv-findings">Investigation findings *</label>
              <textarea
                id="inv-findings"
                value={form.findings}
                onChange={(e) => onChange({ ...form, findings: e.target.value })}
                required
                className="accidentreports-form-textarea"
                rows="4"
                placeholder="Final investigation findings"
              />
            </div>
          ) : null}

          {isApprove ? (
            <>
              <p className="accidentreports-action-hint">
                Approval sends this incident to Maintenance for the technician. Investigation may continue in parallel if still open.
              </p>
              <div className="accidentreports-form-group">
                <label htmlFor="technician-id">Technician *</label>
                <select
                  id="technician-id"
                  value={form.technician_id}
                  onChange={(e) => onChange({ ...form, technician_id: e.target.value })}
                  required
                  className="accidentreports-form-select"
                >
                  <option value="">Select technician</option>
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="accidentreports-form-group">
                <label htmlFor="maintenance-description">Suggestions / instructions *</label>
                <textarea
                  id="maintenance-description"
                  value={form.description}
                  onChange={(e) => onChange({ ...form, description: e.target.value })}
                  required
                  className="accidentreports-form-textarea"
                  rows="4"
                  placeholder="Guidance for the technician"
                />
              </div>
              <div className="accidentreports-form-group">
                <label htmlFor="scheduled-date">Scheduled date *</label>
                <input
                  id="scheduled-date"
                  type="date"
                  value={form.scheduled_date}
                  onChange={(e) => onChange({ ...form, scheduled_date: e.target.value })}
                  required
                  className="accidentreports-form-input"
                />
              </div>
            </>
          ) : null}

          <div className="accidentreports-form-actions">
            <button type="button" onClick={onClose} className="accidentreports-button-secondary">
              Cancel
            </button>
            <button type="submit" className="accidentreports-button-primary">
              {isDecline
                ? 'Decline report'
                : isApprove
                  ? 'Approve & send to technician'
                  : isCompleteInv
                    ? 'Complete investigation'
                    : isSubmitReview
                      ? 'Submit for review'
                      : isStartInv
                        ? 'Start investigation'
                        : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
