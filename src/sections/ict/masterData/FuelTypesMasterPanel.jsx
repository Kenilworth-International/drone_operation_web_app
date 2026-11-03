import React, { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  useGetFuelCategoriesQuery,
  useSaveFuelCategoryMutation,
  useGetOfficialFuelPricesQuery,
  useRefreshFuelCategoryOfficialSnapshotsMutation,
} from '../../../api/services/assetsApi';

const OFFICIAL_CODE_OPTIONS = [
  { value: '', label: 'Not linked (custom/manual)' },
  { value: 'petrol_92', label: 'Petrol 92 (CPC official)' },
  { value: 'petrol_95', label: 'Petrol 95 (CPC official)' },
  { value: 'auto_diesel', label: 'Auto Diesel (CPC official)' },
  { value: 'super_diesel', label: 'Super Diesel (CPC official)' },
  { value: 'kerosene', label: 'Kerosene (CPC official)' },
];

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `LKR ${n.toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return '—';
  return String(value).slice(0, 10);
}

function priceMismatch(ourPrice, officialPrice) {
  const a = Number(ourPrice);
  const b = Number(officialPrice);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) > 0.009;
}

const FuelTypesMasterPanel = ({ onMessage, showAddButton = true }) => {
  const { data: fuelCategories = [], refetch: refetchFuelCategories, isLoading } = useGetFuelCategoriesQuery();
  const {
    data: officialPayload,
    isFetching: officialLoading,
    refetch: refetchOfficialPrices,
    isError: officialError,
    error: officialErrorObj,
  } = useGetOfficialFuelPricesQuery(undefined, { refetchOnMountOrArgChange: true });
  const [saveFuelCategory] = useSaveFuelCategoryMutation();
  const [refreshSnapshots, { isLoading: refreshingSnapshots }] = useRefreshFuelCategoryOfficialSnapshotsMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [draftOfficialCode, setDraftOfficialCode] = useState('');
  const [draftUnitPrice, setDraftUnitPrice] = useState('');
  const [savingModal, setSavingModal] = useState(false);
  const [modalError, setModalError] = useState('');
  const [applyingOfficialId, setApplyingOfficialId] = useState(null);

  const officialPrices = useMemo(
    () => (Array.isArray(officialPayload?.prices) ? officialPayload.prices : []),
    [officialPayload]
  );
  const officialByCode = useMemo(() => {
    const map = new Map();
    officialPrices.forEach((row) => map.set(row.fuel_type, row));
    return map;
  }, [officialPrices]);

  const openAddModal = () => {
    setEditingItem(null);
    setDraftName('');
    setDraftOfficialCode('');
    setDraftUnitPrice('');
    setModalError('');
    setSavingModal(false);
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setDraftName(item.category || '');
    setDraftOfficialCode(item.official_fuel_type_code || '');
    setDraftUnitPrice(item.unit_price != null ? String(item.unit_price) : '');
    setModalError('');
    setSavingModal(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (savingModal) return;
    setModalOpen(false);
    setEditingItem(null);
    setDraftName('');
    setDraftOfficialCode('');
    setDraftUnitPrice('');
    setModalError('');
  };

  const saveErrorText = (err) =>
    err?.data?.message ||
    err?.data?.data?.message ||
    err?.error ||
    err?.message ||
    'Failed to save fuel type.';

  const handleRefreshSnapshots = async () => {
    try {
      const result = await refreshSnapshots().unwrap();
      await refetchFuelCategories();
      onMessage?.({
        type: 'success',
        text: `Updated official snapshots for ${result?.updated || 0} linked fuel type(s).`,
      });
    } catch (err) {
      onMessage?.({
        type: 'error',
        text: err?.data?.message || err?.error || 'Failed to refresh official snapshots.',
      });
    }
  };

  const handleApplyOfficialPrice = async (item) => {
    const code = item.official_fuel_type_code;
    if (!code) {
      const text = 'Link an official fuel type first.';
      onMessage?.({ type: 'error', text });
      toast.error(text);
      return;
    }
    const official = officialByCode.get(code) || null;
    const officialPrice = official?.price_lkr ?? item.official_price_lkr;
    if (officialPrice == null || officialPrice === '') {
      const text = 'No official CPC price available for this link. Refresh official or Update linked snapshots first.';
      onMessage?.({ type: 'error', text });
      toast.error(text);
      return;
    }
    if (applyingOfficialId != null) return;
    setApplyingOfficialId(item.id);
    try {
      // Pass the resolved price as unit_price so Save works even if live CPC is down.
      await saveFuelCategory({
        id: item.id,
        category: item.category,
        unit_price: Number(officialPrice),
        official_fuel_type_code: code,
        apply_official_price: true,
        activated: item.activated ?? 1,
      }).unwrap();
      await refetchFuelCategories();
      const text = `Applied official price (${formatMoney(officialPrice)}) to ${item.category}.`;
      onMessage?.({ type: 'success', text });
      toast.success(text);
    } catch (err) {
      const text = saveErrorText(err) || 'Failed to apply official price.';
      onMessage?.({ type: 'error', text });
      toast.error(text);
    } finally {
      setApplyingOfficialId(null);
    }
  };

  const handleSaveModal = async () => {
    const name = String(draftName || '').trim();
    if (!name) {
      const text = 'Fuel type name is required.';
      setModalError(text);
      onMessage?.({ type: 'error', text });
      return;
    }
    if (savingModal) return;
    setSavingModal(true);
    setModalError('');
    try {
      await saveFuelCategory({
        id: editingItem?.id,
        category: name,
        unit_price: draftUnitPrice || null,
        official_fuel_type_code: draftOfficialCode || null,
        activated: editingItem?.activated ?? 1,
      }).unwrap();
      await refetchFuelCategories();
      const text = editingItem ? 'Fuel type updated.' : 'Fuel type added.';
      onMessage?.({ type: 'success', text });
      toast.success(text);
      setSavingModal(false);
      setModalOpen(false);
      setEditingItem(null);
      setDraftName('');
      setDraftOfficialCode('');
      setDraftUnitPrice('');
      setModalError('');
    } catch (err) {
      const text = saveErrorText(err);
      setModalError(text);
      onMessage?.({ type: 'error', text });
      toast.error(text);
      setSavingModal(false);
    }
  };

  return (
    <div className="fuel-types-master-panel">
      <div className="vehicle-admin-card-master-data fuel-types-official-card">
        <div className="master-data-chemicals-head-master-data">
          <div className="master-data-chemicals-head-text-master-data">
            <h3>Official CPC fuel prices</h3>
            <p className="vehicle-master-note-master-data">
              Reference prices from the official API. Link your fuel types below and set your own price manually when needed.
            </p>
          </div>
          <div className="fuel-types-official-actions">
            <button
              type="button"
              className="btn-search-master-data"
              onClick={() => refetchOfficialPrices()}
              disabled={officialLoading}
            >
              {officialLoading ? 'Loading…' : 'Refresh official'}
            </button>
            <button
              type="button"
              className="btn-search-master-data"
              onClick={() => void handleRefreshSnapshots()}
              disabled={refreshingSnapshots}
            >
              {refreshingSnapshots ? 'Updating…' : 'Update linked snapshots'}
            </button>
          </div>
        </div>

        {officialError ? (
          <p className="fuel-types-official-error">
            {officialErrorObj?.data?.message || officialErrorObj?.error || 'Could not load official prices.'}
            {' '}
            <a
              href="https://ceypetco.gov.lk/marketing-sales"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open CPC marketing-sales
            </a>
          </p>
        ) : (
          <div className="fuel-types-official-grid">
            {officialPrices.map((row) => (
              <div key={row.fuel_type} className="fuel-types-official-item">
                <span className="fuel-types-official-label">{row.label}</span>
                <strong>{formatMoney(row.price_lkr)}</strong>
                <span className="fuel-types-official-meta">Recorded {formatDate(row.recorded_at)}</span>
              </div>
            ))}
            {!officialLoading && !officialPrices.length ? (
              <p className="vehicle-master-note-master-data">No official prices returned.</p>
            ) : null}
          </div>
        )}
        {officialPayload?.warning ? (
          <p className="fuel-types-official-warning">{officialPayload.warning}</p>
        ) : null}
        {officialPayload?.last_verified_at ? (
          <p className="fuel-types-official-verified">
            Last verified: {new Date(officialPayload.last_verified_at).toLocaleString()}
            {officialPayload?.stale ? ' (cached)' : ''}
            {officialPayload?.source === 'local_cpc_proxy' ? ' via local CPC proxy' : ''}
          </p>
        ) : null}
      </div>

      <div className="vehicle-admin-card-master-data">
        <div className="master-data-chemicals-head-master-data">
          <div className="master-data-chemicals-head-text-master-data">
            <h3>KWIL Fuel Types and Prices</h3>
            <p className="vehicle-master-note-master-data">
              Link each internal fuel type to an official code. “Official CPC” below is the price stored in your database (use “Update linked snapshots” to refresh from the API). Your unit price is manual.
            </p>
          </div>
          {showAddButton ? (
            <button
              type="button"
              className="btn-submit-master-data master-data-chemicals-add-btn-master-data"
              onClick={openAddModal}
            >
              Add fuel type
            </button>
          ) : null}
        </div>

        <div className="fuel-types-list-master-data">
          {isLoading ? <p className="vehicle-master-note-master-data">Loading fuel types…</p> : null}
          {!isLoading && fuelCategories.length === 0 ? (
            <p className="vehicle-master-note-master-data">No fuel types yet.</p>
          ) : null}
          {fuelCategories.map((item) => {
            const linkedCode = item.official_fuel_type_code || '';
            const linkedLabel =
              OFFICIAL_CODE_OPTIONS.find((opt) => opt.value === linkedCode)?.label || 'Not linked';
            const liveOfficial = linkedCode ? officialByCode.get(linkedCode) : null;
            const liveOfficialPrice = liveOfficial?.price_lkr ?? null;
            const dbOfficialPrice = item.official_price_lkr;
            const mismatch = linkedCode && priceMismatch(item.unit_price, dbOfficialPrice);
            const liveDiffersFromDb =
              liveOfficialPrice != null &&
              dbOfficialPrice != null &&
              priceMismatch(liveOfficialPrice, dbOfficialPrice);
            const showApplyOfficial =
              linkedCode &&
              liveOfficialPrice != null &&
              (item.unit_price == null || item.unit_price === '' || priceMismatch(item.unit_price, liveOfficialPrice));
            return (
              <div key={item.id} className={`fuel-type-row-master-data${mismatch ? ' is-mismatch' : ''}`}>
                <div className="fuel-type-row-main">
                  <div className="fuel-type-row-title">
                    <strong>{item.category}</strong>
                    {mismatch ? <span className="fuel-type-badge-mismatch">Price differs from stored official</span> : null}
                    {linkedCode && !mismatch && item.unit_price != null ? (
                      <span className="fuel-type-badge-synced">Synced with stored official</span>
                    ) : null}
                  </div>
                  <div className="fuel-type-row-grid">
                    <div>
                      <span className="fuel-type-row-label">Linked official</span>
                      <span>{linkedLabel}</span>
                    </div>
                    <div>
                      <span className="fuel-type-row-label">Official CPC (stored)</span>
                      <span>{linkedCode ? formatMoney(dbOfficialPrice) : '—'}</span>
                      {liveDiffersFromDb ? (
                        <span className="fuel-type-live-api-hint">
                          Live API: {formatMoney(liveOfficialPrice)}
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <span className="fuel-type-row-label">Your price</span>
                      <span>{item.unit_price != null ? formatMoney(item.unit_price) : 'Not set'}</span>
                    </div>
                    <div>
                      <span className="fuel-type-row-label">Official date (stored)</span>
                      <span>{formatDate(item.official_price_recorded_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="fuel-type-row-actions">
                  <button
                    type="button"
                    className="action-btn-master-data neutral-master-data"
                    onClick={() => openEditModal(item)}
                  >
                    Edit
                  </button>
                  {showApplyOfficial ? (
                    <button
                      type="button"
                      className="action-btn-master-data neutral-master-data"
                      onClick={() => void handleApplyOfficialPrice(item)}
                      disabled={applyingOfficialId === item.id}
                    >
                      {applyingOfficialId === item.id ? 'Applying…' : 'Apply official'}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {modalOpen ? (
        <div className="update-popup-overlay-master-data fuel-type-edit-overlay">
          <div
            className="update-popup-card-master-data update-popup-card-wide-master-data"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fuel-type-edit-title"
          >
            <h3 id="fuel-type-edit-title">{editingItem ? 'Edit fuel type' : 'Add fuel type'}</h3>
            <div className="master-edit-grid-2col-master-data">
              <div className="master-edit-field-master-data master-edit-field-span2-master-data">
                <label htmlFor="master-add-fuel-name">Fuel type name</label>
                <input
                  id="master-add-fuel-name"
                  className="master-edit-input-master-data"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="e.g. Diesel"
                  autoComplete="off"
                  disabled={savingModal}
                />
              </div>
              <div className="master-edit-field-master-data master-edit-field-span2-master-data">
                <label htmlFor="master-add-fuel-official">Link to official CPC fuel type</label>
                <select
                  id="master-add-fuel-official"
                  className="master-edit-input-master-data"
                  value={draftOfficialCode}
                  onChange={(e) => setDraftOfficialCode(e.target.value)}
                  disabled={savingModal}
                >
                  {OFFICIAL_CODE_OPTIONS.map((opt) => (
                    <option key={opt.value || 'none'} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="master-edit-field-master-data master-edit-field-span2-master-data">
                <label htmlFor="master-add-fuel-price">Your unit price (LKR/L)</label>
                <input
                  id="master-add-fuel-price"
                  type="number"
                  className="master-edit-input-master-data"
                  value={draftUnitPrice}
                  onChange={(e) => setDraftUnitPrice(e.target.value)}
                  placeholder="Manual price"
                  min="0"
                  step="0.01"
                  disabled={savingModal}
                />
                {draftOfficialCode && officialByCode.get(draftOfficialCode) ? (
                  <p className="vehicle-master-note-master-data" style={{ marginTop: 6 }}>
                    Official CPC now: {formatMoney(officialByCode.get(draftOfficialCode).price_lkr)}
                  </p>
                ) : null}
              </div>
            </div>
            {modalError ? (
              <p className="fuel-type-edit-error" role="alert">
                {modalError}
              </p>
            ) : null}
            <div className="update-popup-actions-master-data">
              <button
                type="button"
                className="btn-search-master-data"
                onClick={closeModal}
                disabled={savingModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-submit-master-data"
                onClick={() => void handleSaveModal()}
                disabled={savingModal}
              >
                {savingModal ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default FuelTypesMasterPanel;
