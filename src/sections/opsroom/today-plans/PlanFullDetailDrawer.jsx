import React, { useEffect, useMemo, useState } from 'react';
import { useGetPlanFullDetailQuery } from '../../../api/services NodeJs/pilotAssignmentApi';
import { Bars } from 'react-loader-spinner';
import { downloadPlanFullDetailExcel } from './todayPlansExcelExport';

function formatDateTime(val) {
  if (val == null || val === '') return '—';
  const s = String(val).trim();
  if (!s) return '—';
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    const date = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return `${date} ${time}`;
  } catch (_) {
    return s;
  }
}

function formatHa(val) {
  if (val == null || val === '') return '—';
  const n = Number(val);
  if (!Number.isFinite(n)) return String(val);
  return `${Number(n).toFixed(2)} ha`;
}

function getMapUrl(lat, lng) {
  if (lat == null && lng == null) return null;
  const la = lat != null ? Number(lat) : 0;
  const ln = lng != null ? Number(lng) : 0;
  if (Number.isNaN(la) || Number.isNaN(ln)) return null;
  return `https://www.google.com/maps?q=${la},${ln}`;
}

function ackLabel(code) {
  const c = String(code || '').toLowerCase();
  if (c === 'a') return 'Accepted';
  if (c === 'd') return 'Declined';
  if (c === 'p') return 'Pending';
  return code || '—';
}

function fieldStatusMeta(field) {
  const finalStatus = String(field.final_status || field.status || '').toLowerCase();
  const remaining = field.remaining_options != null && Number(field.remaining_options) !== 0;
  if (finalStatus === 'x') return { label: 'Cancelled', tone: 'danger' };
  if (finalStatus === 'c' && remaining) return { label: 'Partial', tone: 'warn' };
  if (finalStatus === 'c') return { label: 'Completed', tone: 'ok' };
  if (field.start_time) return { label: 'In progress', tone: 'info' };
  if (field.condition_check) return { label: 'Acknowledged', tone: 'info' };
  return { label: 'Pending', tone: 'muted' };
}

function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function timelineTone(type) {
  if (!type) return 'neutral';
  if (type.includes('cancel')) return 'danger';
  if (type.includes('partial')) return 'warn';
  if (type.includes('complete') || type.includes('approved') || type.includes('payment')) return 'ok';
  if (type.includes('assign') || type.includes('transport') || type.includes('visit') || type.includes('water') || type.includes('chemical') || type.includes('acknowledge')) {
    return 'info';
  }
  return 'neutral';
}

function Kv({ label, children }) {
  return (
    <div className="tp-kv-com">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Section({ title, subtitle, children, actions, className = '' }) {
  return (
    <section className={`tp-detail-section-com ${className}`.trim()}>
      <div className="tp-detail-section-head-com">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p className="tp-detail-section-sub-com">{subtitle}</p> : null}
        </div>
        {actions || null}
      </div>
      {children}
    </section>
  );
}

function PersonChip({ name, meta, lead }) {
  return (
    <div className={`tp-person-chip-com${lead ? ' tp-person-chip-lead-com' : ''}`}>
      <span className="tp-person-avatar-com" aria-hidden="true">
        {initials(name)}
      </span>
      <span className="tp-person-text-com">
        <strong>{name || '—'}</strong>
        {meta ? <span>{meta}</span> : null}
      </span>
    </div>
  );
}

function MapLink({ href, label = 'Open map' }) {
  if (!href) return null;
  return (
    <a className="tp-map-link-com" href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
      {label}
    </a>
  );
}

function FieldTaskCard({ field, defaultOpen }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const status = fieldStatusMeta(field);
  const mapStart = getMapUrl(field.start_latitude, field.start_longitude);
  const mapWater = getMapUrl(field.water_latitude, field.water_longitude);
  const mapChem = getMapUrl(field.chemical_latitude, field.chemical_longitude);

  return (
    <div className={`tp-detail-field-card-com tp-field-tone-${status.tone}-com`}>
      <button type="button" className="tp-detail-field-head-com" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <div className="tp-field-head-main-com">
          <span className={`tp-status-pill-com tp-status-${status.tone}-com`}>{status.label}</span>
          <div className="tp-field-titles-com">
            <strong>{field.field_name || `Field ${field.field_id}`}</strong>
            <span>Task #{field.task_id}{field.pilot_name ? ` · ${field.pilot_name}` : ''}</span>
          </div>
        </div>
        <span className="tp-detail-field-chevron-com" aria-hidden="true">
          {open ? '−' : '+'}
        </span>
      </button>
      {open && (
        <div className="tp-detail-field-body-com">
          <div className="tp-metric-row-com">
            <div className="tp-metric-com">
              <span>Field</span>
              <strong>{formatHa(field.field_size_ha)}</strong>
            </div>
            <div className="tp-metric-com">
              <span>Waypoint</span>
              <strong>{formatHa(field.waypoint_area_ha)}</strong>
            </div>
            <div className="tp-metric-com">
              <span>Pilot</span>
              <strong>{formatHa(field.pilot_field_area_ha)}</strong>
            </div>
            <div className="tp-metric-com">
              <span>DJI / Ops</span>
              <strong>{formatHa(field.dji_field_area_ha)}</strong>
            </div>
          </div>

          <dl className="tp-kv-grid-com">
            <Kv label="Acknowledge">
              {ackLabel(field.condition_check)}
              <span className="tp-inline-meta-com">{formatDateTime(field.condition_check_time)}</span>
            </Kv>
            <Kv label="Field visit / start">
              {formatDateTime(field.start_time)}
              <MapLink href={mapStart} />
            </Kv>
            <Kv label="Water">
              {field.water_received ? 'Received' : 'Not received'}
              <span className="tp-inline-meta-com">{formatDateTime(field.water_received_time)}</span>
              <MapLink href={mapWater} />
            </Kv>
            <Kv label="Chemical">
              {field.chemical_received ? 'Received' : 'Not received'}
              <span className="tp-inline-meta-com">{formatDateTime(field.chemical_received_time)}</span>
              <MapLink href={mapChem} />
            </Kv>
            <Kv label="Cancel reason">{field.cancel_reason || '—'}</Kv>
            <Kv label="Partial reason">{field.remaining_reason || '—'}</Kv>
            <Kv label="Ops room reason">{field.ops_reason || '—'}</Kv>
          </dl>
        </div>
      )}
    </div>
  );
}

function LifecycleStrip({ detail, kind }) {
  const steps = useMemo(() => {
    const header = kind === 'mission' ? detail?.mission : detail?.plan;
    const manager = detail?.manager;
    const hasAssign = Boolean(detail?.resources?.assignment?.created_at) || header?.team_assigned === 1;
    const hasTransport = Boolean(detail?.transport?.vehicle_id || detail?.transport?.driver_id);
    const hasFieldWork = (detail?.fields || []).some((f) => f.start_time || f.condition_check_time);
    const hasFinish = (detail?.fields || []).some((f) => {
      const s = String(f.final_status || '').toLowerCase();
      return s === 'c' || s === 'x';
    });

    if (kind === 'mission') {
      return [
        { key: 'created', label: 'Created', done: Boolean(header?.created_at) },
        { key: 'payment', label: 'Payment', done: Number(header?.payments) === 1 },
        { key: 'assigned', label: 'Assigned', done: hasAssign },
        { key: 'transport', label: 'Transport', done: hasTransport },
        { key: 'field', label: 'Field work', done: hasFieldWork },
        { key: 'done', label: 'Closed', done: hasFinish },
      ];
    }

    const canceled = Boolean(manager?.cancel_reason_id);
    return [
      { key: 'created', label: 'Created', done: Boolean(header?.created_at) },
      {
        key: 'approval',
        label: canceled ? 'Canceled' : 'Approved',
        done: manager?.approval === 1 || canceled,
        warn: canceled,
      },
      { key: 'assigned', label: 'Assigned', done: hasAssign },
      { key: 'transport', label: 'Transport', done: hasTransport },
      { key: 'field', label: 'Field work', done: hasFieldWork },
      { key: 'done', label: 'Closed', done: hasFinish },
    ];
  }, [detail, kind]);

  return (
    <div className="tp-lifecycle-com" aria-label="Lifecycle progress">
      {steps.map((step, idx) => (
        <React.Fragment key={step.key}>
          {idx > 0 ? <span className={`tp-lifecycle-line-com${steps[idx - 1].done ? ' is-done' : ''}`} /> : null}
          <div className={`tp-lifecycle-step-com${step.done ? ' is-done' : ''}${step.warn ? ' is-warn' : ''}`}>
            <span className="tp-lifecycle-dot-com" />
            <span className="tp-lifecycle-label-com">{step.label}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

/**
 * Full lifecycle drawer for a plantation plan or non-plantation mission.
 * selection: { kind: 'plan'|'mission', id: number } | null
 */
export default function PlanFullDetailDrawer({ selection, onClose }) {
  const planId = selection?.kind === 'plan' ? selection.id : undefined;
  const missionId = selection?.kind === 'mission' ? selection.id : undefined;
  const skip = !selection;

  const { data, isLoading, isFetching, error, refetch } = useGetPlanFullDetailQuery(
    { plan_id: planId, mission_id: missionId },
    { skip }
  );

  useEffect(() => {
    if (!selection) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [selection, onClose]);

  if (!selection) return null;

  const detail = data?.status === false ? null : data;
  const kind = detail?.kind || selection.kind;
  const header = kind === 'mission' ? detail?.mission : detail?.plan;
  const title =
    kind === 'mission'
      ? header?.farmer_name || `Mission #${selection.id}`
      : header?.estate_name || `Plan #${selection.id}`;
  const dateLabel = header?.picked_date || header?.planned_date || '—';
  const showBusy = isLoading || (isFetching && !detail);

  return (
    <div className="tp-detail-overlay-com" role="presentation" onClick={onClose}>
      <aside
        className="tp-detail-drawer-com"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tp-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="tp-detail-header-com">
          <div className="tp-detail-header-main-com">
            <div className="tp-detail-header-top-com">
              <span className={`tp-kind-badge-com ${kind === 'mission' ? 'is-mission' : 'is-plan'}`}>
                {kind === 'mission' ? 'Non-plantation' : 'Plantation'}
              </span>
              <span className="tp-id-badge-com">
                {kind === 'mission' ? `Mission #${selection.id}` : `Plan #${selection.id}`}
              </span>
            </div>
            <h2 id="tp-detail-title" className="tp-detail-title-com">
              {title}
            </h2>
            <p className="tp-detail-sub-com">
              Planned date <strong>{dateLabel}</strong>
              {header?.team_name ? (
                <>
                  {' '}
                  · Team <strong>{header.team_name}</strong>
                </>
              ) : null}
            </p>
          </div>
          <div className="tp-detail-header-actions-com">
            <button
              type="button"
              className="tp-detail-excel-btn-com"
              disabled={!detail || showBusy}
              onClick={() => downloadPlanFullDetailExcel(detail)}
              title="Download Excel for this plan"
            >
              Download Excel
            </button>
            <button type="button" className="tp-detail-close-com" onClick={onClose} aria-label="Close details">
              ×
            </button>
          </div>
        </header>

        <div className="tp-detail-body-com">
          {showBusy && (
            <div className="tp-detail-loading-com">
              <Bars height="36" width="36" color="#003057" visible />
              <span>Loading full plan lifecycle…</span>
            </div>
          )}

          {error && !showBusy && (
            <div className="tp-detail-error-com">
              <p>{error?.data?.message || error?.error || 'Failed to load detail'}</p>
              <button type="button" className="tp-detail-retry-com" onClick={() => refetch()}>
                Retry
              </button>
            </div>
          )}

          {data?.status === false && !showBusy && (
            <div className="tp-detail-error-com">
              <p>{data?.message || 'Detail unavailable'}</p>
              <button type="button" className="tp-detail-retry-com" onClick={() => refetch()}>
                Retry
              </button>
            </div>
          )}

          {detail && !showBusy && (
            <>
              <div className="tp-detail-topbar-com">
              <div className="tp-detail-chips-com">
                {kind === 'plan' && detail.manager && (
                  <span
                    className={`tp-chip-com ${
                      detail.manager.cancel_reason_id
                        ? 'tp-chip-danger-com'
                        : detail.manager.approval === 1
                          ? 'tp-chip-ok-com'
                          : 'tp-chip-warn-com'
                    }`}
                  >
                    {detail.manager.cancel_reason_id
                      ? 'Manager canceled'
                      : detail.manager.approval === 1
                        ? 'Manager approved'
                        : 'Approval pending'}
                  </span>
                )}
                {header?.team_assigned === 1 ? (
                  <span className="tp-chip-com tp-chip-ok-com">Resources assigned</span>
                ) : (
                  <span className="tp-chip-com tp-chip-muted-com">Resources unassigned</span>
                )}
                {header?.drone_unlock === 1 && <span className="tp-chip-com tp-chip-info-com">Drone unlocked</span>}
                {kind === 'mission' && (
                  <span
                    className={`tp-chip-com ${Number(header?.payments) === 1 ? 'tp-chip-ok-com' : 'tp-chip-warn-com'}`}
                  >
                    {Number(header?.payments) === 1 ? 'Payment confirmed' : 'Payment pending'}
                  </span>
                )}
              </div>

              <div className="tp-stat-row-com">
                <div className="tp-stat-com">
                  <span>Extent</span>
                  <strong>
                    {formatHa(kind === 'plan' ? header?.plan_active_ha : header?.total_land_extent)}
                  </strong>
                </div>
                <div className="tp-stat-com">
                  <span>{kind === 'plan' ? 'Fields' : 'Tasks'}</span>
                  <strong>
                    {kind === 'plan'
                      ? header?.plan_active_fields_count ?? (detail.fields || []).length
                      : (detail.fields || []).length}
                  </strong>
                </div>
                <div className="tp-stat-com">
                  <span>Team</span>
                  <strong>{header?.team_name || '—'}</strong>
                </div>
              </div>

              <Section title="Lifecycle" subtitle="High-level progress across ops milestones">
                <LifecycleStrip detail={detail} kind={kind} />
              </Section>
              </div>

              <div className="tp-detail-grid-com">
                <div className="tp-detail-col-com">
              <Section title={kind === 'mission' ? 'Mission details' : 'Plan details'}>
                <dl className="tp-kv-grid-com">
                  {kind === 'plan' ? (
                    <>
                      <Kv label="Estate">{header.estate_name || '—'}</Kv>
                      <Kv label="Date">{header.picked_date || '—'}</Kv>
                      <Kv label="Active extent">{formatHa(header.plan_active_ha)}</Kv>
                      <Kv label="Fields">{header.plan_active_fields_count ?? '—'}</Kv>
                      <Kv label="Created">
                        {formatDateTime(header.created_at)}
                        {header.creator_name ? ` · ${header.creator_name}` : ''}
                      </Kv>
                      <Kv label="Ops operator">
                        {header.operator_name || '—'}
                        <span className="tp-inline-meta-com">{formatDateTime(header.operator_date)}</span>
                      </Kv>
                      <Kv label="Status">{header.status || '—'}</Kv>
                    </>
                  ) : (
                    <>
                      <Kv label="Farmer">{header.farmer_name || '—'}</Kv>
                      <Kv label="Telephone">{header.farmer_telephone || '—'}</Kv>
                      <Kv label="GND">{header.gnd || '—'}</Kv>
                      <Kv label="Extent">{formatHa(header.total_land_extent)}</Kv>
                      <Kv label="Payment">
                        {Number(header.payments) === 1 ? 'Paid' : 'Pending'}
                        {header.payment_type ? ` · ${header.payment_type}` : ''}
                      </Kv>
                      <Kv label="Created">{formatDateTime(header.created_at)}</Kv>
                      <Kv label="Status">{header.status || '—'}</Kv>
                    </>
                  )}
                </dl>
              </Section>

              {kind === 'plan' && detail.manager && (
                <Section title="Manager approval" subtitle="Estate manager decision and timestamps">
                  <dl className="tp-kv-grid-com">
                    <Kv label="Decision">
                      {detail.manager.cancel_reason_id
                        ? 'Canceled'
                        : detail.manager.approval === 1
                          ? 'Approved'
                          : 'Pending'}
                    </Kv>
                    <Kv label="Approved by">{detail.manager.approval_user_name || '—'}</Kv>
                    <Kv label="Approved at">{formatDateTime(detail.manager.approval_time)}</Kv>
                    <Kv label="Cancel reason">{detail.manager.cancel_reason || '—'}</Kv>
                  </dl>
                </Section>
              )}

              <Section title="Resource assignment" subtitle="Team, pilots, and drone allocation">
                <dl className="tp-kv-grid-com">
                  <Kv label="Assignment ID">{detail.resources?.assignment?.assignment_id || '—'}</Kv>
                  <Kv label="Assigned at">{formatDateTime(detail.resources?.assignment?.created_at)}</Kv>
                  <Kv label="Team">{detail.resources?.assignment?.team_name || header?.team_name || '—'}</Kv>
                </dl>
                <div className="tp-resource-block-com">
                  <h4>Pilots</h4>
                  {(detail.resources?.pilots || []).length === 0 ? (
                    <p className="tp-detail-empty-com">No pilots linked</p>
                  ) : (
                    <div className="tp-person-list-com">
                      {detail.resources.pilots.map((p) => (
                        <PersonChip
                          key={p.id || p.name}
                          name={p.name}
                          meta={p.mobile_no || undefined}
                          lead={p.is_leader}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div className="tp-resource-block-com">
                  <h4>Drones</h4>
                  {(detail.resources?.drones || []).length === 0 ? (
                    <p className="tp-detail-empty-com">No drones linked</p>
                  ) : (
                    <div className="tp-tag-list-com">
                      {detail.resources.drones.map((d, i) => (
                        <span key={d.id || i} className="tp-asset-tag-com">
                          {d.tag || d.serial || `Drone ${d.id}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Section>

              <Section title="Transport" subtitle="Vehicle and driver arrangement">
                <dl className="tp-kv-grid-com">
                  <Kv label="Vehicle">{detail.transport?.vehicle_no || '—'}</Kv>
                  <Kv label="Driver">
                    {detail.transport?.driver_name || '—'}
                    {detail.transport?.driver_mobile ? (
                      <span className="tp-inline-meta-com">{detail.transport.driver_mobile}</span>
                    ) : null}
                  </Kv>
                  <Kv label="Arrival">{formatDateTime(detail.transport?.driver_arrival_time)}</Kv>
                </dl>
              </Section>

              {kind === 'plan' && (
                <Section title="Chemicals" subtitle="Plan chemical lines (estate manager plan)">
                  {detail.chemicals?.time_of_day_label ? (
                    <p className="tp-detail-muted-com">Time of day: {detail.chemicals.time_of_day_label}</p>
                  ) : null}
                  {(detail.chemicals?.chemical_lines || []).length === 0 ? (
                    <p className="tp-detail-empty-com">No chemical lines recorded</p>
                  ) : (
                    <div className="tp-chem-table-com">
                      <div className="tp-chem-head-com">
                        <span>Chemical</span>
                        <span>Quantity</span>
                      </div>
                      {detail.chemicals.chemical_lines.map((c) => (
                        <div key={c.chemical_id} className="tp-chem-row-com">
                          <span>{c.chemical_name || `Chemical ${c.chemical_id}`}</span>
                          <strong>{c.quantity}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
              )}
                </div>

                <div className="tp-detail-col-com tp-detail-col-timeline-com">
                  <Section title="Event timeline" subtitle="Chronological activity with timestamps" className="tp-timeline-panel-com">
                    {(detail.timeline || []).length === 0 ? (
                      <p className="tp-detail-empty-com">No timestamped events yet.</p>
                    ) : (
                      <ol className="tp-detail-timeline-com">
                        {detail.timeline.map((ev, idx) => (
                          <li key={`${ev.type}-${idx}`} className={`tp-tl-tone-${timelineTone(ev.type)}-com`}>
                            <span className="tp-tl-dot-com" />
                            <div className="tp-tl-content-com">
                              <div className="tp-tl-title-row-com">
                                <strong>{ev.label}</strong>
                                <time dateTime={ev.at || undefined}>{formatDateTime(ev.at)}</time>
                              </div>
                              {ev.meta?.reason ? <p>Reason: {ev.meta.reason}</p> : null}
                              {ev.meta?.by ? <p>By: {ev.meta.by}</p> : null}
                              {ev.meta?.vehicle_no ? <p>Vehicle: {ev.meta.vehicle_no}</p> : null}
                              {ev.meta?.driver_name ? <p>Driver: {ev.meta.driver_name}</p> : null}
                              {ev.meta?.team ? <p>Team: {ev.meta.team}</p> : null}
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </Section>
                </div>
              </div>

              <Section
                title="Fields / tasks"
                subtitle="Acknowledge, field visit, water/chem, areas, and reasons"
                className="tp-detail-section-wide-com"
              >
                {(detail.fields || []).length === 0 ? (
                  <p className="tp-detail-empty-com">
                    {kind === 'plan' && detail.manager?.approval !== 1
                      ? 'Field tasks appear after manager approval.'
                      : 'No pilot field tasks yet.'}
                  </p>
                ) : (
                  <div className="tp-field-stack-com">
                    {detail.fields.map((f, idx) => (
                      <FieldTaskCard key={f.task_id} field={f} defaultOpen={idx === 0} />
                    ))}
                  </div>
                )}
              </Section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
