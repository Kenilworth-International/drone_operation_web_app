import React from 'react';
import {
  FaCheck,
  FaClipboardList,
  FaTools,
  FaUserCog,
  FaFileAlt,
} from 'react-icons/fa';

const STEP_META = [
  { key: 'report', title: 'Incident report', icon: FaFileAlt },
  { key: 'received', title: 'Received at workshop', icon: FaTools },
  { key: 'condition', title: 'Condition', icon: FaClipboardList },
  { key: 'fixed', title: 'What was fixed', icon: FaTools },
  { key: 'who', title: 'Who fixed', icon: FaUserCog },
];

function formatDate(date) {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleDateString();
  } catch {
    return String(date);
  }
}

function formatTime(time) {
  if (!time) return '';
  return String(time).slice(0, 5);
}

function Field({ label, value }) {
  return (
    <div className="maint-story-field">
      <span className="maint-story-field-label">{label}</span>
      <span className="maint-story-field-value">{value || '—'}</span>
    </div>
  );
}

function Block({ label, children }) {
  if (!children) return null;
  return (
    <div className="maint-story-block">
      <strong>{label}</strong>
      <p>{children}</p>
    </div>
  );
}

/**
 * Step-by-step repair story for a maintenance job.
 * Steps: report → condition → what fixed → who fixed
 */
export default function MaintenanceDetailStory({ record, statusBadge }) {
  if (!record) return null;

  const hasIncident = Boolean(record.incident_id);
  const suggestions =
    record.suggestions
    || record.incident_approval_suggestions
    || '';
  const conditionText =
    record.description
    || record.incident_investigation_findings
    || suggestions
    || '';
  const repairNotes = record.repair_notes || '';
  const workDone = record.status === 'c' || record.status === 'pc' || record.status === 'z';
  const hasRepair = Boolean(String(repairNotes).trim());

  const stepState = (key) => {
    if (key === 'report') return hasIncident || Boolean(record.description) ? 'done' : 'pending';
    if (key === 'received') {
      if (record.workshop_received_at) return 'done';
      return 'active';
    }
    if (key === 'condition') return conditionText ? 'done' : 'active';
    if (key === 'fixed') {
      if (hasRepair) return 'done';
      if (workDone) return 'active';
      return 'pending';
    }
    if (key === 'who') {
      if (workDone && record.technician_name) return 'done';
      if (record.technician_name) return 'active';
      return 'pending';
    }
    return 'pending';
  };

  const steps = STEP_META.map((meta) => ({
    ...meta,
    state: stepState(meta.key),
  }));

  return (
    <div className="maint-story">
      <div className="maint-story-summary">
        <div>
          <div className="maint-story-job">Job #{record.id}</div>
          <div className="maint-story-asset">
            {record.drone_tag || record.drone_serial || record.incident_device_serial || 'Asset not linked'}
            {record.drone_make || record.drone_model ? (
              <span>
                {' '}
                · {[record.drone_make, record.drone_model].filter(Boolean).join(' ')}
              </span>
            ) : null}
          </div>
        </div>
        <div className="maint-story-summary-meta">
          {statusBadge}
          {hasIncident ? (
            <span className="maint-story-chip">Incident #{record.incident_id}</span>
          ) : (
            <span className="maint-story-chip maint-story-chip--muted">Standalone</span>
          )}
        </div>
      </div>

      <ol className="maint-story-timeline">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <li key={step.key} className={`maint-story-step maint-story-step--${step.state}`}>
              <div className="maint-story-rail" aria-hidden>
                <span className="maint-story-dot">
                  {step.state === 'done' ? <FaCheck /> : <Icon />}
                </span>
              </div>
              <div className="maint-story-panel">
                <h3>{step.title}</h3>

                {step.key === 'report' && (
                  hasIncident ? (
                    <>
                      <div className="maint-story-grid">
                        <Field label="Incident" value={`#${record.incident_id}`} />
                        <Field
                          label="Date / time"
                          value={[
                            formatDate(record.incident_date),
                            formatTime(record.incident_time),
                          ].filter(Boolean).join(' · ') || '—'}
                        />
                        <Field label="Pilot" value={record.incident_pilot_name} />
                        <Field label="Estate" value={record.incident_estate_name} />
                        <Field
                          label="Device serial"
                          value={record.incident_device_serial || record.drone_serial}
                        />
                        <Field
                          label="Approved"
                          value={record.incident_approved_at
                            ? formatDate(record.incident_approved_at)
                            : '—'}
                        />
                      </div>
                      <Block label="Approval instructions">
                        {suggestions || null}
                      </Block>
                      <Block label="Investigation findings">
                        {record.incident_investigation_findings || null}
                      </Block>
                      <Block label="Investigation notes">
                        {record.incident_investigation_notes || null}
                      </Block>
                    </>
                  ) : (
                    <>
                      <p className="maint-story-muted">
                        No linked incident — this is a standalone maintenance job.
                      </p>
                      <div className="maint-story-grid">
                        <Field label="Created by" value={record.creator_name} />
                        <Field label="Scheduled" value={formatDate(record.scheduled_date)} />
                      </div>
                      <Block label="Work requested">{record.description || null}</Block>
                    </>
                  )
                )}

                {step.key === 'received' && (
                  record.workshop_received_at ? (
                    <div className="maint-story-grid">
                      <Field
                        label="Received at"
                        value={formatDate(record.workshop_received_at)}
                      />
                      <Field label="Received by" value={record.workshop_received_by_name} />
                      <Field
                        label="Inventory"
                        value={record.workshop_inventory_id ? `#${record.workshop_inventory_id}` : '—'}
                      />
                    </div>
                  ) : (
                    <p className="maint-story-muted">
                      Not yet received into workshop inventory. Receiving is separate from job creation after approval.
                    </p>
                  )
                )}

                {step.key === 'condition' && (
                  <>
                    <Block label="Reported / found condition">
                      {conditionText || 'Condition not recorded yet.'}
                    </Block>
                    {record.status_reason ? (
                      <Block label="Status reason">{record.status_reason}</Block>
                    ) : null}
                    {record.drone_operational_status ? (
                      <div className="maint-story-grid">
                        <Field
                          label="Asset status"
                          value={String(record.drone_operational_status)}
                        />
                      </div>
                    ) : null}
                  </>
                )}

                {step.key === 'fixed' && (
                  hasRepair ? (
                    <Block label="Repair work">{repairNotes}</Block>
                  ) : (
                    <p className="maint-story-muted">
                      Not recorded yet. Update status to Complete / Partially Complete and enter what was repaired.
                    </p>
                  )
                )}

                {step.key === 'who' && (
                  <div className="maint-story-grid">
                    <Field label="Technician" value={record.technician_name || 'Unassigned'} />
                    <Field label="Completed" value={formatDate(record.completed_date)} />
                    <Field label="Scheduled" value={formatDate(record.scheduled_date)} />
                    <Field label="Logged by" value={record.creator_name} />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function MaintenanceProgressPills({ record }) {
  const hasIncident = Boolean(record?.incident_id);
  const hasCondition = Boolean(
    record?.description
    || record?.incident_investigation_findings
    || record?.suggestions
    || record?.incident_approval_suggestions
  );
  const hasRepair = Boolean(String(record?.repair_notes || '').trim());
  const hasWho = Boolean(record?.technician_name)
    && (record?.status === 'c' || record?.status === 'pc' || record?.status === 'z' || hasRepair);

  const pills = [
    { label: 'Report', done: hasIncident || Boolean(record?.description) },
    { label: 'Received', done: Boolean(record?.workshop_received_at) },
    { label: 'Condition', done: hasCondition },
    { label: 'Fixed', done: hasRepair },
    { label: 'Who', done: hasWho },
  ];

  return (
    <div className="maint-progress-pills" title="Repair story progress">
      {pills.map((p) => (
        <span
          key={p.label}
          className={`maint-progress-pill${p.done ? ' maint-progress-pill--done' : ''}`}
        >
          {p.label}
        </span>
      ))}
    </div>
  );
}
