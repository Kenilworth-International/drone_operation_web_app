import React, { useMemo } from 'react';
import {
  computeSelectedFieldArea,
  fieldUsableForMission,
  formatAreaLimitsHint,
  getEstateAreaLimits,
  groupFieldsByDivision,
  isAreaWithinLimits,
} from './managerPlanFieldUtils';

export default function ManagerPlanFieldsStep({
  ctx,
  missionTypeId,
  selectedFieldIds,
  onToggleField,
  startedFieldIds = null,
}) {
  const fields = ctx?.fields || [];
  const { min, max, hasAreaLimits } = getEstateAreaLimits(ctx?.estate);
  const selectedSum = useMemo(
    () => computeSelectedFieldArea(fields, selectedFieldIds),
    [fields, selectedFieldIds]
  );
  const areaWithinLimits = isAreaWithinLimits(selectedSum, min, max, hasAreaLimits);
  const areaHint = hasAreaLimits ? formatAreaLimitsHint(min, max, selectedSum) : null;
  const divisionGroups = useMemo(
    () => groupFieldsByDivision(fields, ctx?.divisions),
    [fields, ctx?.divisions]
  );

  const renderField = (f) => {
    const usable = fieldUsableForMission(f, missionTypeId);
    const started = startedFieldIds?.has(f.id);
    const selectable = usable && !started;
    const selected = selectedFieldIds.has(f.id);

    return (
      <label
        key={f.id}
        className={[
          'pd-mgr-field-check',
          selected ? 'pd-mgr-field-check--on' : '',
          !selectable ? 'pd-mgr-field-check--locked' : '',
          !usable ? 'pd-mgr-field-check--blocked' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <input
          type="checkbox"
          checked={selected}
          disabled={!selectable}
          onChange={() => selectable && onToggleField(f.id)}
        />
        <span className="pd-mgr-field-check-body">
          <span className="pd-mgr-field-check-name">{f.short_name || f.field || `#${f.id}`}</span>
          <span className="pd-mgr-field-check-meta">
            {parseFloat(f.area || 0).toFixed(2)} Ha
            {started ? ' · Started' : !usable ? ' · Not available' : ''}
          </span>
        </span>
      </label>
    );
  };

  return (
    <>
      <p className="pd-mgr-wizard-intro">Select fields to include in this mission plan.</p>
      {areaHint ? (
        <p className={`pd-mgr-area-hint${areaWithinLimits ? '' : ' pd-mgr-area-hint--error'}`}>
          {areaHint}
        </p>
      ) : null}
      {hasAreaLimits && !areaWithinLimits && selectedFieldIds.size > 0 ? (
        <p className="pd-mgr-area-hint pd-mgr-area-hint--error">
          Total selected area must be between {min} and {max} Ha to continue.
        </p>
      ) : null}

      {divisionGroups.length > 0 ? (
        divisionGroups.map((group) => (
          <section key={group.id} className="pd-mgr-division-block">
            <h3 className="pd-mgr-division-title">{group.label}</h3>
            <div className="pd-mgr-field-grid">{group.fields.map(renderField)}</div>
          </section>
        ))
      ) : (
        <div className="pd-mgr-field-grid">{fields.map(renderField)}</div>
      )}
    </>
  );
}

export function useManagerFieldStepValidation(ctx, missionTypeId, selectedFieldIds) {
  const fields = ctx?.fields || [];
  const { min, max, hasAreaLimits } = getEstateAreaLimits(ctx?.estate);
  const selectedSum = computeSelectedFieldArea(fields, selectedFieldIds);
  const areaWithinLimits = isAreaWithinLimits(selectedSum, min, max, hasAreaLimits);

  if (selectedFieldIds.size === 0) {
    return { valid: false, message: 'Select at least one field.' };
  }
  for (const id of selectedFieldIds) {
    const f = fields.find((x) => x.id === id);
    if (!f || !fieldUsableForMission(f, missionTypeId)) {
      return { valid: false, message: 'One or more selected fields are not allowed for this mission type.' };
    }
  }
  if (hasAreaLimits && !areaWithinLimits) {
    return { valid: false, message: `Total area must be between ${min} and ${max} Ha.` };
  }
  return { valid: true, selectedSum, areaWithinLimits, hasAreaLimits, min, max };
}
