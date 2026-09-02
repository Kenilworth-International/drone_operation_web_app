import React from 'react';

export default function RejectModal({ title = 'Reject Request', message = 'Provide a reason before rejecting.', value, onChange, onSubmit, onClose, loading }) {
  return (
    <div className="hrsup-modal-overlay" onClick={onClose}>
      <div className="hrsup-modal hrsup-modal--sm" onClick={(e) => e.stopPropagation()}>
        <div className="hrsup-modal-head">
          <h3 className="hrsup-modal-title">{title}</h3>
          <button type="button" className="hrsup-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="hrsup-modal-body">
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>{message}</p>
          <div className="hrsup-field">
            <label className="hrsup-label">Reason</label>
            <textarea
              className="hrsup-input"
              rows={3}
              placeholder="Enter reason…"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              disabled={loading}
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>
        <div className="hrsup-modal-foot">
          <button type="button" className="hrsup-btn hrsup-btn--secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="button" className="hrsup-btn hrsup-btn--danger" onClick={onSubmit} disabled={!value?.trim() || loading}>
            {loading ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
