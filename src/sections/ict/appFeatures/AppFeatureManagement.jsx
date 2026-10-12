import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGetAppFeaturesQuery, useUpdateAppFeatureMutation } from '../../../api/services NodeJs/appFeaturesApi';
import '../../../styles/ictDevelopment.css';
import '../appVersions/appVersionManagement.css';
import './appFeatureManagement.css';

const WEEKDAYS = [
  { value: 0, short: 'Sun' },
  { value: 1, short: 'Mon' },
  { value: 2, short: 'Tue' },
  { value: 3, short: 'Wed' },
  { value: 4, short: 'Thu' },
  { value: 5, short: 'Fri' },
  { value: 6, short: 'Sat' },
];

const HOLIDAY_TYPES = [
  { value: 'mercantile', label: 'Statutory' },
  { value: 'poya', label: 'Poya' },
  { value: 'special', label: 'Special' },
];

const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1);

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

const featureKeyOf = (f) => `${f.app_id}|${f.feature_key}`;

/** Short human summary of monthly_plan_request rules for the card. */
function summarizeMonthlyRules(config = {}) {
  const parts = [];
  parts.push(config.manager_only ? 'Managers only' : 'All estate users');
  const end = Number(config.window_end_day) >= 31 ? 'month end' : ordinal(Number(config.window_end_day));
  parts.push(`Window ${ordinal(Number(config.window_start_day))} – ${end}`);
  const holidays = (config.blocked_holiday_types || [])
    .map((t) => HOLIDAY_TYPES.find((h) => h.value === t)?.label || t);
  parts.push(holidays.length ? `Blocks ${holidays.join(', ')} holidays` : 'Holidays allowed');
  const days = (config.blocked_weekdays || []).map((d) => WEEKDAYS.find((w) => w.value === Number(d))?.short);
  if (days.length) parts.push(`Blocks ${days.join(', ')}`);
  parts.push(`Max ${config.max_plan_count} plans / line`);
  return parts;
}

const daysAheadText = (n) => {
  const v = Number(n);
  if (v <= 0) return 'today only';
  if (v === 1) return 'today & tomorrow';
  return `today + ${v} days`;
};

/** Short human summary of manager_approval rules for the card. */
function summarizeManagerRules(config = {}) {
  const parts = [];
  parts.push(`Approve ${daysAheadText(config.approve_days_ahead)}`);
  parts.push(config.enforce_date_order ? 'Earliest date first' : 'Any date order');
  parts.push(config.enforce_plan_size ? 'Estate plan size checked' : 'No plan size check');
  parts.push(config.chemical_limit_mode === 'block' ? 'Chemical limit blocks' : 'Chemical limit warns');
  parts.push(`Edit ${daysAheadText(config.edit_days_ahead)}`);
  parts.push(config.cancel_enabled ? 'Cancel allowed' : 'Cancel off');
  if (!config.reschedule_enabled) {
    parts.push('Reschedule off');
  } else {
    const max = Number(config.reschedule_max_days_ahead) || 0;
    parts.push(
      `Reschedule${config.reschedule_block_past ? ' (no past dates)' : ''}${max > 0 ? ` within ${max} days` : ''}`
    );
  }
  return parts;
}

function summarizeRules(feature) {
  if (feature.feature_key === 'monthly_plan_request') return summarizeMonthlyRules(feature.config);
  if (feature.feature_key === 'manager_approval') return summarizeManagerRules(feature.config);
  return [];
}

const DAYS_AHEAD_OPTIONS = Array.from({ length: 31 }, (_, i) => i);

export default function AppFeatureManagement() {
  const routerLocation = useLocation();
  const navigate = useNavigate();
  const devBgUrl = `${process.env.PUBLIC_URL || ''}/assets/images/bg.jpg`;
  const { data: features = [], isLoading, isError, error, refetch } = useGetAppFeaturesQuery();
  const [updateAppFeature, { isLoading: saving }] = useUpdateAppFeatureMutation();

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const groupedByApp = useMemo(() => {
    const map = new Map();
    features.forEach((f) => {
      if (!map.has(f.app_id)) map.set(f.app_id, { appId: f.app_id, appName: f.app_name, items: [] });
      map.get(f.app_id).items.push(f);
    });
    return [...map.values()];
  }, [features]);

  const openEdit = (feature) => {
    setEditing(feature);
    setFormError('');
    setForm({
      is_enabled: Boolean(feature.is_enabled),
      ...feature.config,
      blocked_holiday_types: [...(feature.config?.blocked_holiday_types || [])],
      blocked_weekdays: [...(feature.config?.blocked_weekdays || [])].map(Number),
    });
  };

  const closeEdit = () => {
    if (saving) return;
    setEditing(null);
    setForm(null);
    setFormError('');
  };

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const toggleInList = (field, value) =>
    setForm((prev) => {
      const list = prev[field] || [];
      return {
        ...prev,
        [field]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
      };
    });

  const validateMonthly = () => {
    const start = Number(form.window_start_day);
    const end = Number(form.window_end_day);
    const max = Number(form.max_plan_count);
    if (!Number.isInteger(start) || start < 1 || start > 31) return 'Window start day must be 1–31';
    if (!Number.isInteger(end) || end < start) return 'Window end day must be on or after the start day';
    if (!Number.isInteger(max) || max < 1 || max > 1000) return 'Max plans per line must be 1–1000';
    if ((form.blocked_weekdays || []).length >= 7) return 'At least one weekday must remain open';
    return '';
  };

  const validateManager = () => {
    const max = Number(form.reschedule_max_days_ahead);
    if (!Number.isInteger(max) || max < 0 || max > 365) return 'Reschedule max days ahead must be 0–365';
    return '';
  };

  const buildConfig = (config) => {
    if (editing.feature_key === 'monthly_plan_request') {
      return {
        ...config,
        window_start_day: Number(config.window_start_day),
        window_end_day: Number(config.window_end_day),
        max_plan_count: Number(config.max_plan_count),
      };
    }
    if (editing.feature_key === 'manager_approval') {
      return {
        ...config,
        approve_days_ahead: Number(config.approve_days_ahead),
        edit_days_ahead: Number(config.edit_days_ahead),
        reschedule_max_days_ahead: Number(config.reschedule_max_days_ahead),
      };
    }
    return config;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    let validation = '';
    if (editing.feature_key === 'monthly_plan_request') validation = validateMonthly();
    if (editing.feature_key === 'manager_approval') validation = validateManager();
    if (validation) {
      setFormError(validation);
      return;
    }
    const { is_enabled: isEnabled, ...config } = form;
    try {
      await updateAppFeature({
        app_id: editing.app_id,
        feature_key: editing.feature_key,
        is_enabled: isEnabled,
        config: buildConfig(config),
      }).unwrap();
      setSuccessMsg(`${editing.feature_name} saved.`);
      setTimeout(() => setSuccessMsg(''), 3000);
      setEditing(null);
      setForm(null);
    } catch (err) {
      setFormError(err?.data?.message || err?.error || 'Failed to save feature settings.');
    }
  };

  const renderMonthlyForm = () => (
    <>
      <div className="avm-field avm-field-toggle">
        <label>Managers only</label>
        <label className="avm-toggle">
          <input
            type="checkbox"
            checked={Boolean(form.manager_only)}
            onChange={(e) => setField('manager_only', e.target.checked)}
          />
          <span className="avm-toggle-slider" />
          <span className="avm-toggle-label">
            {form.manager_only ? 'Only estate managers can request' : 'Any estate user can request'}
          </span>
        </label>
      </div>

      <div className="afm-row">
        <div className="avm-field">
          <label>Window start day</label>
          <select
            value={form.window_start_day}
            onChange={(e) => setField('window_start_day', Number(e.target.value))}
          >
            {DAY_OPTIONS.map((d) => (
              <option key={d} value={d}>{ordinal(d)}</option>
            ))}
          </select>
        </div>
        <div className="avm-field">
          <label>Window end day</label>
          <select
            value={form.window_end_day}
            onChange={(e) => setField('window_end_day', Number(e.target.value))}
          >
            {DAY_OPTIONS.filter((d) => d < 31).map((d) => (
              <option key={d} value={d}>{ordinal(d)}</option>
            ))}
            <option value={31}>Month end</option>
          </select>
        </div>
        <div className="avm-field">
          <label>Max plans per line</label>
          <input
            type="number"
            min={1}
            max={1000}
            value={form.max_plan_count}
            onChange={(e) => setField('max_plan_count', e.target.value)}
          />
        </div>
      </div>
      <p className="avm-field-hint afm-hint">
        Requests are for next month only and accepted between these days of the current month.
      </p>

      <div className="avm-field">
        <label>Block holidays</label>
        <div className="afm-chip-group">
          {HOLIDAY_TYPES.map((h) => (
            <button
              type="button"
              key={h.value}
              className={`afm-chip ${(form.blocked_holiday_types || []).includes(h.value) ? 'afm-chip--on' : ''}`}
              onClick={() => toggleInList('blocked_holiday_types', h.value)}
            >
              {h.label}
            </button>
          ))}
        </div>
        <p className="avm-field-hint afm-hint">
          Selected holiday types (from the HR holiday calendar) cannot be picked in the mobile calendar.
        </p>
      </div>

      <div className="avm-field">
        <label>Block weekdays</label>
        <div className="afm-chip-group">
          {WEEKDAYS.map((w) => (
            <button
              type="button"
              key={w.value}
              className={`afm-chip ${(form.blocked_weekdays || []).includes(w.value) ? 'afm-chip--on' : ''}`}
              onClick={() => toggleInList('blocked_weekdays', w.value)}
            >
              {w.short}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  const renderToggle = (field, label, onText, offText) => (
    <div className="avm-field avm-field-toggle">
      <label>{label}</label>
      <label className="avm-toggle">
        <input
          type="checkbox"
          checked={Boolean(form[field])}
          onChange={(e) => setField(field, e.target.checked)}
        />
        <span className="avm-toggle-slider" />
        <span className="avm-toggle-label">{form[field] ? onText : offText}</span>
      </label>
    </div>
  );

  const renderDaysAheadSelect = (field, label) => (
    <div className="avm-field">
      <label>{label}</label>
      <select value={form[field]} onChange={(e) => setField(field, Number(e.target.value))}>
        {DAYS_AHEAD_OPTIONS.map((d) => (
          <option key={d} value={d}>
            {d === 0 ? 'Today only' : d === 1 ? 'Up to tomorrow' : `Up to ${d} days ahead`}
          </option>
        ))}
      </select>
    </div>
  );

  const renderManagerForm = () => (
    <>
      <p className="avm-field-hint afm-hint">
        Turning the feature off hides the Manager tab in the app and blocks its APIs.
      </p>

      <h4 className="afm-section-title">Approve</h4>
      <div className="afm-row">
        {renderDaysAheadSelect('approve_days_ahead', 'Approve plans dated')}
        <div className="avm-field">
          <label>Chemical per Ha limit</label>
          <select
            value={form.chemical_limit_mode}
            onChange={(e) => setField('chemical_limit_mode', e.target.value)}
          >
            <option value="warn">Warn only (manager can continue)</option>
            <option value="block">Block when over allowance</option>
          </select>
        </div>
      </div>
      <p className="avm-field-hint afm-hint">
        Pending plans after this window are listed and can be cancelled, but not approved. The chemical limit
        applies to spray plans (plantation spray max chemical, default 12 kg per Ha).
      </p>
      {renderToggle(
        'enforce_date_order',
        'Date order',
        'Earliest pending date must be cleared first',
        'Any approvable date can be approved'
      )}
      {renderToggle(
        'enforce_plan_size',
        'Plan size',
        'Selected field area must be within estate min / max Ha',
        'Estate min / max Ha not checked'
      )}

      <h4 className="afm-section-title">Edit approved plans</h4>
      <div className="afm-row">{renderDaysAheadSelect('edit_days_ahead', 'Editable plans dated')}</div>

      <h4 className="afm-section-title">Cancel &amp; reschedule</h4>
      {renderToggle('cancel_enabled', 'Cancel', 'Manager can cancel pending plans', 'Cancel button hidden')}
      {renderToggle(
        'reschedule_enabled',
        'Reschedule',
        'Manager can request a new date',
        'Reschedule button hidden'
      )}
      {form.reschedule_enabled ? (
        <>
          {renderToggle(
            'reschedule_block_past',
            'Past dates',
            'New date cannot be in the past',
            'Past dates allowed'
          )}
          <div className="afm-row">
            <div className="avm-field">
              <label>Max days ahead (0 = no limit)</label>
              <input
                type="number"
                min={0}
                max={365}
                value={form.reschedule_max_days_ahead}
                onChange={(e) => setField('reschedule_max_days_ahead', e.target.value)}
              />
            </div>
          </div>
        </>
      ) : null}
    </>
  );

  return (
    <div
      className="avm-container afm-container ict-dev-page ict-dev-stack"
      style={{ '--ict-dev-bg-url': `url("${devBgUrl}")` }}
    >
      <div className="ict-dev-page-header ict-dev-page-header-balanced">
        <div className="ict-dev-page-actions">
          <button
            className="avm-btn avm-btn-cancel"
            type="button"
            onClick={() => navigate({ pathname: '/home/ict/development/dev-center', search: routerLocation.search })}
          >
            Back to Dev Center
          </button>
        </div>
        <div className="ict-dev-page-center">
          <h2 className="ict-dev-page-title">App Features</h2>
          <p className="ict-dev-page-subtitle">Turn mobile app features on or off and manage their rules.</p>
        </div>
        <div className="ict-dev-page-actions" />
      </div>

      {successMsg && <div className="avm-flash avm-flash-success">{successMsg}</div>}

      {isLoading ? (
        <div className="avm-loading ict-dev-loading-state">Loading...</div>
      ) : isError ? (
        <div className="avm-empty ict-dev-empty-state afm-error">
          <p>{error?.data?.message || 'Could not load app features.'}</p>
          <button type="button" className="avm-btn avm-btn-cancel" onClick={refetch}>Retry</button>
        </div>
      ) : groupedByApp.length === 0 ? (
        <div className="avm-empty ict-dev-empty-state">
          <p>No app features configured.</p>
        </div>
      ) : (
        groupedByApp.map((group) => (
          <div className="ict-dev-card ict-dev-section afm-app" key={group.appId}>
            <div className="afm-app-head">
              <h3 className="ict-dev-section-title">{group.appName || group.appId}</h3>
              <span className="afm-app-id">{group.appId}</span>
            </div>
            <div className="afm-feature-list">
              {group.items.map((f) => (
                <div className="afm-feature" key={featureKeyOf(f)}>
                  <div className="afm-feature-main">
                    <div className="afm-feature-title">
                      <span>{f.feature_name}</span>
                      <span className={`avm-badge ${f.is_enabled ? 'badge-active' : 'badge-inactive'}`}>
                        {f.is_enabled ? 'On' : 'Off'}
                      </span>
                    </div>
                    {f.description ? <div className="afm-feature-desc">{f.description}</div> : null}
                    {summarizeRules(f).length ? (
                      <div className="afm-rule-list">
                        {summarizeRules(f).map((r) => (
                          <span className="afm-rule" key={r}>{r}</span>
                        ))}
                      </div>
                    ) : null}
                    <div className="afm-feature-meta">
                      {f.updated_at
                        ? `Updated ${f.updated_at}${f.updated_by_name ? ` by ${f.updated_by_name}` : ''}`
                        : 'Using default settings'}
                    </div>
                  </div>
                  {f.registered ? (
                    <button type="button" className="avm-btn avm-btn-edit" onClick={() => openEdit(f)}>
                      Edit
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {editing && form && (
        <div className="avm-modal-overlay" onClick={closeEdit}>
          <div className="avm-modal afm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="avm-modal-header">
              <h2>{editing.feature_name}</h2>
              <button className="avm-modal-close" type="button" onClick={closeEdit}>×</button>
            </div>
            <form onSubmit={handleSave} className="avm-form afm-form">
              <div className="avm-field avm-field-toggle">
                <label>Feature</label>
                <label className="avm-toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(form.is_enabled)}
                    onChange={(e) => setField('is_enabled', e.target.checked)}
                  />
                  <span className="avm-toggle-slider" />
                  <span className="avm-toggle-label">
                    {form.is_enabled ? 'On — available in the app' : 'Off — hidden / blocked in the app'}
                  </span>
                </label>
              </div>

              {editing.feature_key === 'monthly_plan_request' ? renderMonthlyForm() : null}
              {editing.feature_key === 'manager_approval' ? renderManagerForm() : null}

              {formError ? <div className="avm-flash avm-flash-error afm-form-error">{formError}</div> : null}

              <div className="avm-form-actions">
                <button type="submit" className="avm-btn avm-btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button type="button" className="avm-btn avm-btn-cancel" onClick={closeEdit} disabled={saving}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
