import React, { useMemo, useState } from 'react';
import { FaSearch, FaBuilding } from 'react-icons/fa';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  useGetMappingPlantationsQuery,
  useUpdateMappingPlantationMutation,
} from '../../../api/services NodeJs/mappingHierarchyApi';
import { withCurrentWingSearch } from '../../../config/wingRouteGuard';
import '../../../styles/corporateCustomers.css';
import { CustomerDetailsModal, formatRate } from './corporateCustomerModal';
import PlantationRatePicker from './PlantationRatePicker';
import PlantationEmailsEditor, {
  formatEmailsPreview,
  parseEmailsList,
} from './PlantationEmailsEditor';

const EMPTY_FORM = {
  plantation_code: '',
  emails: [],
  address: '',
  bill_to_address: '',
  ship_to_address: '',
  spray_units: '',
  spray_max_chemical: '',
  spread_units: '',
};

const FOCUS_META = {
  plantation_code: {
    title: 'Plantation code',
    subtitle: 'Short uppercase code used in invoice numbers (e.g. BTE → 26OCT_BTE_PRE0001).',
    scalarFields: ['plantation_code'],
    saveLabel: 'Save code',
  },
  emails: {
    title: 'Emails',
    subtitle: 'Contact emails for this plantation. You can add more than one.',
    emailsEditor: true,
    saveLabel: 'Save emails',
  },
  spray: {
    title: 'Spray rate',
    subtitle: 'Assign the spray contract rate for this plantation.',
    rateKind: 'spray',
  },
  spread: {
    title: 'Spread rate',
    subtitle: 'Assign the spread contract rate for this plantation.',
    rateKind: 'spread',
  },
  scout: {
    title: 'Scout rate',
    subtitle: 'Assign the scout contract rate for this plantation.',
    rateKind: 'scout',
  },
  spray_units: {
    title: 'Spray units',
    subtitle: 'Unit label used with the spray rate (e.g. kg / Ha).',
    scalarFields: ['spray_units'],
    saveLabel: 'Save units',
  },
  spray_max_chemical: {
    title: 'Spray max (kg/Ha)',
    subtitle: 'Maximum chemical load for spray billing.',
    scalarFields: ['spray_max_chemical'],
    saveLabel: 'Save max',
  },
  spread_units: {
    title: 'Spread units',
    subtitle: 'Unit label used with the spread rate (e.g. kg / Ha).',
    scalarFields: ['spread_units'],
    saveLabel: 'Save units',
  },
  address: {
    title: 'Main address',
    subtitle: 'Used as the plantation primary address.',
    addressFields: ['address'],
    saveLabel: 'Save address',
  },
  bill_to_address: {
    title: 'Bill-to address',
    subtitle: 'Shown on invoices for this plantation.',
    addressFields: ['bill_to_address'],
    saveLabel: 'Save address',
  },
  ship_to_address: {
    title: 'Ship-to address',
    subtitle: 'Shown on shipping documents.',
    addressFields: ['ship_to_address'],
    saveLabel: 'Save address',
  },
};

function formatText(v, maxLen = 48) {
  if (v == null || String(v).trim() === '') return '—';
  const s = String(v).trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}…`;
}

function rowToForm(row) {
  return {
    plantation_code: row.plantation_code ?? '',
    emails: parseEmailsList(row.emails),
    address: row.address ?? '',
    bill_to_address: row.bill_to_address ?? '',
    ship_to_address: row.ship_to_address ?? '',
    spray_units: row.spray_units ?? '',
    spray_max_chemical:
      row.spray_max_chemical != null && row.spray_max_chemical !== ''
        ? String(row.spray_max_chemical)
        : '12',
    spread_units: row.spread_units ?? '',
  };
}

function buildFieldPayload(id, form, fields) {
  const payload = { id, ratesAndAddressesOnly: true };
  fields.forEach((key) => {
    if (key === 'emails') {
      payload.emails = Array.isArray(form.emails) ? form.emails : [];
      return;
    }
    const raw = String(form[key] ?? '').trim();
    if (key === 'spray_max_chemical') {
      if (raw === '') {
        payload[key] = 12;
        return;
      }
      const n = Number(raw);
      payload[key] = Number.isFinite(n) && n > 0 ? n : 12;
      return;
    }
    if (key === 'plantation_code') {
      const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
      payload[key] = code === '' ? null : code;
      return;
    }
    payload[key] = raw === '' ? null : raw;
  });
  return payload;
}

function ClickableCell({ children, title, onOpen, className = '' }) {
  return (
    <td
      className={`cc-cell--clickable ${className}`.trim()}
      title={title || 'Click to update'}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onOpen();
        }
      }}
      tabIndex={0}
      role="button"
    >
      {children}
    </td>
  );
}

function CorporateCustomers() {
  const location = useLocation();
  const contractRatesTo = useMemo(
    () => withCurrentWingSearch('/home/contract-rates', location.search, location.pathname),
    [location.pathname, location.search]
  );
  const { data: response, isLoading, isError, refetch } = useGetMappingPlantationsQuery({});
  const [updatePlantation, { isLoading: saving }] = useUpdateMappingPlantationMutation();

  const [search, setSearch] = useState('');
  const [editRow, setEditRow] = useState(null);
  const [editFocus, setEditFocus] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const plantations = useMemo(() => {
    const list = response?.data;
    return Array.isArray(list) ? list : [];
  }, [response]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return plantations;
    return plantations.filter((p) => {
      const name = String(p.plantation || p.name || '').toLowerCase();
      return name.includes(q);
    });
  }, [plantations, search]);

  const focusMeta = editFocus ? FOCUS_META[editFocus] : null;

  const closeModals = () => {
    setEditRow(null);
    setEditFocus(null);
    setForm(EMPTY_FORM);
  };

  const openEdit = (row, focus) => {
    setEditRow(row);
    setEditFocus(focus);
    setForm(rowToForm(row));
  };

  const onFormChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveFields = async (e) => {
    e.preventDefault();
    if (!editRow?.id || !focusMeta) return;
    const fields = focusMeta.emailsEditor
      ? ['emails']
      : focusMeta.addressFields || focusMeta.scalarFields;
    if (!fields?.length) return;
    if (focusMeta.emailsEditor) {
      const bad = (form.emails || []).filter(
        (em) => em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(em)
      );
      if (bad.length) {
        toast.error(`Invalid email: ${bad[0]}`);
        return;
      }
    }
    try {
      const res = await updatePlantation(buildFieldPayload(editRow.id, form, fields)).unwrap();
      if (res?.status === true) {
        toast.success(res.message || 'Updated');
        closeModals();
        refetch();
      } else {
        toast.error(res?.message || 'Update failed');
      }
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Update failed');
    }
  };

  const isRateFocus = Boolean(focusMeta?.rateKind);
  const isFieldFocus = Boolean(
    focusMeta?.addressFields || focusMeta?.scalarFields || focusMeta?.emailsEditor
  );

  return (
    <div className="cc-page">
      <header
        className="cc-header"
        style={{
          backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.92)), url(${process.env.PUBLIC_URL}/assets/images/cover.png)`,
        }}
      >
        <div className="cc-header-text">
          <h1 className="cc-title">
            <FaBuilding className="cc-title-icon" aria-hidden />
            Corporate Customer
          </h1>
          <p className="cc-subtitle">
            Click a value to update only that field. Set plantation code for invoice numbers
            (e.g. 26OCT_BTE_PRE0001). Manage shared prices in{' '}
            <Link to={contractRatesTo} className="cc-inline-link">
              Contract Rates
            </Link>
            . Plantation name cannot be changed here.
          </p>
        </div>
        <div className="cc-search-wrap">
          <input
            type="search"
            className="cc-search"
            placeholder="Search plantation…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <FaSearch className="cc-search-icon" aria-hidden />
        </div>
      </header>

      <div className="cc-body">
        {isLoading && <p className="cc-status">Loading plantations…</p>}
        {isError && (
          <p className="cc-status cc-status--error">Could not load plantations. Check API and migration.</p>
        )}

        {!isLoading && !isError && (
          <div className="cc-table-wrap">
            <table className="cc-table">
              <thead>
                <tr>
                  <th>Plantation</th>
                  <th>Code</th>
                  <th>Emails</th>
                  <th>Spray rate</th>
                  <th>Spray units</th>
                  <th>Spray max (kg/Ha)</th>
                  <th>Spread rate</th>
                  <th>Spread units</th>
                  <th>Scout rate</th>
                  <th>Address</th>
                  <th>Bill-to</th>
                  <th>Ship-to</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="cc-empty">
                      No plantations found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <tr key={row.id}>
                      <td className="cc-name" title="Plantation name cannot be changed">
                        {row.plantation || row.name || `#${row.id}`}
                      </td>
                      <ClickableCell
                        className="cc-code"
                        title="Update plantation code"
                        onOpen={() => openEdit(row, 'plantation_code')}
                      >
                        {row.plantation_code || '—'}
                      </ClickableCell>
                      <ClickableCell
                        className="cc-cell-text"
                        title={formatEmailsPreview(row.emails, 200)}
                        onOpen={() => openEdit(row, 'emails')}
                      >
                        {formatEmailsPreview(row.emails)}
                      </ClickableCell>
                      <ClickableCell title="Update spray rate" onOpen={() => openEdit(row, 'spray')}>
                        {formatRate(row.spray_rate)}
                      </ClickableCell>
                      <ClickableCell title="Update spray units" onOpen={() => openEdit(row, 'spray_units')}>
                        {row.spray_units || '—'}
                      </ClickableCell>
                      <ClickableCell
                        title="Update spray max"
                        onOpen={() => openEdit(row, 'spray_max_chemical')}
                      >
                        {formatRate(row.spray_max_chemical ?? 12)}
                      </ClickableCell>
                      <ClickableCell title="Update spread rate" onOpen={() => openEdit(row, 'spread')}>
                        {formatRate(row.spread_rate)}
                      </ClickableCell>
                      <ClickableCell
                        title="Update spread units"
                        onOpen={() => openEdit(row, 'spread_units')}
                      >
                        {row.spread_units || '—'}
                      </ClickableCell>
                      <ClickableCell title="Update scout rate" onOpen={() => openEdit(row, 'scout')}>
                        {formatRate(row.scout_rate)}
                      </ClickableCell>
                      <ClickableCell
                        className="cc-cell-text"
                        title={row.address || 'Update address'}
                        onOpen={() => openEdit(row, 'address')}
                      >
                        {formatText(row.address)}
                      </ClickableCell>
                      <ClickableCell
                        className="cc-cell-text"
                        title={row.bill_to_address || 'Update bill-to'}
                        onOpen={() => openEdit(row, 'bill_to_address')}
                      >
                        {formatText(row.bill_to_address)}
                      </ClickableCell>
                      <ClickableCell
                        className="cc-cell-text"
                        title={row.ship_to_address || 'Update ship-to'}
                        onOpen={() => openEdit(row, 'ship_to_address')}
                      >
                        {formatText(row.ship_to_address)}
                      </ClickableCell>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editRow && focusMeta ? (
        <CustomerDetailsModal
          title={focusMeta.title}
          titleId="cc-edit-title"
          subtitle={focusMeta.subtitle}
          row={editRow}
          readOnly={false}
          formState={form}
          onChange={onFormChange}
          onClose={closeModals}
          compact
          focusKey={editFocus}
          formProps={isFieldFocus ? { onSubmit: handleSaveFields } : undefined}
          includeAddresses={Boolean(focusMeta.addressFields)}
          addressFields={focusMeta.addressFields || null}
          scalarFields={focusMeta.scalarFields || null}
          emailsPanel={
            focusMeta.emailsEditor ? (
              <PlantationEmailsEditor emails={form.emails} onChange={onFormChange} />
            ) : null
          }
          ratesPanel={
            isRateFocus ? (
              <PlantationRatePicker
                plantationId={editRow.id}
                readOnly={false}
                rateKind={focusMeta.rateKind}
              />
            ) : null
          }
          footer={
            isFieldFocus ? (
              <>
                <button type="button" className="cc-btn cc-btn--ghost" onClick={closeModals}>
                  Cancel
                </button>
                <button type="submit" className="cc-btn cc-btn--primary" disabled={saving}>
                  {saving ? 'Saving…' : focusMeta.saveLabel || 'Save'}
                </button>
              </>
            ) : (
              <button type="button" className="cc-btn cc-btn--ghost" onClick={closeModals}>
                Done
              </button>
            )
          }
        />
      ) : null}
    </div>
  );
}

export default CorporateCustomers;
