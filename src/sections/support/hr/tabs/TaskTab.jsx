import React, { useState } from 'react';
import ApprovalRequestCard from '../components/ApprovalRequestCard';
import RejectModal from '../components/RejectModal';
import { getApprovalKind } from '../utils/hrApprovals';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(String(value).slice(0, 10) + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
}

export default function TaskTab({ hodApprovals, actApproval, refreshing, refresh }) {
  const [rejectModal, setRejectModal] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const submitReject = async () => {
    if (!rejectModal?.reason?.trim()) return;
    try {
      await actApproval(
        rejectModal.requestId,
        'reject',
        rejectModal.reason.trim(),
        rejectModal.kind || 'leave',
      );
      setRejectModal(null);
    } catch { /* actApproval sets error */ }
  };

  return (
    <div>
      {rejectModal && (
        <RejectModal
          value={rejectModal.reason}
          onChange={(v) => setRejectModal((m) => ({ ...m, reason: v }))}
          onSubmit={submitReject}
          onClose={() => setRejectModal(null)}
        />
      )}
      {previewUrl && (
        <div className="hrsup-modal-overlay" onClick={() => setPreviewUrl(null)}>
          <div className="hrsup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hrsup-modal-head">
              <h3 className="hrsup-modal-title">Attachment</h3>
              <button type="button" className="hrsup-modal-close" onClick={() => setPreviewUrl(null)}>✕</button>
            </div>
            <div className="hrsup-modal-body" style={{ textAlign: 'center' }}>
              <img src={previewUrl} alt="attachment" style={{ maxWidth: '100%', maxHeight: 360, borderRadius: 8 }} />
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>HOD Approvals</h2>
          <p className="hrsup-leave-section-hint" style={{ margin: '4px 0 0' }}>
            {hodApprovals.length > 0
              ? `${hodApprovals.length} pending request${hodApprovals.length === 1 ? '' : 's'} awaiting your decision`
              : 'No pending approvals in your HOD queue'}
          </p>
        </div>
        <button type="button" className="hrsup-refresh-btn" onClick={refresh} disabled={refreshing}><span className={refreshing ? 'hrsup-spin' : ''}>↻</span></button>
      </div>

      {hodApprovals.length === 0 ? (
        <div className="hrsup-notice-box hrsup-notice-box--info">When team members submit leave or late departure requests, they will appear here.</div>
      ) : (
        <div className="hrsup-leave-approve-list">
          {hodApprovals.map((req) => {
            const kind = getApprovalKind(req);
            return (
              <ApprovalRequestCard
                key={`${kind}-${req.id}`}
                item={req}
                formatDate={formatDate}
                onApprove={() => actApproval(req.id, 'approve', undefined, kind)}
                onReject={() => setRejectModal({ requestId: req.id, reason: '', kind })}
                onPreviewAttachment={setPreviewUrl}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
