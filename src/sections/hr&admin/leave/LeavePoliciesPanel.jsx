import React, { useMemo, useState } from 'react';
import {
  useListHrLeaveAdminPoliciesQuery,
  useSaveHrLeaveAdminPolicyMutation,
} from '../../../api/services NodeJs/hrLeaveApi';

const WEEKDAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

function parseExcludedWeekdays(raw) {
  if (!raw) return [0, 6];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) {
      return parsed.map((day) => Number(day)).filter((day) => Number.isFinite(day));
    }
  } catch {
    // fall through
  }
  return [0, 6];
}

function serializeExcludedWeekdays(selectedDays) {
  const sorted = [...selectedDays].sort((a, b) => a - b);
  return JSON.stringify(sorted);
}

function formatExcludedWeekdaysLabel(raw) {
  const days = parseExcludedWeekdays(raw);
  if (!days.length) return 'None';
  return days
    .map((value) => WEEKDAYS.find((day) => day.value === value)?.label)
    .filter(Boolean)
    .join(', ');
}

function policyDraftFromRow(row) {
  return {
    leave_type_code: row.leave_type_code || '',
    max_consecutive_days: row.max_consecutive_days ?? '',
    max_per_month: row.max_per_month ?? '',
    max_instances_per_month: row.max_instances_per_month ?? '',
    max_days_per_request: row.max_days_per_request ?? '',
    max_short_minutes: row.max_short_minutes ?? '',
    short_mode_only: String(Number(row.short_mode_only ?? 0) === 1 ? 1 : 0),
    requires_attachment_after_days: row.requires_attachment_after_days ?? '',
    min_calendar_years_after_join: row.min_calendar_years_after_join ?? '',
    min_advance_days: row.min_advance_days ?? '',
    counts_working_days_only: String(Number(row.counts_working_days_only ?? 1) === 1 ? 1 : 0),
    excluded_weekdays: parseExcludedWeekdays(row.excluded_weekdays),
    eligible_job_categories: row.eligible_job_categories || '',
  };
}

function displayLimit(value) {
  return value === null || value === undefined || value === '' ? 'No limit' : value;
}

export default function LeavePoliciesPanel({ onMessage }) {
  const { data: response, isLoading, refetch } = useListHrLeaveAdminPoliciesQuery({});
  const [savePolicy, { isLoading: saving }] = useSaveHrLeaveAdminPolicyMutation();
  const [editRow, setEditRow] = useState(null);
  const [draft, setDraft] = useState(null);

  const rows = useMemo(() => response?.data || [], [response]);

  const notify = (text, isError = false) => onMessage?.(text, isError);

  const openEdit = (row) => {
    setEditRow(row);
    setDraft(policyDraftFromRow(row));
  };

  const closeModal = () => {
    setEditRow(null);
    setDraft(null);
  };

  const toggleExcludedWeekday = (dayValue) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const current = new Set(prev.excluded_weekdays || []);
      if (current.has(dayValue)) current.delete(dayValue);
      else current.add(dayValue);
      return { ...prev, excluded_weekdays: Array.from(current).sort((a, b) => a - b) };
    });
  };

  const onSave = async () => {
    if (!draft) return;
    const isShortModeOnly = parseInt(draft.short_mode_only, 10) === 1;
    try {
      await savePolicy({
        leave_type_code: draft.leave_type_code,
        max_consecutive_days: isShortModeOnly || draft.max_consecutive_days === '' ? null : Number(draft.max_consecutive_days),
        max_per_month: draft.max_per_month === '' ? null : Number(draft.max_per_month),
        max_instances_per_month: draft.max_instances_per_month === '' ? null : parseInt(draft.max_instances_per_month, 10),
        max_days_per_request: isShortModeOnly || draft.max_days_per_request === '' ? null : Number(draft.max_days_per_request),
        max_short_minutes: isShortModeOnly && draft.max_short_minutes !== ''
          ? parseInt(draft.max_short_minutes, 10)
          : null,
        requires_attachment_after_days: isShortModeOnly || draft.requires_attachment_after_days === '' ? null : Number(draft.requires_attachment_after_days),
        min_calendar_years_after_join: isShortModeOnly || draft.min_calendar_years_after_join === '' ? null : parseInt(draft.min_calendar_years_after_join, 10),
        min_advance_days: isShortModeOnly || draft.min_advance_days === '' ? null : parseInt(draft.min_advance_days, 10),
        short_mode_only: isShortModeOnly ? 1 : 0,
        counts_working_days_only: isShortModeOnly ? 0 : (parseInt(draft.counts_working_days_only, 10) === 1 ? 1 : 0),
        excluded_weekdays: isShortModeOnly ? null : serializeExcludedWeekdays(draft.excluded_weekdays || []),
        eligible_job_categories: draft.eligible_job_categories || null,
      }).unwrap();
      notify('Leave policy saved.');
      closeModal();
      refetch();
    } catch (err) {
      notify(err?.data?.message || 'Failed to save policy.', true);
    }
  };

  return (
    <div className="leave-grid-leavemgt">
      <div className="leave-card-leavemgt leave-span-2-leavemgt">
        <div className="leave-card-header-leavemgt">
          <h3>Leave Policies</h3>
          <span className="leave-muted-leavemgt">Set limits and rules when employees apply for each leave type</span>
        </div>
        <div className="leave-admin-table-wrap-leavemgt">
          <table className="leave-admin-table-leavemgt">
            <thead>
              <tr>
                <th>Leave type</th>
                <th>Max days at once</th>
                <th>Max days in a row</th>
                <th>Monthly limit</th>
                <th>Times per month</th>
                <th>Short leave (min)</th>
                <th>Medical file after (days)</th>
                <th>Available after (years)</th>
                <th>Min advance (days)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={10}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={10}>No policies found. Add leave types first.</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.leave_type_code}>
                    <td>
                      <strong>{row.leave_type_name || row.leave_type_code}</strong>
                      <div className="leave-subtext-leavemgt"><code>{row.leave_type_code}</code></div>
                    </td>
                    <td>{displayLimit(row.max_days_per_request)}</td>
                    <td>{displayLimit(row.max_consecutive_days)}</td>
                    <td>{displayLimit(row.max_per_month)}</td>
                    <td>{displayLimit(row.max_instances_per_month)}</td>
                    <td>{displayLimit(row.max_short_minutes)}</td>
                    <td>{displayLimit(row.requires_attachment_after_days)}</td>
                    <td>{displayLimit(row.min_calendar_years_after_join)}</td>
                    <td>{displayLimit(row.min_advance_days)}</td>
                    <td>
                      <button type="button" className="leave-btn-leavemgt leave-btn-secondary-leavemgt" onClick={() => openEdit(row)}>
                        Edit policy
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {draft ? (() => {
        const isShortModeOnly = draft.short_mode_only === '1';
        const lockDayFields = isShortModeOnly;
        const lockShortFields = !isShortModeOnly;
        const inputClass = (locked) =>
          `leave-holiday-modal-input-leavemgt${locked ? ' leave-policy-input-locked-leavemgt' : ''}`;

        return (
        <div className="leave-holiday-modal-overlay-leavemgt" role="presentation" onClick={closeModal}>
          <div className="leave-holiday-modal-leavemgt leave-admin-modal-leavemgt leave-admin-modal-wide-leavemgt" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h4>Edit policy — {editRow?.leave_type_name || draft.leave_type_code}</h4>
            <p className="leave-muted-leavemgt leave-policy-modal-hint-leavemgt">
              Leave a field blank if there is no limit for that rule.
            </p>

            <div className="leave-policy-mode-toggle-leavemgt">
              <label className={`leave-checkbox-chip-leavemgt leave-policy-mode-chip-leavemgt ${isShortModeOnly ? 'active-leavemgt' : ''}`}>
                <input
                  type="checkbox"
                  checked={isShortModeOnly}
                  onChange={(e) => setDraft((p) => ({
                    ...p,
                    short_mode_only: e.target.checked ? '1' : '0',
                    counts_working_days_only: e.target.checked ? '0' : p.counts_working_days_only,
                  }))}
                />
                Short leave only (minutes, not full days)
              </label>
              <p className="leave-muted-leavemgt leave-policy-field-help-leavemgt">
                {isShortModeOnly
                  ? 'Day-based limits are disabled. Set minutes and monthly short-leave limits below.'
                  : 'Full-day leave rules apply. Short-leave minutes field is disabled.'}
              </p>
            </div>

            <div className="leave-admin-form-grid-leavemgt leave-admin-form-grid-2-leavemgt">
              <div>
                <label className={`leave-holiday-modal-label-leavemgt${lockDayFields ? ' leave-policy-label-locked-leavemgt' : ''}`}>Max days at once</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className={inputClass(lockDayFields)}
                  placeholder="e.g. 2"
                  value={draft.max_days_per_request}
                  disabled={lockDayFields}
                  onChange={(e) => setDraft((p) => ({ ...p, max_days_per_request: e.target.value }))}
                />
              </div>
              <div>
                <label className={`leave-holiday-modal-label-leavemgt${lockDayFields ? ' leave-policy-label-locked-leavemgt' : ''}`}>Max days in a row</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className={inputClass(lockDayFields)}
                  placeholder="No limit"
                  value={draft.max_consecutive_days}
                  disabled={lockDayFields}
                  onChange={(e) => setDraft((p) => ({ ...p, max_consecutive_days: e.target.value }))}
                />
              </div>
              <div>
                <label className="leave-holiday-modal-label-leavemgt">
                  {isShortModeOnly ? 'Monthly limit (hours)' : 'Monthly limit (days or hours)'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className="leave-holiday-modal-input-leavemgt"
                  placeholder={isShortModeOnly ? 'e.g. 3' : 'No limit'}
                  value={draft.max_per_month}
                  onChange={(e) => setDraft((p) => ({ ...p, max_per_month: e.target.value }))}
                />
              </div>
              <div>
                <label className="leave-holiday-modal-label-leavemgt">Times allowed per month</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="leave-holiday-modal-input-leavemgt"
                  placeholder="No limit"
                  value={draft.max_instances_per_month}
                  onChange={(e) => setDraft((p) => ({ ...p, max_instances_per_month: e.target.value }))}
                />
              </div>
              <div>
                <label className={`leave-holiday-modal-label-leavemgt${lockShortFields ? ' leave-policy-label-locked-leavemgt' : ''}`}>Short leave — max minutes</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={inputClass(lockShortFields)}
                  placeholder="e.g. 90"
                  value={draft.max_short_minutes}
                  disabled={lockShortFields}
                  onChange={(e) => setDraft((p) => ({ ...p, max_short_minutes: e.target.value }))}
                />
              </div>
              <div>
                <label className={`leave-holiday-modal-label-leavemgt${lockDayFields ? ' leave-policy-label-locked-leavemgt' : ''}`}>Medical certificate required after (days)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className={inputClass(lockDayFields)}
                  placeholder="e.g. 2"
                  value={draft.requires_attachment_after_days}
                  disabled={lockDayFields}
                  onChange={(e) => setDraft((p) => ({ ...p, requires_attachment_after_days: e.target.value }))}
                />
              </div>
              <div>
                <label className={`leave-holiday-modal-label-leavemgt${lockDayFields ? ' leave-policy-label-locked-leavemgt' : ''}`}>Available after joining (calendar years)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={inputClass(lockDayFields)}
                  placeholder="e.g. 1 = from 2nd year"
                  value={draft.min_calendar_years_after_join}
                  disabled={lockDayFields}
                  onChange={(e) => setDraft((p) => ({ ...p, min_calendar_years_after_join: e.target.value }))}
                />
              </div>
              <div>
                <label className={`leave-holiday-modal-label-leavemgt${lockDayFields ? ' leave-policy-label-locked-leavemgt' : ''}`}>Minimum advance notice (days)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={inputClass(lockDayFields)}
                  placeholder="e.g. 3 = request 3 days before start"
                  value={draft.min_advance_days}
                  disabled={lockDayFields}
                  onChange={(e) => setDraft((p) => ({ ...p, min_advance_days: e.target.value }))}
                />
              </div>
              <div className="leave-admin-form-span-2-leavemgt">
                <label className="leave-holiday-modal-label-leavemgt">Allowed job categories</label>
                <input
                  className="leave-holiday-modal-input-leavemgt"
                  value={draft.eligible_job_categories}
                  onChange={(e) => setDraft((p) => ({ ...p, eligible_job_categories: e.target.value }))}
                  placeholder="e.g. Executive (leave blank for all employees)"
                />
              </div>
            </div>

            <div className={`leave-policy-weekdays-block-leavemgt${lockDayFields ? ' leave-policy-section-locked-leavemgt' : ''}`}>
              <label className={`leave-holiday-modal-label-leavemgt${lockDayFields ? ' leave-policy-label-locked-leavemgt' : ''}`}>Days not counted as leave</label>
              <p className="leave-muted-leavemgt leave-policy-field-help-leavemgt">
                {lockDayFields
                  ? 'Not used for short leave (minutes only).'
                  : 'Tick the days that should be skipped when calculating leave duration (weekends are usually excluded).'}
              </p>
              <div className="leave-admin-form-grid-leavemgt">
                {WEEKDAYS.map((day) => (
                  <label key={day.value} className={`leave-checkbox-chip-leavemgt${lockDayFields ? ' leave-policy-chip-locked-leavemgt' : ''}`}>
                    <input
                      type="checkbox"
                      checked={(draft.excluded_weekdays || []).includes(day.value)}
                      disabled={lockDayFields}
                      onChange={() => toggleExcludedWeekday(day.value)}
                    />
                    {day.label}
                  </label>
                ))}
              </div>
              {!lockDayFields ? (
                <p className="leave-muted-leavemgt leave-policy-field-help-leavemgt">
                  Currently excluded: {formatExcludedWeekdaysLabel(serializeExcludedWeekdays(draft.excluded_weekdays || []))}
                </p>
              ) : null}
            </div>

            <div className="leave-admin-form-grid-leavemgt" style={{ marginTop: 12 }}>
              <label className={`leave-checkbox-chip-leavemgt${lockDayFields ? ' leave-policy-chip-locked-leavemgt' : ''}`}>
                <input
                  type="checkbox"
                  checked={draft.counts_working_days_only === '1'}
                  disabled={lockDayFields}
                  onChange={(e) => setDraft((p) => ({ ...p, counts_working_days_only: e.target.checked ? '1' : '0' }))}
                />
                Count working days only (skip weekends/holidays in duration)
              </label>
            </div>
            <div className="leave-holiday-modal-actions-leavemgt">
              <button type="button" className="leave-btn-leavemgt leave-btn-approve-leavemgt" disabled={saving} onClick={onSave}>
                {saving ? 'Saving…' : 'Save policy'}
              </button>
              <button type="button" className="leave-btn-leavemgt leave-btn-secondary-leavemgt" onClick={closeModal}>Cancel</button>
            </div>
          </div>
        </div>
        );
      })() : null}
    </div>
  );
}
