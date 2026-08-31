import React from 'react';

export default function ManagerReasonList({
  reasons = [],
  selectedId,
  onSelect,
  name = 'manager-reason',
  disabled = false,
}) {
  if (!reasons.length) {
    return <p className="pd-mgr-modal-empty">No reasons are available right now.</p>;
  }

  return (
    <div className="pd-mgr-reason-list" role="radiogroup">
      {reasons.map((reason) => {
        const id = Number(reason.id);
        const label = reason.recen || reason.reason || `Reason ${id}`;
        const checked = String(selectedId) === String(id);
        return (
          <label
            key={id}
            className={`pd-mgr-reason-item${checked ? ' pd-mgr-reason-item--selected' : ''}`}
          >
            <input
              type="radio"
              name={name}
              value={id}
              checked={checked}
              disabled={disabled}
              onChange={() => onSelect(id)}
            />
            <span>{label}</span>
          </label>
        );
      })}
    </div>
  );
}
