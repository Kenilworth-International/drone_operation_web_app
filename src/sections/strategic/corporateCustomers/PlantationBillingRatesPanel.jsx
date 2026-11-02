import React, { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  useGetPlantationBillingRateCatalogQuery,
  useSavePlantationBillingRateCatalogMutation,
  useDeactivatePlantationBillingRateCatalogMutation,
} from '../../../api/services NodeJs/mappingHierarchyApi';
import { formatRate } from './corporateCustomerModal';
import { formatFriendlyNotes } from './friendlyNotes';

const RATE_KINDS = [
  {
    kind: 'spray',
    title: 'Spray rates',
    hint: 'Shared spray prices. Corporate Customer picks one for each plantation.',
    showUnits: true,
    showMaxChemical: true,
  },
  {
    kind: 'spread',
    title: 'Spread rates',
    hint: 'Shared spread prices — independent from spray.',
    showUnits: true,
    showMaxChemical: false,
  },
  {
    kind: 'scout',
    title: 'Scout rates',
    hint: 'Shared scout prices.',
    showUnits: false,
    showMaxChemical: false,
  },
];

function emptyForm(kind) {
  return {
    id: null,
    rate_kind: kind,
    name: '',
    rate: '',
    units: '',
    spray_max_chemical: kind === 'spray' ? '12' : '',
    notes: '',
  };
}

function rowToForm(row) {
  return {
    id: row?.id ?? null,
    rate_kind: row?.rate_kind || 'spray',
    name: row?.name ?? '',
    rate: row?.rate != null ? String(row.rate) : '',
    units: row?.units ?? '',
    spray_max_chemical:
      row?.spray_max_chemical != null ? String(row.spray_max_chemical) : '12',
    notes: row?.notes ?? '',
  };
}

/**
 * Contract Rates catalog — spray / spread / scout only (no plantation).
 */
export default function PlantationBillingRatesPanel() {
  const { data: response, isLoading, isError, refetch } = useGetPlantationBillingRateCatalogQuery({
    includeInactive: true,
  });
  const [saveRate, { isLoading: saving }] = useSavePlantationBillingRateCatalogMutation();
  const [deactivateRate, { isLoading: deactivating }] =
    useDeactivatePlantationBillingRateCatalogMutation();

  const [form, setForm] = useState(null);

  const catalog = useMemo(() => {
    const list = response?.data;
    return Array.isArray(list) ? list : [];
  }, [response]);

  const byKind = useMemo(() => {
    const map = { spray: [], spread: [], scout: [] };
    catalog.forEach((row) => {
      const kind = String(row.rate_kind || '').toLowerCase();
      if (map[kind]) map[kind].push(row);
    });
    return map;
  }, [catalog]);

  const activeMeta = form
    ? RATE_KINDS.find((k) => k.kind === form.rate_kind) || RATE_KINDS[0]
    : null;

  const onChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const startAdd = (kind) => setForm(emptyForm(kind));
  const startEdit = (row) => setForm(rowToForm(row));
  const cancelForm = () => setForm(null);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form) return;
    if (String(form.rate).trim() === '' || !Number.isFinite(Number(form.rate))) {
      toast.error('Rate is required');
      return;
    }
    const payload = {
      rate_kind: form.rate_kind,
      name: String(form.name).trim() || null,
      rate: Number(form.rate),
      units: form.rate_kind === 'scout' ? null : String(form.units).trim() || null,
      spray_max_chemical:
        form.rate_kind === 'spray'
          ? String(form.spray_max_chemical).trim() === ''
            ? 12
            : Number(form.spray_max_chemical)
          : null,
      notes: String(form.notes).trim() || null,
      activated: 1,
    };
    if (form.id) payload.id = form.id;

    try {
      const res = await saveRate(payload).unwrap();
      if (res?.status === true) {
        toast.success(res.message || 'Rate saved');
        cancelForm();
        refetch();
      } else {
        toast.error(res?.message || 'Save failed');
      }
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Save failed');
    }
  };

  const handleDeactivate = async (row) => {
    if (!row?.id) return;
    if (!window.confirm(`Deactivate ${row.name || row.rate_kind} rate ${formatRate(row.rate)}?`)) {
      return;
    }
    try {
      const res = await deactivateRate({ id: row.id }).unwrap();
      if (res?.status === true) {
        toast.success('Rate deactivated');
        refetch();
      } else {
        toast.error(res?.message || 'Deactivate failed');
      }
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Deactivate failed');
    }
  };

  return (
    <section className="cc-section cc-rates-panel" aria-labelledby="cc-rates-title">
      <div className="cc-section-head">
        <div>
          <h3 id="cc-rates-title" className="cc-section-title">
            Rate catalog
          </h3>
          <p className="cc-section-desc">
            Create spray, spread, and scout prices here. On Corporate Customer, pick which rate
            applies to each plantation (and from which date).
          </p>
        </div>
      </div>

      {isLoading && <p className="cc-status">Loading rates…</p>}
      {isError && (
        <p className="cc-status cc-status--error">
          Could not load catalog. Run sql/20261027_plantation_billing_rate_periods.sql, then restart
          dsms_backend_dev.
        </p>
      )}

      {!isLoading &&
        !isError &&
        RATE_KINDS.map((meta) => (
          <section key={meta.kind} className="cc-kind-rates">
            <div className="cc-kind-rates__head">
              <div>
                <h4 className="cc-kind-rates__title">{meta.title}</h4>
                <p className="cc-section-desc">{meta.hint}</p>
              </div>
              <button type="button" className="cc-btn cc-btn--primary" onClick={() => startAdd(meta.kind)}>
                + Add {meta.kind} rate
              </button>
            </div>
            <div className="cc-rates-table-wrap">
              <table className="cc-table cc-rates-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Rate</th>
                    {meta.showUnits ? <th>Units</th> : null}
                    {meta.showMaxChemical ? <th>Max kg/Ha</th> : null}
                    <th>Notes</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(byKind[meta.kind] || []).length === 0 ? (
                    <tr>
                      <td colSpan={meta.showUnits || meta.showMaxChemical ? 7 : 6} className="cc-empty">
                        No {meta.kind} rates yet.
                      </td>
                    </tr>
                  ) : (
                    (byKind[meta.kind] || []).map((row) => (
                      <tr
                        key={row.id}
                        className={Number(row.activated) !== 1 ? 'cc-rates-row--inactive' : undefined}
                      >
                        <td>{row.name || '—'}</td>
                        <td>{formatRate(row.rate)}</td>
                        {meta.showUnits ? <td>{row.units || '—'}</td> : null}
                        {meta.showMaxChemical ? <td>{formatRate(row.spray_max_chemical)}</td> : null}
                        <td className="cc-cell-text">{formatFriendlyNotes(row.notes)}</td>
                        <td>
                          <span
                            className={`cc-rate-badge ${Number(row.activated) === 1 ? 'is-active' : 'is-off'}`}
                          >
                            {Number(row.activated) === 1 ? 'Active' : 'Off'}
                          </span>
                        </td>
                        <td className="cc-actions">
                          <button type="button" className="cc-btn cc-btn--ghost" onClick={() => startEdit(row)}>
                            Edit
                          </button>
                          {Number(row.activated) === 1 ? (
                            <button
                              type="button"
                              className="cc-btn cc-btn--ghost"
                              disabled={deactivating}
                              onClick={() => handleDeactivate(row)}
                            >
                              Deactivate
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ))}

      {form && activeMeta ? (
        <form className="cc-rate-form" onSubmit={handleSave}>
          <h4 className="cc-rate-form__title">
            {form.id ? `Edit ${form.rate_kind} rate` : `New ${form.rate_kind} rate`}
          </h4>
          <div className="cc-section-grid">
            <div className="cc-field">
              <label className="cc-label" htmlFor="cc-cat-name">
                Name
              </label>
              <input
                id="cc-cat-name"
                className="cc-input"
                type="text"
                placeholder={`e.g. Spray 1,500`}
                value={form.name}
                onChange={(e) => onChange('name', e.target.value)}
              />
            </div>
            <div className="cc-field">
              <label className="cc-label" htmlFor="cc-cat-rate">
                Rate
              </label>
              <input
                id="cc-cat-rate"
                className="cc-input"
                type="number"
                step="any"
                required
                value={form.rate}
                onChange={(e) => onChange('rate', e.target.value)}
              />
            </div>
            {activeMeta.showUnits ? (
              <div className="cc-field">
                <label className="cc-label" htmlFor="cc-cat-units">
                  Units (kg / Ha)
                </label>
                <input
                  id="cc-cat-units"
                  className="cc-input"
                  type="text"
                  value={form.units}
                  onChange={(e) => onChange('units', e.target.value)}
                />
              </div>
            ) : null}
            {activeMeta.showMaxChemical ? (
              <div className="cc-field">
                <label className="cc-label" htmlFor="cc-cat-max">
                  Spray max (kg / Ha)
                </label>
                <input
                  id="cc-cat-max"
                  className="cc-input"
                  type="number"
                  step="any"
                  value={form.spray_max_chemical}
                  onChange={(e) => onChange('spray_max_chemical', e.target.value)}
                />
              </div>
            ) : null}
            <div className="cc-field cc-field--full">
              <label className="cc-label" htmlFor="cc-cat-notes">
                Notes
              </label>
              <input
                id="cc-cat-notes"
                className="cc-input"
                type="text"
                value={form.notes}
                onChange={(e) => onChange('notes', e.target.value)}
              />
            </div>
          </div>
          <div className="cc-rate-form__actions">
            <button type="button" className="cc-btn cc-btn--ghost" onClick={cancelForm}>
              Cancel
            </button>
            <button type="submit" className="cc-btn cc-btn--primary" disabled={saving}>
              {saving ? 'Saving…' : form.id ? 'Update rate' : 'Save rate'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
