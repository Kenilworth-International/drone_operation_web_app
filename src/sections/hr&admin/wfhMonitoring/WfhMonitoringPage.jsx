import React, { useEffect, useMemo, useState } from 'react';
import {
  fetchWfhCaptureBlob,
  useListWfhCapturesQuery,
  useListWfhDevicesQuery,
} from '../../../api/services NodeJs/wfhMonitoringApi';
import '../../../styles/wfhMonitoring.css';

function formatWhen(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDay(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function sessionRangeLabel(session) {
  const day = formatDay(session.started_at);
  const start = formatTime(session.started_at);
  const end = session.ended_at ? formatTime(session.ended_at) : 'now';
  return `${day} · ${start} → ${end}`;
}

function sessionWorkedLabel(session, pauses) {
  const sessionPauses = (pauses || []).filter((p) => Number(p.session_id) === Number(session.id));
  return formatDuration(computeWorkedMs([session], sessionPauses));
}

function personLabel(name, empNo, id) {
  const n = String(name || '').trim() || `Employee #${id || ''}`;
  return empNo ? `${n} · ${empNo}` : n;
}

function toMs(value) {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Worked time = session spans minus pause spans (open sessions/pauses count to now). */
function computeWorkedMs(sessions, pauses) {
  const now = Date.now();
  let sessionMs = 0;
  (sessions || []).forEach((s) => {
    const start = toMs(s.started_at);
    if (start == null) return;
    const end = toMs(s.ended_at) ?? now;
    sessionMs += Math.max(0, end - start);
  });

  let pauseMs = 0;
  (pauses || []).forEach((p) => {
    const start = toMs(p.paused_at);
    if (start == null) return;
    const end = toMs(p.resumed_at) ?? now;
    pauseMs += Math.max(0, end - start);
  });

  return Math.max(0, sessionMs - pauseMs);
}

function formatDuration(ms) {
  const totalSec = Math.floor(Number(ms) / 1000);
  if (!Number.isFinite(totalSec) || totalSec <= 0) return '0m';
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  if (hours <= 0) return `${minutes}m`;
  if (minutes <= 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function CaptureThumb({ captureId, onOpen, meta }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    fetchWfhCaptureBlob(captureId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [captureId]);

  if (!url) return <div className="wfh-thumb-placeholder">Loading…</div>;
  return (
    <button
      type="button"
      className="wfh-thumb-btn"
      onClick={() => onOpen?.({ url, captureId, meta })}
      aria-label={`Open capture ${captureId}`}
    >
      <img src={url} alt={`Capture ${captureId}`} className="wfh-thumb" />
    </button>
  );
}

function CaptureLightbox({ preview, onClose }) {
  useEffect(() => {
    if (!preview) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview, onClose]);

  if (!preview?.url) return null;

  return (
    <div className="wfh-lightbox-overlay" role="presentation" onClick={onClose}>
      <div
        className="wfh-lightbox"
        role="dialog"
        aria-modal="true"
        aria-label="Capture preview"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="wfh-lightbox-head">
          <div>
            <strong>{preview.meta?.capturedAt || 'Capture'}</strong>
            {preview.meta?.location ? <span>{preview.meta.location}</span> : null}
          </div>
          <button type="button" className="wfh-btn-ghost" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="wfh-lightbox-body">
          <img src={preview.url} alt={preview.meta?.capturedAt || 'WFH capture'} />
        </div>
      </div>
    </div>
  );
}

function eventTypeLabel(type) {
  const map = {
    no_internet: 'No internet',
    screenshot_failed: 'Screenshot failed',
    upload_failed: 'Upload failed',
    capture_failed: 'Capture failed',
    no_session: 'No active session',
    unclean_shutdown: 'Unexpected shutdown',
  };
  return map[type] || type || 'Agent event';
}

function buildTimeline(sessions, pauses, agentEvents) {
  const events = [];

  (sessions || []).forEach((s) => {
    events.push({
      kind: 'session_start',
      at: s.started_at,
      sortKey: new Date(s.started_at || 0).getTime(),
      session: s,
    });
    if (s.ended_at) {
      events.push({
        kind: 'session_end',
        at: s.ended_at,
        sortKey: new Date(s.ended_at).getTime() + 0.5,
        session: s,
      });
    }
  });

  (pauses || []).forEach((p) => {
    events.push({
      kind: 'pause',
      at: p.paused_at,
      sortKey: new Date(p.paused_at || 0).getTime() + 0.2,
      pause: p,
    });
    if (p.resumed_at) {
      events.push({
        kind: 'resume',
        at: p.resumed_at,
        sortKey: new Date(p.resumed_at).getTime() + 0.3,
        pause: p,
      });
    }
  });

  (agentEvents || []).forEach((ev) => {
    events.push({
      kind: 'agent_event',
      at: ev.occurred_at,
      sortKey: new Date(ev.occurred_at || 0).getTime() + 0.4,
      event: ev,
    });
  });

  return events.sort((a, b) => a.sortKey - b.sortKey);
}

function CapturesDrawer({ open, onClose, session, deviceId }) {
  const [preview, setPreview] = useState(null);

  const query = useMemo(() => {
    if (!open) return null;
    return {
      deviceId: deviceId ? Number(deviceId) : undefined,
      sessionId: session?.id ? Number(session.id) : undefined,
      employeeId: session?.employee_id ? Number(session.employee_id) : undefined,
      limit: 24,
    };
  }, [open, deviceId, session]);

  const { data, isLoading, isFetching, refetch } = useListWfhCapturesQuery(query || {}, {
    skip: !open || !query,
  });
  const items = data?.items || [];

  useEffect(() => {
    if (!open) setPreview(null);
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="wfh-drawer-overlay" role="presentation" onClick={onClose}>
        <aside className="wfh-drawer" role="dialog" aria-label="Session captures" onClick={(e) => e.stopPropagation()}>
          <header className="wfh-drawer-head">
            <div>
              <h3>Captures</h3>
              <p>
                {personLabel(session?.employeeName, session?.empNo, session?.employee_id)}
                {session?.started_at ? ` · ${formatWhen(session.started_at)}` : ''}
              </p>
            </div>
            <div className="wfh-drawer-actions">
              <button type="button" className="wfh-btn-ghost" onClick={() => refetch()} disabled={isFetching}>
                Refresh
              </button>
              <button type="button" className="wfh-btn-ghost" onClick={onClose}>
                Close
              </button>
            </div>
          </header>

          {isLoading ? (
            <p className="wfh-muted">Loading captures…</p>
          ) : items.length === 0 ? (
            <p className="wfh-muted">No captures for this session yet.</p>
          ) : (
            <div className="wfh-capture-grid">
              {items.map((row) => {
                const location =
                  row.latitude != null && row.longitude != null
                    ? `${Number(row.latitude).toFixed(4)}, ${Number(row.longitude).toFixed(4)}`
                    : 'Location n/a';
                return (
                  <article key={row.id} className="wfh-capture-card">
                    <CaptureThumb
                      captureId={row.id}
                      meta={{ capturedAt: formatWhen(row.captured_at), location }}
                      onOpen={setPreview}
                    />
                    <div className="wfh-capture-meta">
                      <strong>{formatWhen(row.captured_at)}</strong>
                      <span>{location}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </aside>
      </div>
      <CaptureLightbox preview={preview} onClose={() => setPreview(null)} />
    </>
  );
}

export default function WfhMonitoringPage() {
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [capturesSession, setCapturesSession] = useState(null);

  // Device rail only — do not refetch the full catalog when selecting a device.
  const {
    data: listData,
    isLoading: loadingDevices,
    refetch: refetchList,
  } = useListWfhDevicesQuery({});

  const devices = listData?.devices || [];

  useEffect(() => {
    if (!selectedDeviceId && devices.length) {
      setSelectedDeviceId(String(devices[0].id));
    }
  }, [devices, selectedDeviceId]);

  // Timeline/detail for the selected device only (skips reloading all devices).
  const {
    data: detailData,
    isFetching: loadingDetail,
    refetch: refetchDetail,
  } = useListWfhDevicesQuery(
    {
      deviceId: selectedDeviceId ? Number(selectedDeviceId) : undefined,
      activityOnly: true,
    },
    { skip: !selectedDeviceId }
  );

  const sessions = detailData?.sessions || [];
  const pauses = detailData?.pauses || [];
  const agentEvents = detailData?.events || [];

  const selectedDevice = useMemo(
    () => devices.find((d) => String(d.id) === String(selectedDeviceId)) || null,
    [devices, selectedDeviceId]
  );

  const timeline = useMemo(
    () => (selectedDeviceId ? buildTimeline(sessions, pauses, agentEvents) : []),
    [selectedDeviceId, sessions, pauses, agentEvents]
  );

  const workedLabel = useMemo(
    () => formatDuration(computeWorkedMs(sessions, pauses)),
    [sessions, pauses]
  );

  const refetchDevices = () => {
    refetchList();
    if (selectedDeviceId) refetchDetail();
  };

  return (
    <div className="wfh-page">
      <div className="wfh-shell">
        <aside className="wfh-device-rail">
          <div className="wfh-rail-head">
            <h3>Devices</h3>
            <div className="wfh-rail-actions">
              <span className="wfh-rail-count">{devices.length}</span>
              <button type="button" className="wfh-btn-ghost wfh-btn-compact" onClick={() => refetchDevices()}>
                Refresh
              </button>
            </div>
          </div>
          {loadingDevices && !devices.length ? (
            <p className="wfh-muted">Loading…</p>
          ) : devices.length === 0 ? (
            <p className="wfh-muted">No devices registered.</p>
          ) : (
            <ul className="wfh-device-list">
              {devices.map((d) => {
                const active = String(selectedDeviceId) === String(d.id);
                const paused = Number(d.active_is_paused) === 1;
                const status = d.active_session_id ? (paused ? 'paused' : 'live') : 'idle';
                const statusLabel = status === 'paused' ? 'Paused' : status === 'live' ? 'Live' : 'Idle';
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      className={`wfh-device-item${active ? ' is-active' : ''}`}
                      onClick={() => setSelectedDeviceId(String(d.id))}
                    >
                      <span className={`wfh-device-status ${status}`} aria-hidden="true" />
                      <span className="wfh-device-body">
                        <span className="wfh-device-name" title={d.hostname || d.device_uuid}>
                          {d.hostname || d.device_uuid}
                        </span>
                        <span className="wfh-device-meta">
                          <span className={`wfh-status-text ${status}`}>{statusLabel}</span>
                          <span className="wfh-meta-sep" aria-hidden="true">
                            ·
                          </span>
                          <span>{d.os || 'Unknown OS'}</span>
                        </span>
                        {d.active_employee_name ? (
                          <span className="wfh-device-user">{d.active_employee_name}</span>
                        ) : null}
                        <span className="wfh-device-seen">Seen {formatWhen(d.last_seen_at)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="wfh-main">
          {!selectedDevice ? (
            <div className="wfh-empty">
              <h3>Select a device</h3>
              <p>Choose a laptop to review sessions, pauses, and captures.</p>
            </div>
          ) : (
            <>
              <div className="wfh-main-head">
                <div>
                  <h3>{selectedDevice.hostname || selectedDevice.device_uuid}</h3>
                  <p>
                    {selectedDevice.os}
                    {selectedDevice.os_version ? ` ${selectedDevice.os_version}` : ''}
                    {' · '}
                    {loadingDetail && !sessions.length ? (
                      'Loading activity…'
                    ) : (
                      <>
                        {sessions.length} session{sessions.length === 1 ? '' : 's'}
                        {pauses.length ? ` · ${pauses.length} pause${pauses.length === 1 ? '' : 's'}` : ''}
                        {' · '}
                        Worked {workedLabel}
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="wfh-session-strip">
                <h4>Sessions on this PC</h4>
                {sessions.length === 0 ? (
                  <p className="wfh-muted">No sessions recorded yet.</p>
                ) : (
                  <div className="wfh-session-cards">
                    {sessions.map((s) => {
                      const open = !s.ended_at;
                      const paused = Number(s.is_paused) === 1;
                      const status = paused ? 'paused' : open ? 'live' : 'idle';
                      const statusLabel = paused ? 'Paused' : open ? 'Active' : 'Ended';
                      return (
                        <article key={s.id} className={`wfh-session-card${open ? ' is-open' : ''}`}>
                          <div className="wfh-session-card-top">
                            <strong title={personLabel(s.employeeName, s.empNo, s.employee_id)}>
                              {personLabel(s.employeeName, s.empNo, s.employee_id)}
                            </strong>
                            <span className={`wfh-status-text ${status}`}>{statusLabel}</span>
                          </div>
                          <p className="wfh-session-range">{sessionRangeLabel(s)}</p>
                          <div className="wfh-session-card-footer">
                            <span className="wfh-session-worked">{sessionWorkedLabel(s, pauses)}</span>
                            <button
                              type="button"
                              className="wfh-btn-link"
                              onClick={() => setCapturesSession(s)}
                            >
                              View captures
                            </button>
                          </div>
                          {paused && s.pause_reason ? (
                            <p className="wfh-reason-inline">{s.pause_reason}</p>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="wfh-timeline-wrap">
                <h4>Activity timeline</h4>
                {timeline.length === 0 ? (
                  <p className="wfh-muted">No activity yet for this device.</p>
                ) : (
                  <ol className="wfh-timeline">
                    {timeline.map((ev, idx) => {
                      if (ev.kind === 'session_start') {
                        const s = ev.session;
                        return (
                          <li key={`ss-${s.id}-${idx}`} className="wfh-tl-item session">
                            <div className="wfh-tl-dot" />
                            <div className="wfh-tl-body">
                              <div className="wfh-tl-meta">
                                <span>{formatWhen(ev.at)}</span>
                                <span className="wfh-tl-tag">Session start</span>
                              </div>
                              <strong>{personLabel(s.employeeName, s.empNo, s.employee_id)}</strong>
                              <div className="wfh-session-card-footer">
                                <button
                                  type="button"
                                  className="wfh-btn-link"
                                  onClick={() => setCapturesSession(s)}
                                >
                                  View captures
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      }
                      if (ev.kind === 'session_end') {
                        const s = ev.session;
                        return (
                          <li key={`se-${s.id}-${idx}`} className="wfh-tl-item end">
                            <div className="wfh-tl-dot" />
                            <div className="wfh-tl-body">
                              <div className="wfh-tl-meta">
                                <span>{formatWhen(ev.at)}</span>
                                <span className="wfh-tl-tag">Session end</span>
                              </div>
                              <strong>{personLabel(s.employeeName, s.empNo, s.employee_id)}</strong>
                            </div>
                          </li>
                        );
                      }
                      if (ev.kind === 'pause') {
                        const p = ev.pause;
                        return (
                          <li key={`p-${p.id}-${idx}`} className="wfh-tl-item pause">
                            <div className="wfh-tl-dot" />
                            <div className="wfh-tl-body">
                              <div className="wfh-tl-meta">
                                <span>{formatWhen(ev.at)}</span>
                                <span className="wfh-tl-tag pause">Paused</span>
                              </div>
                              <strong>{personLabel(p.employeeName, p.empNo, p.employee_id)}</strong>
                              <p className="wfh-reason-line">{p.reason || 'No reason'}</p>
                            </div>
                          </li>
                        );
                      }
                      if (ev.kind === 'agent_event') {
                        const a = ev.event;
                        return (
                          <li key={`ae-${a.id}-${idx}`} className="wfh-tl-item fail">
                            <div className="wfh-tl-dot" />
                            <div className="wfh-tl-body">
                              <div className="wfh-tl-meta">
                                <span>{formatWhen(ev.at)}</span>
                                <span className="wfh-tl-tag fail">{eventTypeLabel(a.event_type)}</span>
                              </div>
                              <strong>{personLabel(a.employeeName, a.empNo, a.employee_id)}</strong>
                              {a.message ? <p className="wfh-fail-line">{a.message}</p> : null}
                              {a.attempt_count ? (
                                <p className="wfh-muted-inline">Attempts: {a.attempt_count}</p>
                              ) : null}
                            </div>
                          </li>
                        );
                      }
                      const p = ev.pause;
                      return (
                        <li key={`r-${p.id}-${idx}`} className="wfh-tl-item resume">
                          <div className="wfh-tl-dot" />
                          <div className="wfh-tl-body">
                            <div className="wfh-tl-meta">
                              <span>{formatWhen(ev.at)}</span>
                              <span className="wfh-tl-tag">Continued</span>
                            </div>
                            <strong>{personLabel(p.employeeName, p.empNo, p.employee_id)}</strong>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <CapturesDrawer
        open={Boolean(capturesSession)}
        session={capturesSession}
        deviceId={selectedDeviceId}
        onClose={() => setCapturesSession(null)}
      />
    </div>
  );
}
