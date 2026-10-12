import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import {
  useGetDayEndAutomationSummaryQuery,
  useAddExtraDjiFieldToPlanMutation,
} from '../../../api/services NodeJs/dayEndProcessApi';

const BUCKETS = [
  { key: 'automated', label: 'Automated', tone: 'green' },
  { key: 'manual', label: 'Manual day end', tone: 'blue' },
  { key: 'cancelled', label: 'Cancelled', tone: 'muted' },
  { key: 'dji_missing', label: 'DJI map missing', tone: 'red' },
  { key: 'blocked', label: 'Automation blocked', tone: 'amber' },
  { key: 'not_submitted', label: 'Pilot not submitted', tone: 'muted' },
  { key: 'extra_maps', label: 'Sprayed without task', tone: 'purple' },
];

const BUCKET_HINTS = {
  automated: 'Day ended automatically from the DJI map and pilot data.',
  manual: 'Day ended manually by the ops room.',
  cancelled: 'Cancelled by the pilot or the ops room.',
  dji_missing: 'Pilot submitted data, but no DJI map was uploaded for the field. Ops missed the upload, or the pilot submitted on the wrong field.',
  blocked: 'A DJI map exists for the field, but automation could not finish the task.',
  not_submitted: 'Pilot neither submitted data nor cancelled the task.',
  extra_maps: 'DJI map uploaded for a field with no task on this date. Add the field to a plan so the pilot can submit data.',
};

const fmt = (n, digits = 2) => {
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(digits) : '-';
};

const AddToPlanModal = ({ map, onClose, onAdded }) => {
  const plans = map.candidate_plans || [];
  const [planId, setPlanId] = useState(plans.length === 1 ? String(plans[0].plan_id) : '');
  const selectedPlan = plans.find((p) => String(p.plan_id) === planId) || null;
  const pilots = selectedPlan?.pilots || [];
  const [pilotId, setPilotId] = useState('');
  const [addField, { isLoading }] = useAddExtraDjiFieldToPlanMutation();

  useEffect(() => {
    setPilotId(pilots.length === 1 ? String(pilots[0].pilot_id) : '');
  }, [planId]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = Boolean(selectedPlan) && pilots.length > 0 && Boolean(pilotId) && !isLoading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      const res = await addField({
        djiImageId: map.dji_image_id,
        planId: Number(planId),
        pilotId: Number(pilotId),
      }).unwrap();
      toast.success(res?.message || 'Field added to plan');
      onAdded?.(Number(planId));
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Failed to add field to plan');
    }
  };

  return createPortal(
    <div className="dep-as-modal-overlay" onClick={onClose}>
      <div className="dep-as-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dep-as-modal-hdr">
          <span>Add field to plan</span>
          <button type="button" className="dep-as-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="dep-as-modal-body">
          <div className="dep-as-modal-info">
            <div><strong>{map.field_name}</strong> · {map.estate_name || `Estate #${map.estate_id}`}</div>
            <div className="dep-as-muted">
              DJI #{map.auto_generated_id || map.dji_image_id} · Field {fmt(map.dji_field_area)} Ha ·
              Sprayed {fmt(map.dji_spraying_area)} Ha · {fmt(map.dji_spraying_litres)} L
            </div>
          </div>

          {plans.length === 0 ? (
            <div className="dep-as-warn">
              No active, team-assigned plan for this estate on this date. Create or activate a plan first.
            </div>
          ) : (
            <>
              <label className="dep-as-label" htmlFor="dep-as-plan">Plan</label>
              <select
                id="dep-as-plan"
                className="dep-as-select"
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
              >
                {plans.length > 1 && <option value="">Select plan</option>}
                {plans.map((p) => (
                  <option key={p.plan_id} value={p.plan_id}>
                    Plan #{p.plan_id} · {p.pilots.length ? p.pilots.map((pl) => pl.pilot_name).join(', ') : 'no pilot'}
                  </option>
                ))}
              </select>

              {selectedPlan && pilots.length === 0 && (
                <div className="dep-as-warn">This plan has no pilot task to copy the pilot and drone from.</div>
              )}

              {selectedPlan && pilots.length > 1 && (
                <>
                  <label className="dep-as-label" htmlFor="dep-as-pilot">Pilot who sprayed the field</label>
                  <select
                    id="dep-as-pilot"
                    className="dep-as-select"
                    value={pilotId}
                    onChange={(e) => setPilotId(e.target.value)}
                  >
                    <option value="">Select pilot</option>
                    {pilots.map((pl) => (
                      <option key={pl.pilot_id} value={pl.pilot_id}>{pl.pilot_name}</option>
                    ))}
                  </select>
                </>
              )}

              <div className="dep-as-note">
                A task is created for the pilot. The pilot must submit field data; then automation or
                manual day end completes it with this DJI map.
              </div>
            </>
          )}
        </div>
        <div className="dep-as-modal-ftr">
          <button type="button" className="dep-as-btn dep-as-btn--ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="dep-as-btn dep-as-btn--primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isLoading ? 'Adding…' : 'Add to plan'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const DayEndAutomationSummary = ({ date, onSelectPlan, onChanged }) => {
  const { data, isFetching, isError, refetch } = useGetDayEndAutomationSummaryQuery(
    { date },
    { skip: !date, refetchOnMountOrArgChange: true }
  );
  const [activeBucket, setActiveBucket] = useState(null);
  const [addMap, setAddMap] = useState(null);

  useEffect(() => {
    setActiveBucket(null);
  }, [date]);

  const counts = data?.counts || {};
  const rows = useMemo(() => {
    if (!data || !activeBucket) return [];
    if (activeBucket === 'extra_maps') return data.extra_maps || [];
    return (data.tasks || []).filter((t) => t.bucket === activeBucket);
  }, [data, activeBucket]);

  const toggle = (key) => setActiveBucket((prev) => (prev === key ? null : key));

  return (
    <div className="dep-as">
      <div className="dep-as-bar">
        <span className="dep-as-title">Automation</span>
        {isError ? (
          <span className="dep-as-muted">
            Could not load summary.{' '}
            <button type="button" className="dep-as-link" onClick={refetch}>Retry</button>
          </span>
        ) : (
          <>
            <span className="dep-as-total">{counts.total_tasks ?? 0} tasks</span>
            {BUCKETS.map(({ key, label, tone }) => {
              const n = counts[key] ?? 0;
              return (
                <button
                  key={key}
                  type="button"
                  className={`dep-as-chip dep-as-chip--${tone}${activeBucket === key ? ' is-active' : ''}${n === 0 ? ' is-zero' : ''}`}
                  onClick={() => toggle(key)}
                  title={BUCKET_HINTS[key]}
                >
                  <span className="dep-as-chip-n">{n}</span>
                  {label}
                </button>
              );
            })}
            {isFetching && <span className="dep-as-muted">Loading…</span>}
            {data && !data.automation_applies && (
              <span className="dep-as-muted">Automation starts {data.automation_start_date}</span>
            )}
          </>
        )}
      </div>

      {activeBucket && (
        <div className="dep-as-panel">
          <div className="dep-as-hint">{BUCKET_HINTS[activeBucket]}</div>
          {rows.length === 0 ? (
            <div className="dep-as-empty">Nothing here for this date.</div>
          ) : activeBucket === 'extra_maps' ? (
            <table className="dep-as-table">
              <thead>
                <tr>
                  <th>Estate</th>
                  <th>Field</th>
                  <th>DJI map</th>
                  <th>Field / Sprayed (Ha)</th>
                  <th>Liters</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.dji_image_id}>
                    <td>{m.estate_name || `#${m.estate_id}`}</td>
                    <td>{m.field_name}</td>
                    <td>#{m.auto_generated_id || m.dji_image_id}</td>
                    <td>{fmt(m.dji_field_area)} / {fmt(m.dji_spraying_area)}</td>
                    <td>{fmt(m.dji_spraying_litres)}</td>
                    <td className="dep-as-actions">
                      <button
                        type="button"
                        className="dep-as-btn dep-as-btn--primary dep-as-btn--sm"
                        onClick={() => setAddMap(m)}
                        title={m.candidate_plans?.length ? '' : 'No active, team-assigned plan for this estate'}
                      >
                        Add to plan
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="dep-as-table">
              <thead>
                <tr>
                  <th>Estate</th>
                  <th>Field</th>
                  <th>Pilot</th>
                  <th>Pilot area (Ha)</th>
                  <th>Details</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.task_id}>
                    <td>{t.estate_name || `#${t.estate_id}`}</td>
                    <td>{t.field_name}</td>
                    <td>{t.pilot_name || '-'}</td>
                    <td>{t.pilot_field_area > 0 ? fmt(t.pilot_field_area) : '-'}</td>
                    <td>
                      {t.dji_image_id && (
                        <span className="dep-as-tag">DJI #{t.dji_auto_generated_id || t.dji_image_id}</span>
                      )}
                      {t.needs_partial_reason && (
                        <span className="dep-as-tag dep-as-tag--amber">Needs partial reason</span>
                      )}
                      {t.reason && <span className="dep-as-reason">{t.reason}</span>}
                    </td>
                    <td className="dep-as-actions">
                      <button
                        type="button"
                        className="dep-as-btn dep-as-btn--ghost dep-as-btn--sm"
                        onClick={() => onSelectPlan?.(t.plan_id)}
                      >
                        Open plan #{t.plan_id}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {addMap && (
        <AddToPlanModal
          map={addMap}
          onClose={() => setAddMap(null)}
          onAdded={(planId) => {
            setAddMap(null);
            onChanged?.(planId);
          }}
        />
      )}
    </div>
  );
};

export default DayEndAutomationSummary;
