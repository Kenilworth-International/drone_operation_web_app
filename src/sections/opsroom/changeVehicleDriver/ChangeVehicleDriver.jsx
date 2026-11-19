import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaCarSide, FaSearch, FaUserEdit } from 'react-icons/fa';
import {
  useGetVehicleAppDriversQuery,
  useGetVehicleAppVehiclesQuery,
  useSaveVehicleAppVehicleMutation,
} from '../../../api/services NodeJs/vehicleAppApi';
import { formatVehiclePoolCategory } from '../../../utils/vehiclePoolCategory';
import './changeVehicleDriver.css';

function isKwilOwn(row) {
  return String(row?.ownership || 'o').trim().toLowerCase() !== 'r';
}

function isPoolVehicle(row) {
  return String(row?.vehicle_pool_category || 'p').trim().toLowerCase() === 'p';
}

/**
 * Ops Workflow quick access: change primary/secondary driver on KWIL (own) vehicles.
 * Reuses vehicle-app admin APIs (same as Transport HR Set driver).
 */
export default function ChangeVehicleDriver() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const { data: vehicles = [], isLoading, isError, error, refetch } = useGetVehicleAppVehiclesQuery();
  const { data: drivers = [] } = useGetVehicleAppDriversQuery();
  const [saveVehicle, { isLoading: saving }] = useSaveVehicleAppVehicleMutation();

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('pool'); // pool | all-kwil
  const [modal, setModal] = useState({ open: false, row: null, driverId: '', secondaryDriverId: '' });
  const [notice, setNotice] = useState(null);

  const kwilVehicles = useMemo(
    () => (vehicles || []).filter((row) => isKwilOwn(row) && Number(row.activated) === 1),
    [vehicles]
  );

  const visibleVehicles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return kwilVehicles
      .filter((row) => (scope === 'pool' ? isPoolVehicle(row) : true))
      .filter((row) => {
        if (!q) return true;
        const hay = [
          row.vehicle_no,
          row.make,
          row.model,
          row.assigned_driver_name,
          row.assigned_secondary_driver_name,
          formatVehiclePoolCategory(row.vehicle_pool_category),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
  }, [kwilVehicles, scope, query]);

  const openModal = (row) => {
    setNotice(null);
    setModal({
      open: true,
      row,
      driverId: row.driver != null ? String(row.driver) : '',
      secondaryDriverId: row.secondary_driver != null ? String(row.secondary_driver) : '',
    });
  };

  const closeModal = () => {
    if (saving) return;
    setModal({ open: false, row: null, driverId: '', secondaryDriverId: '' });
  };

  const submitDriver = async () => {
    const row = modal.row;
    if (!row?.id) return;
    if (
      modal.driverId &&
      modal.secondaryDriverId &&
      String(modal.driverId) === String(modal.secondaryDriverId)
    ) {
      setNotice({ tone: 'error', text: 'Secondary driver must be different from the primary driver.' });
      return;
    }
    try {
      await saveVehicle({
        id: row.id,
        vehicle_no: row.vehicle_no,
        make: row.make ?? null,
        model: row.model ?? null,
        driver: modal.driverId ? Number(modal.driverId) : null,
        secondary_driver: modal.secondaryDriverId ? Number(modal.secondaryDriverId) : null,
        activated: row.activated,
        vehicle_category_id: row.vehicle_category_id ?? row.normalized_vehicle_category_id ?? null,
        fuel_category_id: row.fuel_category_id ?? row.normalized_fuel_category_id ?? null,
        card_id: row.card_id ?? (row.linked_card_id ? Number(row.linked_card_id) : null),
        ownership: 'o',
        operational_status: row.operational_status || 'o',
      }).unwrap();
      await refetch();
      closeModal();
      setNotice({ tone: 'ok', text: `Drivers updated for ${row.vehicle_no || `vehicle #${row.id}`}.` });
    } catch (e) {
      setNotice({
        tone: 'error',
        text: e?.data?.message || e?.message || 'Could not save drivers. Please try again.',
      });
    }
  };

  return (
    <div className="cvd-page">
      <header className="cvd-hero">
        <button
          type="button"
          className="cvd-back"
          onClick={() =>
            navigate({ pathname: '/home/workflowDashboard', search: routerLocation.search })
          }
        >
          <FaArrowLeft aria-hidden /> Workflow Dashboard
        </button>
        <div className="cvd-hero-copy">
          <p className="cvd-kicker">Operations</p>
          <h1 className="cvd-title">Change vehicle driver</h1>
          <p className="cvd-sub">
            Assign primary and optional secondary drivers for KWIL (own) vehicles. The morning driver
            must end their trip before the other can start meter reading.
          </p>
        </div>
        <div className="cvd-hero-stats">
          <div className="cvd-stat">
            <span className="cvd-stat-value">{visibleVehicles.length}</span>
            <span className="cvd-stat-label">Shown</span>
          </div>
          <div className="cvd-stat">
            <span className="cvd-stat-value">{kwilVehicles.filter(isPoolVehicle).length}</span>
            <span className="cvd-stat-label">Pool</span>
          </div>
        </div>
      </header>

      <div className="cvd-toolbar">
        <label className="cvd-search">
          <FaSearch aria-hidden />
          <input
            type="search"
            placeholder="Search vehicle, driver…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="cvd-scope" role="group" aria-label="Vehicle scope">
          <button
            type="button"
            className={`cvd-pill${scope === 'pool' ? ' is-active' : ''}`}
            onClick={() => setScope('pool')}
          >
            Pool only
          </button>
          <button
            type="button"
            className={`cvd-pill${scope === 'all-kwil' ? ' is-active' : ''}`}
            onClick={() => setScope('all-kwil')}
          >
            All KWIL
          </button>
        </div>
        <button type="button" className="cvd-btn cvd-btn--ghost" onClick={() => refetch()} disabled={isLoading}>
          Refresh
        </button>
      </div>

      {notice ? (
        <div className={`cvd-flash cvd-flash--${notice.tone === 'error' ? 'error' : 'ok'}`}>{notice.text}</div>
      ) : null}

      {isLoading ? (
        <div className="cvd-state">Loading vehicles…</div>
      ) : isError ? (
        <div className="cvd-state cvd-state--error">
          <p>{error?.data?.message || 'Could not load vehicles.'}</p>
          <button type="button" className="cvd-btn cvd-btn--ghost" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      ) : (
        <div className="cvd-table-wrap">
          <table className="cvd-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Category</th>
                <th>Make / Model</th>
                <th>Primary driver</th>
                <th>Secondary driver</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleVehicles.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className="cvd-vehicle-no">
                      <FaCarSide aria-hidden /> {row.vehicle_no || `#${row.id}`}
                    </span>
                  </td>
                  <td>{formatVehiclePoolCategory(row.vehicle_pool_category)}</td>
                  <td>
                    {row.make || '—'} / {row.model || '—'}
                  </td>
                  <td>{row.assigned_driver_name || '— Unassigned —'}</td>
                  <td>{row.assigned_secondary_driver_name || '—'}</td>
                  <td>
                    <button type="button" className="cvd-btn cvd-btn--primary" onClick={() => openModal(row)}>
                      <FaUserEdit aria-hidden /> Change drivers
                    </button>
                  </td>
                </tr>
              ))}
              {!visibleVehicles.length ? (
                <tr>
                  <td colSpan={6} className="cvd-empty">
                    No KWIL{scope === 'pool' ? ' Pool' : ''} vehicles match this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {modal.open && modal.row ? (
        <div className="cvd-overlay" onClick={closeModal} role="presentation">
          <div
            className="cvd-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cvd-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="cvd-modal-head">
              <div>
                <p className="cvd-modal-eyebrow">KWIL · {formatVehiclePoolCategory(modal.row.vehicle_pool_category)}</p>
                <h2 id="cvd-modal-title">Set drivers — {modal.row.vehicle_no || modal.row.id}</h2>
              </div>
              <button type="button" className="cvd-modal-close" onClick={closeModal} aria-label="Close">
                ×
              </button>
            </header>
            <div className="cvd-modal-body">
              <p className="cvd-hint">
                Both drivers can open the vehicle in the Transport app. Whoever starts first must end
                their meter reading before the other can start.
              </p>
              <label className="cvd-field">
                <span>Primary driver</span>
                <select
                  value={modal.driverId}
                  onChange={(e) => setModal((prev) => ({ ...prev, driverId: e.target.value }))}
                >
                  <option value="">— None / Unassigned —</option>
                  {(drivers || []).map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.user_name || d.name || `Driver #${d.id}`}
                      {d.mobile_no ? ` (${d.mobile_no})` : ''}
                      {Number(d.assigned_vehicle_count) > 0
                        ? ` — ${d.assigned_vehicle_count} vehicle(s)`
                        : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="cvd-field">
                <span>Secondary driver</span>
                <select
                  value={modal.secondaryDriverId}
                  onChange={(e) => setModal((prev) => ({ ...prev, secondaryDriverId: e.target.value }))}
                >
                  <option value="">— None —</option>
                  {(drivers || [])
                    .filter((d) => String(d.id) !== String(modal.driverId || ''))
                    .map((d) => (
                      <option key={d.id} value={String(d.id)}>
                        {d.user_name || d.name || `Driver #${d.id}`}
                        {d.mobile_no ? ` (${d.mobile_no})` : ''}
                        {Number(d.assigned_vehicle_count) > 0
                          ? ` — ${d.assigned_vehicle_count} vehicle(s)`
                          : ''}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <footer className="cvd-modal-foot">
              <button type="button" className="cvd-btn cvd-btn--ghost" onClick={closeModal} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="cvd-btn cvd-btn--primary" onClick={submitDriver} disabled={saving}>
                {saving ? 'Saving…' : 'Save drivers'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
