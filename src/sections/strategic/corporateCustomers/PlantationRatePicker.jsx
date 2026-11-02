import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  useGetPlantationBillingRateCatalogQuery,
  useGetPlantationBillingRateAssignmentsQuery,
  useSavePlantationBillingRateAssignmentMutation,
} from '../../../api/services NodeJs/mappingHierarchyApi';
import { formatRate } from './corporateCustomerModal';
import { formatFriendlyNotes } from './friendlyNotes';

const KINDS = [
  { kind: 'spray', label: 'Spray' },
  { kind: 'spread', label: 'Spread' },
  { kind: 'scout', label: 'Scout' },
];

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function catalogLabel(row) {
  if (!row) return '—';
  const name = row.name || row.rate_kind;
  return `${name} (${formatRate(row.rate)})`;
}

/**
 * Corporate Customer: pick catalog rates for a plantation.
 * Pass `rateKind` ("spray"|"spread"|"scout") to show only that kind.
 */
export default function PlantationRatePicker({
  plantationId,
  readOnly = false,
  rateKind = null,
}) {
  const lockedKind = rateKind ? String(rateKind).toLowerCase() : null;
  const visibleKinds = lockedKind
    ? KINDS.filter((k) => k.kind === lockedKind)
    : KINDS;

  const { data: catalogRes } = useGetPlantationBillingRateCatalogQuery({ includeInactive: false });
  const {
    data: assignRes,
    isLoading,
    isError,
    refetch,
  } = useGetPlantationBillingRateAssignmentsQuery(
    { plantationId, includeInactive: false },
    { skip: !plantationId }
  );
  const [saveAssign, { isLoading: saving }] = useSavePlantationBillingRateAssignmentMutation();

  const [pick, setPick] = useState({
    rate_kind: lockedKind || 'spray',
    catalog_rate_id: '',
    effective_from: todayYmd(),
    notes: '',
  });

  useEffect(() => {
    if (lockedKind) {
      setPick((prev) => ({
        ...prev,
        rate_kind: lockedKind,
        catalog_rate_id: '',
        effective_from: todayYmd(),
        notes: '',
      }));
    }
  }, [lockedKind, plantationId]);

  const catalog = useMemo(() => {
    const list = catalogRes?.data;
    return Array.isArray(list) ? list : [];
  }, [catalogRes]);

  const catalogByKind = useMemo(() => {
    const map = { spray: [], spread: [], scout: [] };
    catalog.forEach((row) => {
      if (Number(row.activated) !== 1) return;
      const kind = String(row.rate_kind || '').toLowerCase();
      if (map[kind]) map[kind].push(row);
    });
    return map;
  }, [catalog]);

  const assignments = useMemo(() => {
    const list = assignRes?.data;
    const active = Array.isArray(list)
      ? list.filter((a) => Number(a.activated) === 1)
      : [];
    if (!lockedKind) return active;
    return active.filter((a) => a.rate_kind === lockedKind);
  }, [assignRes, lockedKind]);

  const currentByKind = useMemo(() => {
    const today = todayYmd();
    const out = { spray: null, spread: null, scout: null };
    visibleKinds.forEach(({ kind }) => {
      const rows = assignments
        .filter((a) => a.rate_kind === kind)
        .sort((a, b) => String(b.effective_from).localeCompare(String(a.effective_from)));
      out[kind] = rows.find((a) => String(a.effective_from) <= today) || rows[0] || null;
    });
    return out;
  }, [assignments, visibleKinds]);

  const handlePick = async (e) => {
    e.preventDefault();
    if (!plantationId) return;
    if (!pick.catalog_rate_id) {
      toast.error('Select a rate');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pick.effective_from)) {
      toast.error('Effective from date is required');
      return;
    }
    try {
      const res = await saveAssign({
        plantation_id: plantationId,
        rate_kind: pick.rate_kind,
        catalog_rate_id: Number(pick.catalog_rate_id),
        effective_from: pick.effective_from,
        notes: String(pick.notes).trim() || null,
        activated: 1,
      }).unwrap();
      if (res?.status === true) {
        toast.success('Rate assigned');
        setPick((prev) => ({
          ...prev,
          catalog_rate_id: '',
          notes: '',
          effective_from: todayYmd(),
        }));
        refetch();
      } else {
        toast.error(res?.message || 'Assign failed');
      }
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Assign failed');
    }
  };

  const kindLabel =
    visibleKinds[0]?.label || (lockedKind ? lockedKind : 'rate');
  const current = lockedKind ? currentByKind[lockedKind] : null;
  const currentRate = current?.catalog?.rate;
  const currentName = current?.catalog?.name || current?.catalog?.rate_kind;

  if (lockedKind) {
    return (
      <section
        className={`cc-rate-picker cc-rate-picker--focus cc-rate-picker--${lockedKind}`}
        aria-labelledby="cc-pick-title"
      >
        <div className="cc-focus-current">
          <div className="cc-focus-current__meta">
            <span className="cc-focus-current__eyebrow">Current {kindLabel.toLowerCase()}</span>
            <strong className="cc-focus-current__value">
              {currentRate != null ? formatRate(currentRate) : 'Not assigned'}
            </strong>
            <span className="cc-focus-current__detail">
              {currentName
                ? `${currentName}${current?.effective_from ? ` · from ${current.effective_from}` : ''}`
                : 'Pick a catalog rate below'}
            </span>
          </div>
        </div>

        {isLoading && <p className="cc-status">Loading picks…</p>}
        {isError && (
          <p className="cc-status cc-status--error">
            Could not load assignments. Ensure Contract Rates catalog exists.
          </p>
        )}

        {!readOnly ? (
          <form className="cc-focus-form" onSubmit={handlePick}>
            <h3 id="cc-pick-title" className="cc-focus-form__title">
              Assign new {kindLabel.toLowerCase()} rate
            </h3>
            <p className="cc-focus-form__hint">
              For a mid-year change, keep the old assignment and pick again with a new effective date.
            </p>
            <div className="cc-focus-form__grid">
              <div className="cc-field cc-field--span2">
                <label className="cc-label" htmlFor="cc-pick-rate">
                  Catalog rate
                </label>
                <select
                  id="cc-pick-rate"
                  className="cc-input"
                  required
                  value={pick.catalog_rate_id}
                  onChange={(e) => setPick((prev) => ({ ...prev, catalog_rate_id: e.target.value }))}
                >
                  <option value="">Select {kindLabel.toLowerCase()} rate…</option>
                  {(catalogByKind[pick.rate_kind] || []).map((row) => (
                    <option key={row.id} value={row.id}>
                      {catalogLabel(row)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="cc-field">
                <label className="cc-label" htmlFor="cc-pick-from">
                  Effective from
                </label>
                <input
                  id="cc-pick-from"
                  className="cc-input"
                  type="date"
                  required
                  value={pick.effective_from}
                  onChange={(e) => setPick((prev) => ({ ...prev, effective_from: e.target.value }))}
                />
              </div>
              <div className="cc-field">
                <label className="cc-label" htmlFor="cc-pick-notes">
                  Notes <span className="cc-label-optional">(optional)</span>
                </label>
                <input
                  id="cc-pick-notes"
                  className="cc-input"
                  type="text"
                  placeholder="e.g. Mid-year contract change"
                  value={pick.notes}
                  onChange={(e) => setPick((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="cc-focus-form__actions">
              <button type="submit" className="cc-btn cc-btn--primary cc-btn--wide" disabled={saving}>
                {saving ? 'Saving…' : `Pick ${kindLabel.toLowerCase()} rate`}
              </button>
            </div>
          </form>
        ) : null}

        {!isLoading && !isError ? (
          <div className="cc-focus-history">
            <h4 className="cc-focus-history__title">History</h4>
            {assignments.length === 0 ? (
              <p className="cc-focus-history__empty">No {kindLabel.toLowerCase()} rates assigned yet.</p>
            ) : (
              <ul className="cc-focus-history__list">
                {assignments.map((row) => (
                  <li key={row.id} className="cc-focus-history__item">
                    <div className="cc-focus-history__rate">{catalogLabel(row.catalog)}</div>
                    <div className="cc-focus-history__meta">
                      <span>From {row.effective_from || '—'}</span>
                      {row.notes ? <span>{formatFriendlyNotes(row.notes)}</span> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="cc-section cc-rate-picker" aria-labelledby="cc-pick-title">
      <div className="cc-section-head">
        <div>
          <h3 id="cc-pick-title" className="cc-section-title">
            Pick contract rates
          </h3>
          <p className="cc-section-desc">
            Choose spray / spread / scout from Contract Rates. For a mid-year change, pick again with a
            new effective date.
          </p>
        </div>
      </div>

      <div className="cc-pick-current">
        {visibleKinds.map(({ kind, label }) => {
          const cur = currentByKind[kind];
          return (
            <div key={kind} className="cc-pick-current__card">
              <span className="cc-pick-current__label">{label}</span>
              <strong>{catalogLabel(cur?.catalog)}</strong>
              <small>
                {cur?.effective_from ? `From ${cur.effective_from}` : 'Not assigned'}
              </small>
            </div>
          );
        })}
      </div>

      {isLoading && <p className="cc-status">Loading picks…</p>}
      {isError && (
        <p className="cc-status cc-status--error">
          Could not load assignments. Run the billing-rate SQL migration and ensure Contract Rates
          catalog exists.
        </p>
      )}

      {!readOnly ? (
        <form className="cc-rate-form" onSubmit={handlePick}>
          <h4 className="cc-rate-form__title">Assign a rate</h4>
          <div className="cc-section-grid">
            <div className="cc-field">
              <label className="cc-label" htmlFor="cc-pick-kind">
                Kind
              </label>
              <select
                id="cc-pick-kind"
                className="cc-input"
                value={pick.rate_kind}
                onChange={(e) =>
                  setPick((prev) => ({
                    ...prev,
                    rate_kind: e.target.value,
                    catalog_rate_id: '',
                  }))
                }
              >
                {KINDS.map(({ kind, label }) => (
                  <option key={kind} value={kind}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="cc-field">
              <label className="cc-label" htmlFor="cc-pick-rate">
                Rate
              </label>
              <select
                id="cc-pick-rate"
                className="cc-input"
                required
                value={pick.catalog_rate_id}
                onChange={(e) => setPick((prev) => ({ ...prev, catalog_rate_id: e.target.value }))}
              >
                <option value="">Select {pick.rate_kind} rate…</option>
                {(catalogByKind[pick.rate_kind] || []).map((row) => (
                  <option key={row.id} value={row.id}>
                    {catalogLabel(row)}
                  </option>
                ))}
              </select>
            </div>
            <div className="cc-field">
              <label className="cc-label" htmlFor="cc-pick-from">
                Effective from
              </label>
              <input
                id="cc-pick-from"
                className="cc-input"
                type="date"
                required
                value={pick.effective_from}
                onChange={(e) => setPick((prev) => ({ ...prev, effective_from: e.target.value }))}
              />
            </div>
            <div className="cc-field cc-field--full">
              <label className="cc-label" htmlFor="cc-pick-notes">
                Notes
              </label>
              <input
                id="cc-pick-notes"
                className="cc-input"
                type="text"
                value={pick.notes}
                onChange={(e) => setPick((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          <div className="cc-rate-form__actions">
            <button type="submit" className="cc-btn cc-btn--primary" disabled={saving}>
              {saving ? 'Saving…' : 'Pick rate'}
            </button>
          </div>
        </form>
      ) : null}

      {!isLoading && !isError ? (
        <div className="cc-rates-table-wrap" style={{ marginTop: 12 }}>
          <table className="cc-table cc-rates-table">
            <thead>
              <tr>
                <th>Kind</th>
                <th>Rate</th>
                <th>Effective from</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {assignments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="cc-empty">
                    No rates picked yet.
                  </td>
                </tr>
              ) : (
                assignments.map((row) => (
                  <tr key={row.id}>
                    <td>{row.rate_kind}</td>
                    <td>{catalogLabel(row.catalog)}</td>
                    <td>{row.effective_from || '—'}</td>
                    <td className="cc-cell-text">{formatFriendlyNotes(row.notes)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
