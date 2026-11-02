import React from 'react';
import {
  FaTimes,
  FaBuilding,
  FaMapMarkerAlt,
  FaFileInvoiceDollar,
  FaTruck,
  FaTint,
  FaSeedling,
  FaSearchLocation,
  FaFlask,
  FaBalanceScale,
  FaHashtag,
  FaEnvelope,
} from 'react-icons/fa';

export function formatRate(v) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) : String(v);
}

const FOCUS_ICONS = {
  spray: FaTint,
  spread: FaSeedling,
  scout: FaSearchLocation,
  spray_units: FaBalanceScale,
  spray_max_chemical: FaFlask,
  spread_units: FaBalanceScale,
  plantation_code: FaHashtag,
  emails: FaEnvelope,
  address: FaMapMarkerAlt,
  bill_to_address: FaFileInvoiceDollar,
  ship_to_address: FaTruck,
};

const SCALAR_FIELDS = {
  plantation_code: {
    key: 'plantation_code',
    label: 'Plantation code',
    type: 'text',
    placeholder: 'e.g. BTE',
  },
  spray_units: { key: 'spray_units', label: 'Spray units', type: 'text', placeholder: 'e.g. kg / Ha' },
  spray_max_chemical: {
    key: 'spray_max_chemical',
    label: 'Spray max (kg/Ha)',
    type: 'number',
    placeholder: 'e.g. 12',
  },
  spread_units: { key: 'spread_units', label: 'Spread units', type: 'text', placeholder: 'e.g. kg / Ha' },
};

function PlantationBanner({ row, compact = false }) {
  const name = row.plantation || row.name || '—';
  const group = row.group_name || row.group;
  return (
    <div className={`cc-plantation-banner${compact ? ' cc-plantation-banner--compact' : ''}`}>
      <div className="cc-plantation-banner__icon" aria-hidden>
        <FaBuilding />
      </div>
      <div className="cc-plantation-banner__text">
        <span className="cc-plantation-banner__label">Plantation</span>
        <span className="cc-plantation-banner__name">{name}</span>
        {group ? <span className="cc-plantation-banner__group">{group}</span> : null}
      </div>
      {!compact ? (
        <span className="cc-plantation-banner__badge">Name cannot be changed</span>
      ) : null}
    </div>
  );
}

function DetailField({ fieldKey, label, hint, type, readOnly, dataSource, formState, onChange, emphasis }) {
  const id = `cc-field-${fieldKey}`;
  return (
    <div
      className={`cc-field ${type === 'textarea' ? 'cc-field--full' : ''} ${
        emphasis ? 'cc-field--emphasis' : ''
      }`.trim()}
    >
      <label className="cc-label" htmlFor={readOnly ? undefined : id}>
        {label}
      </label>
      {hint ? <p className="cc-field-hint">{hint}</p> : null}
      {readOnly ? (
        <div className="cc-readonly" id={id}>
          {type === 'number' ? formatRate(dataSource[fieldKey]) : dataSource[fieldKey] || '—'}
        </div>
      ) : type === 'textarea' ? (
        <textarea
          id={id}
          className="cc-input cc-textarea"
          rows={emphasis ? 6 : 3}
          value={formState[fieldKey] ?? ''}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          placeholder={`Enter ${label.toLowerCase()}…`}
        />
      ) : (
        <input
          id={id}
          className={`cc-input${emphasis ? ' cc-input--emphasis' : ''}`}
          type={type}
          step={type === 'number' ? 'any' : undefined}
          value={formState[fieldKey] ?? ''}
          onChange={(e) => {
            let next = e.target.value;
            if (fieldKey === 'plantation_code') {
              next = next.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
            }
            onChange(fieldKey, next);
          }}
          placeholder={
            fieldKey === 'plantation_code'
              ? 'e.g. BTE'
              : type === 'text'
                ? `Enter ${label.toLowerCase()}…`
                : undefined
          }
          maxLength={fieldKey === 'plantation_code' ? 16 : undefined}
          autoCapitalize={fieldKey === 'plantation_code' ? 'characters' : undefined}
          spellCheck={fieldKey === 'plantation_code' ? false : undefined}
        />
      )}
    </div>
  );
}

const CURRENT_RATE_SECTIONS = [
  {
    id: 'spray',
    title: 'Current spray (spy)',
    description: 'Active contract rates shown on the list (latest period as of today).',
    gridClass: '',
    fields: [
      { key: 'spray_rate', label: 'Rate', hint: null, type: 'number' },
      { key: 'spray_units', label: 'Units (kg / Ha)', hint: null, type: 'text' },
      { key: 'spray_max_chemical', label: 'Max chemical (kg / Ha)', hint: null, type: 'number' },
    ],
  },
  {
    id: 'spread',
    title: 'Current spread (spd)',
    description: null,
    gridClass: 'cc-section-grid--pair',
    fields: [
      { key: 'spread_rate', label: 'Rate', hint: null, type: 'number' },
      { key: 'spread_units', label: 'Units (kg / Ha)', hint: null, type: 'text' },
    ],
  },
  {
    id: 'scout',
    title: 'Current scout',
    description: null,
    gridClass: 'cc-section-grid--single',
    fields: [{ key: 'scout_rate', label: 'Scout rate', hint: null, type: 'number' }],
  },
];

const ADDRESS_SECTION = {
  id: 'addresses',
  title: 'Addresses',
  description: 'Used for billing and shipping documents.',
  gridClass: 'cc-section-grid--stack',
  fields: [
    { key: 'address', label: 'Main address', hint: null, type: 'textarea' },
    { key: 'bill_to_address', label: 'Bill-to', hint: null, type: 'textarea' },
    { key: 'ship_to_address', label: 'Ship-to', hint: null, type: 'textarea' },
  ],
};

function DetailFormSections({
  readOnly,
  dataSource,
  formState,
  onChange,
  includeCurrentRates = false,
  includeAddresses = true,
  addressFields = null,
  scalarFields = null,
  compact = false,
}) {
  let addressSection = null;
  if (includeAddresses) {
    if (Array.isArray(addressFields) && addressFields.length > 0) {
      const allowed = new Set(addressFields);
      const fields = ADDRESS_SECTION.fields.filter((f) => allowed.has(f.key));
      if (fields.length) {
        addressSection = {
          ...ADDRESS_SECTION,
          title: fields.length === 1 ? fields[0].label : ADDRESS_SECTION.title,
          description:
            fields.length === 1
              ? 'Shown on invoices and shipping documents.'
              : ADDRESS_SECTION.description,
          fields,
          gridClass: fields.length === 1 ? 'cc-section-grid--single' : ADDRESS_SECTION.gridClass,
          bare: compact && fields.length === 1,
        };
      }
    } else {
      addressSection = ADDRESS_SECTION;
    }
  }

  let scalarSection = null;
  if (Array.isArray(scalarFields) && scalarFields.length > 0) {
    const fields = scalarFields
      .map((key) => SCALAR_FIELDS[key])
      .filter(Boolean)
      .map((f) => ({ key: f.key, label: f.label, hint: null, type: f.type, placeholder: f.placeholder }));
    if (fields.length) {
      scalarSection = {
        id: 'scalars',
        title: fields.length === 1 ? fields[0].label : 'Details',
        description: null,
        gridClass: 'cc-section-grid--single',
        fields,
        bare: compact,
      };
    }
  }

  const sections = [
    ...(includeCurrentRates
      ? CURRENT_RATE_SECTIONS.map((s) => ({ ...s, forceReadOnly: true }))
      : []),
    ...(scalarSection ? [scalarSection] : []),
    ...(addressSection ? [addressSection] : []),
  ];
  if (!sections.length) return null;
  return (
    <div className={`cc-form-sections${compact ? ' cc-form-sections--compact' : ''}`}>
      {sections.map((section) => (
        <section
          key={section.id}
          className={`cc-section${section.bare ? ' cc-section--bare' : ''}`}
          aria-labelledby={`cc-section-${section.id}`}
        >
          {!section.bare ? (
            <div className="cc-section-head">
              <h3 id={`cc-section-${section.id}`} className="cc-section-title">
                {section.title}
              </h3>
              {section.description ? <p className="cc-section-desc">{section.description}</p> : null}
            </div>
          ) : (
            <h3 id={`cc-section-${section.id}`} className="sr-only">
              {section.title}
            </h3>
          )}
          <div className={`cc-section-grid ${section.gridClass}`.trim()}>
            {section.fields.map((f) => (
              <DetailField
                key={f.key}
                fieldKey={f.key}
                label={f.label}
                hint={f.hint}
                type={f.type}
                readOnly={readOnly || Boolean(section.forceReadOnly)}
                dataSource={dataSource}
                formState={formState}
                onChange={onChange}
                emphasis={Boolean(section.bare)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function CustomerDetailsModal({
  title,
  titleId,
  subtitle,
  row,
  readOnly,
  formState,
  onChange,
  onClose,
  footer,
  formProps,
  ratesPanel = null,
  showCurrentRates = false,
  includeAddresses = true,
  addressFields = null,
  scalarFields = null,
  emailsPanel = null,
  compact = false,
  focusKey = null,
}) {
  const FocusIcon = (focusKey && FOCUS_ICONS[focusKey]) || null;
  const accent =
    focusKey === 'spray_units' || focusKey === 'spray_max_chemical'
      ? 'spray'
      : focusKey === 'spread_units'
        ? 'spread'
        : focusKey === 'plantation_code' || focusKey === 'emails'
          ? 'address'
          : focusKey || 'default';

  const body = (
    <div className={`cc-modal-body${compact ? ' cc-modal-body--compact' : ''}`}>
      <PlantationBanner row={row} compact={compact} />
      {ratesPanel}
      {emailsPanel}
      <DetailFormSections
        readOnly={readOnly}
        dataSource={row}
        formState={formState}
        onChange={onChange}
        includeCurrentRates={showCurrentRates}
        includeAddresses={includeAddresses}
        addressFields={addressFields}
        scalarFields={scalarFields}
        compact={compact}
      />
    </div>
  );

  const shell = (
    <>
      <div className={`cc-modal-head${compact ? ' cc-modal-head--compact' : ''}`}>
        <div className="cc-modal-head__main">
          {compact && FocusIcon ? (
            <span className="cc-modal-head__icon" aria-hidden>
              <FocusIcon />
            </span>
          ) : null}
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle ? <p className="cc-modal-subtitle">{subtitle}</p> : null}
          </div>
        </div>
        <button type="button" className="cc-close" onClick={onClose} aria-label="Close">
          <FaTimes />
        </button>
      </div>
      {formProps ? (
        <form {...formProps}>
          {body}
          <div className="cc-modal-foot">{footer}</div>
        </form>
      ) : (
        <>
          {body}
          <div className="cc-modal-foot">{footer}</div>
        </>
      )}
    </>
  );

  return (
    <div
      className={`cc-modal-overlay${compact ? ' cc-modal-overlay--compact' : ''}`}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={`cc-modal cc-modal--details${compact ? ' cc-modal--compact' : ''} cc-modal--accent-${accent}`}
        role="dialog"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        {shell}
      </div>
    </div>
  );
}
