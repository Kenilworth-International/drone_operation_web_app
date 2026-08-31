import React from 'react';
import { createPortal } from 'react-dom';
import { FaTimes } from 'react-icons/fa';
import { Bars } from 'react-loader-spinner';
import {
  formatPlanDate,
  missionLabel,
  planAreaFromDetail,
  planReference,
} from './managerPlanUtils';

export default function ManagerPlanDetailModal({
  open,
  planSummary,
  detail,
  loading,
  onClose,
  onEdit,
}) {
  if (!open || !planSummary) return null;

  const plan = detail?.plan || planSummary;
  const fields = detail?.fields || [];
  const chemicals = detail?.chemicalLines || detail?.chemicals || [];
  const totalArea = planAreaFromDetail(detail);
  const canEdit = Number(planSummary.can_edit) === 1 || detail?.canEdit === true;

  const modal = (
    <div className="pd-mgr-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="pd-mgr-modal pd-mgr-modal--detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pd-mgr-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pd-mgr-modal-header">
          <div>
            <h2 id="pd-mgr-detail-title" className="pd-mgr-modal-title">
              {planReference(planSummary.id)}
            </h2>
            <p className="pd-mgr-modal-subtitle">{formatPlanDate(plan.pickedDate || planSummary.pickedDate)}</p>
          </div>
          <button type="button" className="pd-mgr-modal-close" onClick={onClose} aria-label="Close">
            <FaTimes />
          </button>
        </header>

        <div className="pd-mgr-modal-chips">
          <span className="pd-mgr-badge pd-mgr-badge--mission">{missionLabel(planSummary.missionTypeId)}</span>
        </div>

        <div className="pd-mgr-modal-body">
          {loading ? (
            <div className="pd-mgr-modal-loading">
              <Bars height={28} width={40} color="#1b5e40" />
              <span>Loading plan…</span>
            </div>
          ) : (
            <>
              <div className="pd-mgr-detail-meta">
                <p>
                  Estate: <strong>{plan.estate_name || planSummary.estate_name || '—'}</strong>
                </p>
                {detail?.timeOfDayLabel ? (
                  <p>
                    Time of day: <strong>{detail.timeOfDayLabel}</strong>
                  </p>
                ) : null}
                <p>
                  Total field area: <strong>{totalArea > 0 ? `${totalArea.toFixed(2)} Ha` : '—'}</strong>
                </p>
              </div>

              <h3 className="pd-mgr-detail-section">Fields ({fields.length})</h3>
              {fields.length === 0 ? (
                <p className="pd-mgr-modal-muted">No active fields on this plan.</p>
              ) : (
                <ul className="pd-mgr-detail-list">
                  {fields.map((f) => (
                    <li key={f.pdf_id ?? f.fieldId ?? f.id} className="pd-mgr-detail-row">
                      <div>
                        <strong>{f.short_name || f.field || `Field ${f.fieldId}`}</strong>
                        {f.division_name ? <span className="pd-mgr-detail-sub">{f.division_name}</span> : null}
                      </div>
                      <span>{(Number(f.field_area ?? f.area) || 0).toFixed(2)} Ha</span>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="pd-mgr-detail-section">Chemicals ({chemicals.length})</h3>
              {chemicals.length === 0 ? (
                <p className="pd-mgr-modal-muted">No chemicals recorded.</p>
              ) : (
                <ul className="pd-mgr-detail-list">
                  {chemicals.map((c, idx) => (
                    <li key={`${c.chemicalId}-${idx}`} className="pd-mgr-detail-row">
                      <strong>{c.chemicalName || c.chemical || `Chemical #${c.chemicalId}`}</strong>
                      <span>{c.quantity} kg / Ha</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {canEdit && onEdit ? (
          <footer className="pd-mgr-modal-footer">
            <button
              type="button"
              className="pd-mgr-btn pd-mgr-btn--primary pd-mgr-btn--block"
              onClick={() => onEdit(planSummary.id)}
            >
              Edit fields &amp; chemicals
            </button>
          </footer>
        ) : null}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
