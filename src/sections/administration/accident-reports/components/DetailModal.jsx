import React from 'react';
import {
  FaDownload,
  FaExpand,
  FaImage,
  FaMicrophone,
  FaTimes,
  FaVideo,
} from 'react-icons/fa';
import { getResourceUrl } from '../utils/media';
import { formatDate, formatTime, getActionStatus, getEquipmentLabel } from '../utils/formatters';
import StatusBadge from './StatusBadge';

function ImageAttachment({ label, url, filename, onView, onDownload }) {
  if (!url) return null;
  return (
    <article className="accidentreports-attachment-card">
      <div className="accidentreports-media-label">
        <FaImage className="accidentreports-media-icon accidentreports-media-icon--image" aria-hidden />
        <strong>{label}</strong>
        <button
          type="button"
          onClick={() => onDownload(url, filename)}
          className="accidentreports-download-btn"
          title={`Download ${label}`}
        >
          <FaDownload />
        </button>
      </div>
      <button type="button" className="accidentreports-image-wrapper" onClick={() => onView(url)}>
        <img
          src={getResourceUrl(url)}
          alt={label}
          className="accidentreports-modal-image"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const errorDiv = e.currentTarget.parentElement?.querySelector('.accidentreports-image-error');
            if (errorDiv) errorDiv.style.display = 'flex';
          }}
        />
        <span className="accidentreports-image-overlay">
          <FaExpand />
        </span>
        <span className="accidentreports-image-error" style={{ display: 'none' }}>
          <FaImage />
          <p>Could not load</p>
        </span>
      </button>
    </article>
  );
}

function VoiceAttachment({ label, url, filename, onDownload }) {
  if (!url) return null;
  return (
    <article className="accidentreports-attachment-card accidentreports-audio-item">
      <div className="accidentreports-media-label">
        <FaMicrophone className="accidentreports-media-icon accidentreports-media-icon--voice" aria-hidden />
        <strong>{label}</strong>
        <button
          type="button"
          onClick={() => onDownload(url, filename, 'ACCIDENT_VOICE')}
          className="accidentreports-download-btn"
          title={`Download ${label}`}
        >
          <FaDownload />
        </button>
      </div>
      <div className="accidentreports-audio-wrapper">
        <audio
          controls
          className="accidentreports-modal-audio"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const errorDiv = e.currentTarget.parentElement?.querySelector('.accidentreports-audio-error');
            if (errorDiv) errorDiv.style.display = 'flex';
          }}
        >
          <source src={getResourceUrl(url, 'ACCIDENT_VOICE')} type="audio/mp4" />
          <source src={getResourceUrl(url, 'ACCIDENT_VOICE')} type="audio/mpeg" />
        </audio>
        <div className="accidentreports-audio-error" style={{ display: 'none' }}>
          <FaMicrophone />
          <p>Could not load</p>
        </div>
      </div>
    </article>
  );
}

function DetailField({ label, value }) {
  return (
    <div className="accidentreports-detail-field">
      <span className="accidentreports-detail-label">{label}</span>
      <span className="accidentreports-detail-value">{value}</span>
    </div>
  );
}

export default function DetailModal({
  report,
  isLoading,
  onClose,
  onViewImage,
  onDownload,
}) {
  if (!report) return null;

  const status = getActionStatus(report);
  const declineReason = report.decline_reason || report.declineReason;

  return (
    <div className="accidentreports-modal-overlay" role="presentation">
      <div
        className="accidentreports-modal-content accidentreports-modal-content--detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="incident-detail-title"
      >
        <div className="accidentreports-modal-header">
          <div>
            <h2 id="incident-detail-title">Incident #{report.id}</h2>
            <p className="accidentreports-modal-subtitle">
              {formatDate(report.date)} · {formatTime(report.time)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="accidentreports-modal-close" aria-label="Close">
            <FaTimes />
          </button>
        </div>

        {isLoading ? (
          <p className="accidentreports-modal-loading">Loading report details…</p>
        ) : (
          <>
            <section className="accidentreports-detail-section">
              <div className="accidentreports-detail-section-header">
                <h3>Report information</h3>
                <StatusBadge report={report} />
              </div>
              <div className="accidentreports-detail-grid">
                <DetailField label="Pilot" value={report.pilot_name || 'N/A'} />
                <DetailField label="Estate" value={report.estate_name || 'N/A'} />
                <DetailField
                  label="Task"
                  value={report.task_id ? `Task #${report.task_id}` : 'N/A'}
                />
                <DetailField label="Incident type" value={report.incident_type_name || 'N/A'} />
                <DetailField label="Equipment" value={getEquipmentLabel(report)} />
                <DetailField label="Device serial" value={report.device_serial || 'N/A'} />
                <DetailField label="Review status" value={status.label} />
              </div>
              {declineReason ? (
                <div className="accidentreports-decline-reason">
                  <strong>Decline reason</strong>
                  <p>{declineReason}</p>
                </div>
              ) : null}
            </section>

            <section className="accidentreports-detail-section">
              <h3>Investigation & approval</h3>
              <p style={{ marginTop: 0, color: '#5b6b7c', fontSize: 13 }}>
                Formal investigations run in HR from Fleet recommendations. Workshop must submit the accident report before HR can open a case.
              </p>
              <div className="accidentreports-detail-grid">
                <DetailField
                  label="Investigation (legacy)"
                  value={
                    report.investigation_status === 'i'
                      ? 'In progress'
                      : report.investigation_status === 'v'
                        ? 'Under review'
                        : report.investigation_status === 'c'
                          ? 'Complete'
                          : Number(report.investigation_required) === 1
                            ? 'Required'
                            : 'Not required / skipped'
                  }
                />
                <DetailField
                  label="Approved"
                  value={report.approved_at ? formatDate(report.approved_at) : 'Not yet'}
                />
                <DetailField
                  label="Maintenance"
                  value={
                    report.maintenanceId || report.maintenance_id
                      ? `#${report.maintenanceId || report.maintenance_id}`
                      : '—'
                  }
                />
              </div>
              {report.investigation_notes ? (
                <div className="accidentreports-decline-reason">
                  <strong>Investigation notes</strong>
                  <p>{report.investigation_notes}</p>
                </div>
              ) : null}
              {report.investigation_findings ? (
                <div className="accidentreports-decline-reason">
                  <strong>Investigation findings</strong>
                  <p>{report.investigation_findings}</p>
                </div>
              ) : null}
              {report.approval_suggestions ? (
                <div className="accidentreports-decline-reason">
                  <strong>Technician suggestions</strong>
                  <p>{report.approval_suggestions}</p>
                </div>
              ) : null}
            </section>

            <section className="accidentreports-detail-section">
              <h3>Attachments</h3>

              <div className="accidentreports-attachment-group">
                <h4>Images</h4>
                <div className="accidentreports-attachment-row">
                  <ImageAttachment
                    label="Image 1"
                    url={report.image_1_url}
                    filename={report.image_1 || 'image-1.jpg'}
                    onView={onViewImage}
                    onDownload={(url, name) => onDownload(url, name, 'ACCIDENT_IMAGE')}
                  />
                  <ImageAttachment
                    label="Image 2"
                    url={report.image_2_url}
                    filename={report.image_2 || 'image-2.jpg'}
                    onView={onViewImage}
                    onDownload={(url, name) => onDownload(url, name, 'ACCIDENT_IMAGE')}
                  />
                  {!report.image_1_url && !report.image_2_url ? (
                    <p className="accidentreports-attachment-empty">No images attached.</p>
                  ) : null}
                </div>
              </div>

              <div className="accidentreports-attachment-group">
                <h4>Voice recordings</h4>
                <div className="accidentreports-attachment-row accidentreports-attachment-row--audio">
                  <VoiceAttachment
                    label="Voice note 1"
                    url={report.voice_note_1_url}
                    filename={report.voice_note_1 || 'voice-note-1.m4a'}
                    onDownload={onDownload}
                  />
                  <VoiceAttachment
                    label="Voice note 2"
                    url={report.voice_note_2_url}
                    filename={report.voice_note_2 || 'voice-note-2.m4a'}
                    onDownload={onDownload}
                  />
                  {!report.voice_note_1_url && !report.voice_note_2_url ? (
                    <p className="accidentreports-attachment-empty">No voice recordings attached.</p>
                  ) : null}
                </div>
              </div>

              <div className="accidentreports-attachment-group">
                <h4>Screen recording</h4>
                {report.video_1_url ? (
                  <article className="accidentreports-attachment-card accidentreports-video-item">
                    <div className="accidentreports-media-label">
                      <FaVideo className="accidentreports-media-icon accidentreports-media-icon--video" aria-hidden />
                      <strong>Screen record</strong>
                      <button
                        type="button"
                        onClick={() => onDownload(report.video_1_url, report.video_1 || 'screen-record.mp4', 'ACCIDENT_VIDEO')}
                        className="accidentreports-download-btn"
                        title="Download video"
                      >
                        <FaDownload />
                      </button>
                    </div>
                    <div className="accidentreports-video-wrapper">
                      <video
                        controls
                        className="accidentreports-modal-video"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const errorDiv = e.currentTarget.parentElement?.querySelector('.accidentreports-video-error');
                          if (errorDiv) errorDiv.style.display = 'flex';
                        }}
                      >
                        <source src={getResourceUrl(report.video_1_url, 'ACCIDENT_VIDEO')} type="video/mp4" />
                        <source src={getResourceUrl(report.video_1_url, 'ACCIDENT_VIDEO')} type="video/webm" />
                      </video>
                      <div className="accidentreports-video-error" style={{ display: 'none' }}>
                        <FaVideo />
                        <p>Could not load</p>
                      </div>
                    </div>
                  </article>
                ) : (
                  <p className="accidentreports-attachment-empty">No screen recording attached.</p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
