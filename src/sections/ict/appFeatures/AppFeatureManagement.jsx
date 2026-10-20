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
const DAYS_AHEAD_OPTIONS = Array.from({ length: 31 }, (_, i) => i);

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

const featureKeyOf = (f) => `${f.app_id}|${f.feature_key}`;

const daysAheadText = (n) => {
  const v = Number(n);
  if (v <= 0) return 'today only';
  if (v === 1) return 'today & tomorrow';
  return `today + ${v} days`;
};

function summarizeMonthlyRules(config = {}) {
  const parts = [];
  parts.push(config.manager_only ? 'Managers only' : 'All estate users');
  const end = Number(config.window_end_day) >= 31 ? 'month end' : ordinal(Number(config.window_end_day));
  parts.push(`Window ${ordinal(Number(config.window_start_day))} – ${end}`);
  const holidays = (config.blocked_holiday_types || []).map(
    (t) => HOLIDAY_TYPES.find((h) => h.value === t)?.label || t
  );
  parts.push(holidays.length ? `Blocks ${holidays.join(', ')} holidays` : 'Holidays allowed');
  const days = (config.blocked_weekdays || []).map(
    (d) => WEEKDAYS.find((w) => w.value === Number(d))?.short
  );
  if (days.length) parts.push(`Blocks ${days.join(', ')}`);
  parts.push(`Max ${config.max_plan_count} plans / line`);
  return parts;
}

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

function SwitchRow({ label, description, checked, onChange, disabled }) {
  return (
    <label className={`afm-switch-row${disabled ? ' is-disabled' : ''}`}>
      <span className="afm-switch-copy">
        <span className="afm-switch-label">{label}</span>
        {description ? <span className="afm-switch-desc">{description}</span> : null}
      </span>
      <span className="afm-switch">
        <input type="checkbox" checked={Boolean(checked)} onChange={onChange} disabled={disabled} />
        <span className="afm-switch-track" aria-hidden />
      </span>
    </label>
  );
}

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

  const enabledCount = useMemo(
    () => features.filter((f) => f.is_enabled).length,
    [features]
  );

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

  const renderDaysAheadSelect = (field, label, hint) => (
    <div className="afm-field">
      <label htmlFor={`afm-${field}`}>{label}</label>
      <select
        id={`afm-${field}`}
        value={form[field]}
        onChange={(e) => setField(field, Number(e.target.value))}
      >
        {DAYS_AHEAD_OPTIONS.map((d) => (
          <option key={d} value={d}>
            {d === 0 ? 'Today only' : d === 1 ? 'Up to tomorrow' : `Up to ${d} days ahead`}
          </option>
        ))}
      </select>
      {hint ? <p className="afm-field-hint">{hint}</p> : null}
    </div>
  );

  const renderMonthlyForm = () => (
    <>
      <section className="afm-panel">
        <header className="afm-panel-head">
          <h4>Who can request</h4>
          <p>Control which plantation users may submit monthly plan requests.</p>
        </header>
        <SwitchRow
          label="Managers only"
          description={
            form.manager_only
              ? 'Only estate managers can request'
              : 'Any estate user can request'
          }
          checked={form.manager_only}
          onChange={(e) => setField('manager_only', e.target.checked)}
        />
      </section>

      <section className="afm-panel">
        <header className="afm-panel-head">
          <h4>Request window</h4>
          <p>Accepted between these days of the current month, for next month only.</p>
        </header>
        <div className="afm-grid afm-grid--3">
          <div className="afm-field">
            <label htmlFor="afm-window-start">Start day</label>
            <select
              id="afm-window-start"
              value={form.window_start_day}
              onChange={(e) => setField('window_start_day', Number(e.target.value))}
            >
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>{ordinal(d)}</option>
              ))}
            </select>
          </div>
          <div className="afm-field">
            <label htmlFor="afm-window-end">End day</label>
            <select
              id="afm-window-end"
              value={form.window_end_day}
              onChange={(e) => setField('window_end_day', Number(e.target.value))}
            >
              {DAY_OPTIONS.filter((d) => d < 31).map((d) => (
                <option key={d} value={d}>{ordinal(d)}</option>
              ))}
              <option value={31}>Month end</option>
            </select>
          </div>
          <div className="afm-field">
            <label htmlFor="afm-max-plans">Max plans / line</label>
            <input
              id="afm-max-plans"
              type="number"
              min={1}
              max={1000}
              value={form.max_plan_count}
              onChange={(e) => setField('max_plan_count', e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="afm-panel">
        <header className="afm-panel-head">
          <h4>Blocked days</h4>
          <p>Selected holiday types and weekdays cannot be picked in the mobile calendar.</p>
        </header>
        <div className="afm-field">
          <span className="afm-field-caption">Holidays</span>
          <div className="afm-chip-group">
            {HOLIDAY_TYPES.map((h) => (
              <button
                type="button"
                key={h.value}
                className={`afm-chip ${(form.blocked_holiday_types || []).includes(h.value) ? 'is-on' : ''}`}
                onClick={() => toggleInList('blocked_holiday_types', h.value)}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>
        <div className="afm-field">
          <span className="afm-field-caption">Weekdays</span>
          <div className="afm-chip-group">
            {WEEKDAYS.map((w) => (
              <button
                type="button"
                key={w.value}
                className={`afm-chip ${(form.blocked_weekdays || []).includes(w.value) ? 'is-on' : ''}`}
                onClick={() => toggleInList('blocked_weekdays', w.value)}
              >
                {w.short}
              </button>
            ))}
          </div>
        </div>
      </section>
    </>
  );

  const renderManagerForm = () => (
    <>
      <section className="afm-panel">
        <header className="afm-panel-head">
          <h4>Approve</h4>
          <p>
            Pending plans after this window stay listed and can be cancelled, but not approved.
            Chemical limit applies to spray plans (default 12 kg per Ha).
          </p>
        </header>
        <div className="afm-grid afm-grid--2">
          {renderDaysAheadSelect('approve_days_ahead', 'Approve plans dated')}
          <div className="afm-field">
            <label htmlFor="afm-chem-mode">Chemical per Ha limit</label>
            <select
              id="afm-chem-mode"
              value={form.chemical_limit_mode}
              onChange={(e) => setField('chemical_limit_mode', e.target.value)}
            >
              <option value="warn">Warn only — manager can continue</option>
              <option value="block">Block when over allowance</option>
            </select>
          </div>
        </div>
        <div className="afm-switch-stack">
          <SwitchRow
            label="Date order"
            description={
              form.enforce_date_order
                ? 'Earliest pending date must be cleared first'
                : 'Any approvable date can be approved'
            }
            checked={form.enforce_date_order}
            onChange={(e) => setField('enforce_date_order', e.target.checked)}
          />
          <SwitchRow
            label="Plan size"
            description={
              form.enforce_plan_size
                ? 'Selected field area must be within estate min / max Ha'
                : 'Estate min / max Ha not checked'
            }
            checked={form.enforce_plan_size}
            onChange={(e) => setField('enforce_plan_size', e.target.checked)}
          />
        </div>
      </section>

      <section className="afm-panel">
        <header className="afm-panel-head">
          <h4>Edit approved plans</h4>
          <p>How far ahead managers may change an already approved plan.</p>
        </header>
        {renderDaysAheadSelect('edit_days_ahead', 'Editable plans dated')}
      </section>

      <section className="afm-panel">
        <header className="afm-panel-head">
          <h4>Cancel &amp; reschedule</h4>
          <p>Buttons on the Manager tab follow these switches.</p>
        </header>
        <div className="afm-switch-stack">
          <SwitchRow
            label="Cancel"
            description={
              form.cancel_enabled ? 'Manager can cancel pending plans' : 'Cancel button hidden'
            }
            checked={form.cancel_enabled}
            onChange={(e) => setField('cancel_enabled', e.target.checked)}
          />
          <SwitchRow
            label="Reschedule"
            description={
              form.reschedule_enabled
                ? 'Manager can request a new date'
                : 'Reschedule button hidden'
            }
            checked={form.reschedule_enabled}
            onChange={(e) => setField('reschedule_enabled', e.target.checked)}
          />
        </div>
        {form.reschedule_enabled ? (
          <div className="afm-subpanel">
            <SwitchRow
              label="Past dates"
              description={
                form.reschedule_block_past
                  ? 'New date cannot be in the past'
                  : 'Past dates allowed'
              }
              checked={form.reschedule_block_past}
              onChange={(e) => setField('reschedule_block_past', e.target.checked)}
            />
            <div className="afm-field">
              <label htmlFor="afm-resched-max">Max days ahead</label>
              <input
                id="afm-resched-max"
                type="number"
                min={0}
                max={365}
                value={form.reschedule_max_days_ahead}
                onChange={(e) => setField('reschedule_max_days_ahead', e.target.value)}
              />
              <p className="afm-field-hint">Use 0 for no limit.</p>
            </div>
          </div>
        ) : null}
      </section>
    </>
  );

  return (
    <div
      className="avm-container afm-page ict-dev-page ict-dev-stack"
      style={{ '--ict-dev-bg-url': `url("${devBgUrl}")` }}
    >
      <header className="afm-hero">
        <div className="afm-hero-main">
          <button
            className="afm-back"
            type="button"
            onClick={() =>
              navigate({
                pathname: '/home/ict/development/dev-center',
                search: routerLocation.search,
              })
            }
          >
            ← Dev Center
          </button>
          <div>
            <h1 className="afm-hero-title">App Features</h1>
            <p className="afm-hero-sub">
              Turn mobile app features on or off and manage their rules from ICT.
            </p>
          </div>
        </div>
        {!isLoading && !isError && features.length > 0 ? (
          <div className="afm-hero-stats">
            <div className="afm-stat">
              <span className="afm-stat-value">{features.length}</span>
              <span className="afm-stat-label">Features</span>
            </div>
            <div className="afm-stat">
              <span className="afm-stat-value">{enabledCount}</span>
              <span className="afm-stat-label">On</span>
            </div>
            <div className="afm-stat">
              <span className="afm-stat-value">{groupedByApp.length}</span>
              <span className="afm-stat-label">Apps</span>
            </div>
          </div>
        ) : null}
      </header>

      {successMsg ? <div className="afm-flash afm-flash--ok">{successMsg}</div> : null}

      {isLoading ? (
        <div className="afm-state">Loading features…</div>
      ) : isError ? (
        <div className="afm-state afm-state--error">
          <p>{error?.data?.message || 'Could not load app features.'}</p>
          <button type="button" className="afm-btn afm-btn--ghost" onClick={refetch}>
            Retry
          </button>
        </div>
      ) : groupedByApp.length === 0 ? (
        <div className="afm-state">No app features configured.</div>
      ) : (
        groupedByApp.map((group) => (
          <section className="afm-app-card" key={group.appId}>
            <header className="afm-app-head">
              <div>
                <h2>{group.appName || 'Untitled app'}</h2>
                <code className="afm-app-id">{group.appId}</code>
              </div>
              <span className="afm-app-count">
                {group.items.length} feature{group.items.length === 1 ? '' : 's'}
              </span>
            </header>

            <div className="afm-feature-grid">
              {group.items.map((f) => {
                const rules = summarizeRules(f);
                return (
                  <article
                    className={`afm-feature-card${f.is_enabled ? '' : ' is-off'}`}
                    key={featureKeyOf(f)}
                  >
                    <div className="afm-feature-top">
                      <div className="afm-feature-title-block">
                        <h3>{f.feature_name}</h3>
                        <span className={`afm-status ${f.is_enabled ? 'is-on' : 'is-off'}`}>
                          {f.is_enabled ? 'On' : 'Off'}
                        </span>
                      </div>
                      {f.registered ? (
                        <button
                          type="button"
                          className="afm-btn afm-btn--primary"
                          onClick={() => openEdit(f)}
                        >
                          Edit rules
                        </button>
                      ) : null}
                    </div>
                    {f.description ? <p className="afm-feature-desc">{f.description}</p> : null}
                    {rules.length ? (
                      <ul className="afm-rule-list">
                        {rules.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    ) : null}
                    <footer className="afm-feature-meta">
                      {f.updated_at
                        ? `Updated ${f.updated_at}${f.updated_by_name ? ` · ${f.updated_by_name}` : ''}`
                        : 'Using default settings'}
                    </footer>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}

      {editing && form ? (
        <div className="afm-overlay" onClick={closeEdit} role="presentation">
          <div
            className="afm-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="afm-modal-title"
          >
            <header className="afm-modal-header">
              <div>
                <p className="afm-modal-eyebrow">{editing.app_name || editing.app_id}</p>
                <h2 id="afm-modal-title">{editing.feature_name}</h2>
                {editing.description ? (
                  <p className="afm-modal-sub">{editing.description}</p>
                ) : null}
              </div>
              <button type="button" className="afm-modal-close" onClick={closeEdit} aria-label="Close">
                ×
              </button>
            </header>

            <form onSubmit={handleSave} className="afm-modal-body">
              <section className="afm-panel afm-panel--master">
                <SwitchRow
                  label="Feature enabled"
                  description={
                    form.is_enabled
                      ? 'On — available in the app'
                      : 'Off — hidden / blocked in the app'
                  }
                  checked={form.is_enabled}
                  onChange={(e) => setField('is_enabled', e.target.checked)}
                />
              </section>

              {editing.feature_key === 'monthly_plan_request' ? renderMonthlyForm() : null}
              {editing.feature_key === 'manager_approval' ? renderManagerForm() : null}

              {formError ? <div className="afm-flash afm-flash--error">{formError}</div> : null}

              <footer className="afm-modal-footer">
                <button
                  type="button"
                  className="afm-btn afm-btn--ghost"
                  onClick={closeEdit}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="afm-btn afm-btn--primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
