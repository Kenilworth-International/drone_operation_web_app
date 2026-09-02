import React from 'react';
import {
  getApprovalAttachments,
  getApprovalDateDisplay,
  getApprovalEmployeePhotoUrl,
  getApprovalModeLabel,
  getApprovalStageLabel,
  getApprovalTypeBadge,
} from '../utils/hrApprovals';

function getInitials(name) {
  return String(name || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function ApprovalRequestCard({
  item,
  formatDate,
  onApprove,
  onReject,
  onPreviewAttachment,
}) {
  const attachments = getApprovalAttachments(item);
  const typeBadge = getApprovalTypeBadge(item);
  const modeLabel = getApprovalModeLabel(item);
  const dateLabel = getApprovalDateDisplay(item, formatDate);
  const stageLabel = getApprovalStageLabel(item);
  const photoUrl = getApprovalEmployeePhotoUrl(item);
  const metaLine = [
    item?.id ? `#${item.id}` : null,
    typeBadge,
    dateLabel,
    modeLabel,
  ].filter(Boolean).join(' · ');

  const openAttachment = (file) => {
    if (!file?.url) return;
    if (file.isImage) {
      onPreviewAttachment?.(file.url);
      return;
    }
    window.open(file.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="hrsup-approval-card">
      <div className="hrsup-approval-card__top">
        <div className="hrsup-approval-card__person">
          <div className="hrsup-approval-card__avatar">
            {photoUrl ? (
              <img src={photoUrl} alt="" className="hrsup-approval-card__avatar-img" />
            ) : (
              getInitials(item?.employeeName || item?.employee_name)
            )}
          </div>
          <div className="hrsup-approval-card__person-meta">
            <div className="hrsup-approval-card__name">{item?.employeeName || item?.employee_name || 'Employee'}</div>
            <div className="hrsup-approval-card__sub">
              {item?.empNo ? `Emp ${item.empNo}` : 'Employee'}
            </div>
          </div>
        </div>
        <span className="hrsup-approval-card__status">{stageLabel}</span>
      </div>

      <p className="hrsup-approval-card__meta">{metaLine}</p>

      {item?.reason && (
        <p className="hrsup-approval-card__reason-text">{item.reason}</p>
      )}

      {attachments.length > 0 && (
        <div className="hrsup-approval-card__attachments">
          {attachments.map((file, i) => (
            <button
              key={`${item.id}-att-${i}`}
              type="button"
              className="hrsup-approval-card__attachment"
              onClick={() => openAttachment(file)}
              title={file.filename || `Attachment ${i + 1}`}
            >
              {file.isImage && file.url ? (
                <img src={file.url} alt={file.filename || `Attachment ${i + 1}`} className="hrsup-approval-card__attachment-img" />
              ) : (
                <span className="hrsup-approval-card__attachment-file">
                  {file.isPdf ? 'PDF' : 'File'}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="hrsup-approval-card__actions">
        <button type="button" className="hrsup-approval-card__btn hrsup-approval-card__btn--approve" onClick={onApprove}>
          Approve
        </button>
        <button type="button" className="hrsup-approval-card__btn hrsup-approval-card__btn--reject" onClick={onReject}>
          Reject
        </button>
      </div>
    </div>
  );
}
