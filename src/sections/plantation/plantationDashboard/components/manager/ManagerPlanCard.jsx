import React from 'react';
import {
  allPlanStatus,
  formatExtentHa,
  formatPlanDate,
  missionLabel,
  planReference,
  formatBlockHint,
} from './managerPlanUtils';

function StatusBadge({ label, variant }) {
  return <span className={`pd-mgr-badge pd-mgr-badge--${variant}`}>{label}</span>;
}

function MissionBadge({ label }) {
  return <span className="pd-mgr-badge pd-mgr-badge--mission">{label}</span>;
}

export default function ManagerPlanCard({
  plan,
  mode = 'pending',
  onView,
  onApprove,
  onCancel,
  onReschedule,
  onEdit,
}) {
  const mission = missionLabel(plan.missionTypeId);
  const extent = formatExtentHa(plan.totalExtent);
  const dateLabel = formatPlanDate(plan.pickedDate);
  const approvable = Number(plan.can_approve) === 1;
  const status = mode === 'all' ? allPlanStatus(plan) : null;
  const accentVariant = mode === 'pending' ? (approvable ? 'ready' : 'hold') : status?.variant;

  return (
    <article className={`pd-mgr-card pd-mgr-card--${accentVariant || 'neutral'}`}>
      <div className="pd-mgr-card-accent" aria-hidden="true" />
      <div className="pd-mgr-card-body">
        <div className="pd-mgr-card-header">
          <div className="pd-mgr-card-header-main">
            <h3 className="pd-mgr-card-title">{planReference(plan.id)}</h3>
            <div className="pd-mgr-card-meta">
              <MissionBadge label={mission} />
              <span className="pd-mgr-card-date">{dateLabel}</span>
            </div>
          </div>
          {mode === 'pending' ? (
            <StatusBadge label={approvable ? 'Ready' : 'On hold'} variant={approvable ? 'approved' : 'pending'} />
          ) : status ? (
            <StatusBadge label={status.label} variant={status.variant} />
          ) : null}
        </div>

        {(plan.estate_name || extent) ? (
          <p className="pd-mgr-card-detail">
            {plan.estate_name ? <span>{plan.estate_name}</span> : null}
            {plan.estate_name && extent ? <span className="pd-mgr-card-dot">·</span> : null}
            {extent ? <span className="pd-mgr-card-extent">{extent}</span> : null}
          </p>
        ) : (
          <p className="pd-mgr-card-sub">Awaiting field selection and approval</p>
        )}

        {plan.approve_blocked_reason ? (
          <p className="pd-mgr-card-hint">{formatBlockHint(plan.approve_blocked_reason)}</p>
        ) : null}

        <div className="pd-mgr-card-actions">
          {mode === 'pending' ? (
            <>
              <button type="button" className="pd-mgr-btn pd-mgr-btn--secondary pd-mgr-btn--sm" onClick={() => onView?.(plan)}>
                View
              </button>
              <button type="button" className="pd-mgr-btn pd-mgr-btn--danger pd-mgr-btn--sm" onClick={() => onCancel?.(plan)}>
                Cancel
              </button>
              <button type="button" className="pd-mgr-btn pd-mgr-btn--secondary pd-mgr-btn--sm" onClick={() => onReschedule?.(plan)}>
                Reschedule
              </button>
              {approvable ? (
                <button type="button" className="pd-mgr-btn pd-mgr-btn--primary pd-mgr-btn--sm pd-mgr-btn--approve" onClick={() => onApprove?.(plan)}>
                  Approve
                </button>
              ) : null}
            </>
          ) : (
            <>
              <button type="button" className="pd-mgr-btn pd-mgr-btn--secondary pd-mgr-btn--sm" onClick={() => onView?.(plan)}>
                View
              </button>
              {Number(plan.can_edit) === 1 ? (
                <button type="button" className="pd-mgr-btn pd-mgr-btn--primary pd-mgr-btn--sm" onClick={() => onEdit?.(plan)}>
                  Edit
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </article>
  );
}
