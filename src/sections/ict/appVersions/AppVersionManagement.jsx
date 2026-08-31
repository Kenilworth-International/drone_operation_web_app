import React, { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  useGetAppVersionsQuery,
  useCreateAppVersionMutation,
  useUpdateAppVersionMutation,
} from '../../../api/services NodeJs/appVersionsApi';
import '../../../styles/ictDevelopment.css';
import './appVersionManagement.css';

const PLATFORM_OPTIONS = [
  { value: 'android', label: 'Android' },
  { value: 'ios', label: 'iOS' },
  { value: 'both', label: 'Both' },
];

const emptyForm = {
  app_id: '',
  app_name: '',
  platform: 'android',
  min_version: '',
  latest_version: '',
  store_url: '',
  force_update: 1,
  update_message: '',
  is_active: 1,
  maintenance: 0,
  maintenance_message: '',
  otp_bypass_mobile: '',
  block_developer_mode: 0,
};

/** API / MySQL may send 0/1 as strings; JS treats non-empty strings as truthy — normalize for toggles and badges. */
function toBit(value, defaultWhenMissing = 0) {
  if (value === true || value === 1) return 1;
  if (value === false || value === 0) return 0;
  if (value === undefined || value === null) return defaultWhenMissing;
  const s = String(value).trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 'yes') return 1;
  return 0;
}

export default function AppVersionManagement() {
  const routerLocation = useLocation();
  const navigate = useNavigate();
  const devBgUrl = `${process.env.PUBLIC_URL || ''}/assets/images/bg.jpg`;
  const { data: versions = [], isLoading, refetch } = useGetAppVersionsQuery();
  const [createAppVersion, { isLoading: creating }] = useCreateAppVersionMutation();
  const [updateAppVersion, { isLoading: updating }] = useUpdateAppVersionMutation();

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return versions;
    const q = search.toLowerCase();
    return versions.filter(
      (v) =>
        v.app_name?.toLowerCase().includes(q) ||
        v.app_id?.toLowerCase().includes(q) ||
        v.min_version?.toLowerCase().includes(q) ||
        v.latest_version?.toLowerCase().includes(q)
    );
  }, [versions, search]);

  const flash = (msg, type = 'success') => {
    if (type === 'success') {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 3000);
    } else {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      app_id: row.app_id || '',
      app_name: row.app_name || '',
      platform: row.platform || 'android',
      min_version: row.min_version || '',
      latest_version: row.latest_version || '',
      store_url: row.store_url || '',
      force_update: toBit(row.force_update, 1),
      update_message: row.update_message || '',
      is_active: toBit(row.is_active, 1),
      maintenance: toBit(row.maintenance, 0),
      maintenance_message: row.maintenance_message || '',
      otp_bypass_mobile: row.otp_bypass_mobile || '',
      block_developer_mode: toBit(row.block_developer_mode, 0),
    });
    setShowModal(true);
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateAppVersion({ id: editingId, ...form }).unwrap();
        flash('App version updated successfully.');
      } else {
        await createAppVersion(form).unwrap();
        flash('App version created successfully.');
      }
      setShowModal(false);
      refetch();
    } catch (err) {
      flash(err?.data?.message || 'Operation failed.', 'error');
    }
  };

  const getPlatformBadge = (platform) => {
    const map = { android: 'badge-android', ios: 'badge-ios', both: 'badge-both' };
    return <span className={`avm-badge ${map[platform] || 'badge-both'}`}>{platform}</span>;
  };

  return (
    <div
      className="avm-container ict-dev-page ict-dev-stack"
      style={{ '--ict-dev-bg-url': `url("${devBgUrl}")` }}
    >
      {/* Header */}
      <div className="ict-dev-page-header ict-dev-page-header-balanced">
        <div className="ict-dev-page-actions">
          <button className="avm-btn avm-btn-cancel" type="button" onClick={() => navigate({ pathname: '/home/ict/development/dev-center', search: routerLocation.search })}>
            Back to Dev Center
          </button>
        </div>
        <div className="ict-dev-page-center">
          <h2 className="ict-dev-page-title">App Version Management</h2>
          <p className="ict-dev-page-subtitle">Manage minimum required versions for all applications from one panel.</p>
        </div>
        <div className="ict-dev-page-actions">
          <button className="avm-btn avm-btn-primary" type="button" onClick={openCreate}>
            Add New App
          </button>
        </div>
      </div>

      {/* Flash Messages */}
      {successMsg && <div className="avm-flash avm-flash-success">{successMsg}</div>}
      {errorMsg && <div className="avm-flash avm-flash-error">{errorMsg}</div>}

      {/* Search */}
      <div className="avm-search-bar ict-dev-card">
        <input
          type="text"
          placeholder="Search by app name, ID, or version..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="avm-search-input"
        />
        <span className="avm-search-count">{filtered.length} app{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="avm-loading ict-dev-loading-state">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="avm-empty ict-dev-empty-state">
          <p>No app versions found.</p>
        </div>
      ) : (
        <div className="avm-table-wrap ict-dev-card ict-dev-section">
          <h3 className="ict-dev-section-title">App Version List</h3>
          <table className="avm-table">
            <thead>
              <tr>
                <th>App Name</th>
                <th>App ID</th>
                <th>Platform</th>
                <th>Min Version</th>
                <th>Latest Version</th>
                <th>Force Update</th>
                <th>Maintenance</th>
                <th>Block Dev Mode</th>
                <th>OTP Bypass</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td className="avm-cell-name">{row.app_name}</td>
                  <td className="avm-cell-id">{row.app_id}</td>
                  <td>{getPlatformBadge(row.platform)}</td>
                  <td><span className="avm-version">{row.min_version}</span></td>
                  <td><span className="avm-version">{row.latest_version}</span></td>
                  <td>
                    <span className={`avm-badge ${toBit(row.force_update, 1) ? 'badge-force' : 'badge-soft'}`}>
                      {toBit(row.force_update, 1) ? 'Force' : 'Soft'}
                    </span>
                  </td>
                  <td>
                    <span className={`avm-badge ${toBit(row.maintenance, 0) ? 'badge-maintenance' : 'badge-normal'}`}>
                      {toBit(row.maintenance, 0) ? 'On' : 'Off'}
                    </span>
                  </td>
                  <td>
                    <span className={`avm-badge ${toBit(row.block_developer_mode, 0) ? 'badge-force' : 'badge-soft'}`}>
                      {toBit(row.block_developer_mode, 0) ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="avm-cell-id">{row.otp_bypass_mobile || '—'}</td>
                  <td>
                    <span className={`avm-badge ${toBit(row.is_active, 1) ? 'badge-active' : 'badge-inactive'}`}>
                      {toBit(row.is_active, 1) ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="avm-actions">
                      <button className="avm-btn avm-btn-edit" onClick={() => openEdit(row)} title="Edit">
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Store URL preview */}
      {filtered.length > 0 && (
        <div className="avm-info-note">
          <strong>Tip:</strong> Turning <strong>Maintenance</strong> ON blocks the mobile app for <strong>all users</strong> on
          every platform until you turn it OFF (message shown is <strong>Maintenance Message</strong>).{' '}
          <strong>Block Dev Mode</strong> blocks Android users who have <strong>Developer Options</strong> enabled
          (turn OFF for internal testing). Raising{' '}
          <em>min_version</em> above an installed version shows the update screen; the open button uses <strong>Store URL</strong>{' '}
          if set, otherwise a default listing URL from <strong>App ID</strong>.
        </div>
      )}

      {/* ─── Create / Edit Modal ─── */}
      {showModal && (
        <div className="avm-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="avm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="avm-modal-header">
              <h2>{editingId ? 'Edit App Version' : 'Add New App'}</h2>
              <button className="avm-modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="avm-form">
              <div className="avm-form-grid">
                <div className="avm-field">
                  <label>App Name *</label>
                  <input
                    type="text"
                    value={form.app_name}
                    onChange={(e) => handleChange('app_name', e.target.value)}
                    placeholder="e.g. DSMS Plantation"
                    required
                  />
                </div>
                <div className="avm-field">
                  <label>App ID (Package Name) *</label>
                  <input
                    type="text"
                    value={form.app_id}
                    onChange={(e) => handleChange('app_id', e.target.value)}
                    placeholder="e.g. com.dsms_transport"
                    required
                  />
                  <span className="avm-field-hint">
                    Same App ID is allowed for Android and iOS — create one row per platform.
                  </span>
                </div>
                <div className="avm-field">
                  <label>Platform</label>
                  <select value={form.platform} onChange={(e) => handleChange('platform', e.target.value)}>
                    {PLATFORM_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="avm-field">
                  <label>Min Version *</label>
                  <input
                    type="text"
                    value={form.min_version}
                    onChange={(e) => handleChange('min_version', e.target.value)}
                    placeholder="e.g. 1.3.5"
                    required
                  />
                </div>
                <div className="avm-field">
                  <label>Latest Version *</label>
                  <input
                    type="text"
                    value={form.latest_version}
                    onChange={(e) => handleChange('latest_version', e.target.value)}
                    placeholder="e.g. 1.3.5"
                    required
                  />
                </div>
                <div className="avm-field">
                  <label>Store URL (optional)</label>
                  <input
                    type="url"
                    value={form.store_url}
                    onChange={(e) => handleChange('store_url', e.target.value)}
                    placeholder="Leave blank to use the default listing for App ID above"
                  />
                  <p className="avm-field-hint">
                    If empty, the public version check uses a Play Store listing URL derived from <strong>App ID</strong>.
                    Set a full <code>https://…</code> link here to override (e.g. App Store or a tracking URL).
                  </p>
                </div>
                <div className="avm-field">
                  <label>OTP Bypass Mobile (optional)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={9}
                    value={form.otp_bypass_mobile}
                    onChange={(e) => handleChange('otp_bypass_mobile', e.target.value.replace(/\D/g, '').slice(0, 9))}
                    placeholder="e.g. 888888888"
                  />
                  <p className="avm-field-hint">
                    9-digit test mobile (no leading 0) that skips OTP for this app. Leave blank to disable bypass.
                  </p>
                </div>
                <div className="avm-field avm-field-full">
                  <label>Update Message</label>
                  <textarea
                    value={form.update_message}
                    onChange={(e) => handleChange('update_message', e.target.value)}
                    placeholder="Custom message shown to users when an update is required..."
                    rows={3}
                  />
                </div>
                <div className="avm-field avm-field-toggle">
                  <label>Force Update</label>
                  <label className="avm-toggle">
                    <input
                      type="checkbox"
                      checked={toBit(form.force_update, 1) === 1}
                      onChange={(e) => handleChange('force_update', e.target.checked ? 1 : 0)}
                    />
                    <span className="avm-toggle-slider" />
                    <span className="avm-toggle-label">
                      {toBit(form.force_update, 1) ? 'Yes — block app' : 'No — soft prompt'}
                    </span>
                  </label>
                </div>
                <div className="avm-field avm-field-toggle">
                  <label>Active</label>
                  <label className="avm-toggle">
                    <input
                      type="checkbox"
                      checked={toBit(form.is_active, 1) === 1}
                      onChange={(e) => handleChange('is_active', e.target.checked ? 1 : 0)}
                    />
                    <span className="avm-toggle-slider" />
                    <span className="avm-toggle-label">{toBit(form.is_active, 1) ? 'Active' : 'Inactive'}</span>
                  </label>
                </div>

                <div className="avm-field avm-field-toggle">
                  <label>Block Developer Mode</label>
                  <label className="avm-toggle">
                    <input
                      type="checkbox"
                      checked={toBit(form.block_developer_mode, 0) === 1}
                      onChange={(e) => handleChange('block_developer_mode', e.target.checked ? 1 : 0)}
                    />
                    <span className="avm-toggle-slider avm-toggle-slider-orange" />
                    <span className="avm-toggle-label">
                      {toBit(form.block_developer_mode, 0)
                        ? 'Yes — block Android when Developer Options are on'
                        : 'No — allow testing with Developer Options'}
                    </span>
                  </label>
                  <p className="avm-field-hint">
                    Applies to Android only. iOS has no Developer Options equivalent; this flag is ignored on iPhone.
                  </p>
                </div>

                {/* ── Maintenance Section ── */}
                <div className="avm-field-full avm-section-divider">
                  <span className="avm-section-label">Maintenance Mode</span>
                </div>
                <div className="avm-field avm-field-toggle">
                  <label>Maintenance</label>
                  <label className="avm-toggle">
                    <input
                      type="checkbox"
                      checked={toBit(form.maintenance, 0) === 1}
                      onChange={(e) => handleChange('maintenance', e.target.checked ? 1 : 0)}
                    />
                    <span className="avm-toggle-slider avm-toggle-slider-orange" />
                    <span className="avm-toggle-label">
                      {toBit(form.maintenance, 0)
                        ? 'ON - app blocked for all users'
                        : 'OFF - normal operation'}
                    </span>
                  </label>
                </div>
                <div className="avm-field">
                  <label>Maintenance Message</label>
                  <textarea
                    value={form.maintenance_message}
                    onChange={(e) => handleChange('maintenance_message', e.target.value)}
                    placeholder="e.g. We are performing scheduled maintenance. Please try again in 30 minutes."
                    rows={2}
                  />
                </div>
                <div className="avm-field">
                  <label>OTP Bypass Mobile (optional)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={9}
                    value={form.otp_bypass_mobile}
                    onChange={(e) => handleChange('otp_bypass_mobile', e.target.value.replace(/\D/g, '').slice(0, 9))}
                    placeholder="e.g. 888888888"
                  />
                  <p className="avm-field-hint">
                    9-digit test mobile (no leading 0) that skips OTP for this app. Leave blank to disable bypass.
                  </p>
                </div>
              </div>
              <div className="avm-form-actions">
                <button type="submit" className="avm-btn avm-btn-primary" disabled={creating || updating}>
                  {creating || updating ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </button>
                <button type="button" className="avm-btn avm-btn-cancel" onClick={() => setShowModal(false)}>
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
