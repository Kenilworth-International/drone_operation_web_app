const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export function periodDescriptionSuffix(periodLabel) {
  return periodLabel ? `${periodLabel}(Hectare)` : '(Hectare)';
}

export function activityLabel(missionType, estateName = '') {
  const name = String(estateName || '').trim() || 'Estate';
  if (missionType === 'Spray') return `Service: Spraying - ${name}`;
  if (missionType === 'Spread') return `Service: Spreading - ${name}`;
  if (missionType === 'Scout') return `Service: Scouting - ${name}`;
  return `Service: ${missionType} - ${name}`;
}

function rateForMission(plantation, mission) {
  if (mission === 'Spread') return plantation?.spread_rate;
  if (mission === 'Scout') return plantation?.scout_rate;
  return plantation?.spray_rate;
}

/**
 * Build one invoice line per selected estate (and mission), from work-summary rows.
 * Matches backend billing rules using row.billingExtent already computed on the report.
 */
export function buildInvoiceLineItemsFromWorkSummary({
  rows,
  estateIds,
  estateMeta,
  plantation,
  periodLabel,
  missionFilter = 'all',
}) {
  if (!rows?.length || !estateIds?.length || !plantation) return [];

  const selectedIds = estateIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
  const estateNameById = new Map(
    (estateMeta || []).map((e) => [Number(e.id), String(e.estate || '').trim()])
  );
  const totals = new Map();

  for (const row of rows) {
    const mission = row.missionType;
    if (mission !== 'Spray' && mission !== 'Spread' && mission !== 'Scout') continue;
    if (missionFilter !== 'all' && mission !== missionFilter) continue;
    const estateId = Number(row.estateId);
    if (!selectedIds.includes(estateId)) continue;
    const key = `${estateId}:${mission}`;
    totals.set(key, (totals.get(key) || 0) + (Number(row.billingExtent) || 0));
  }

  const description = periodDescriptionSuffix(periodLabel);

  const lineItems = [];
  for (const estateId of selectedIds) {
    const estateName = estateNameById.get(estateId) || '';
    for (const mission of ['Spray', 'Spread', 'Scout']) {
      const qty = round2(totals.get(`${estateId}:${mission}`) || 0);
      if (qty <= 0) continue;
      const rate = rateForMission(plantation, mission);
      if (rate == null) continue;
      const rateNum = Number(rate);
      if (!Number.isFinite(rateNum)) continue;
      lineItems.push({
        activity: activityLabel(mission, estateName),
        description,
        qty,
        rate: rateNum,
        amount: round2(qty * rateNum),
        sku: '',
        mission_type: mission,
        estate_id: estateId,
        estate_name: estateName,
      });
    }
  }

  return lineItems;
}

export function buildInvoiceLineItemsFromBillingByEstate({
  billingHaByEstate,
  plantation,
  periodLabel,
  missionFilter = 'all',
}) {
  if (!billingHaByEstate?.length || !plantation) return [];
  const description = periodDescriptionSuffix(periodLabel);
  const lineItems = [];

  for (const entry of billingHaByEstate) {
    const estateId = Number(entry.estate_id);
    const estateName = String(entry.estate_name || '').trim();
    for (const mission of ['Spray', 'Spread', 'Scout']) {
      if (missionFilter !== 'all' && mission !== missionFilter) continue;
      const qty = round2(entry[mission] || 0);
      if (qty <= 0) continue;
      const rate = rateForMission(plantation, mission);
      if (rate == null) continue;
      const rateNum = Number(rate);
      if (!Number.isFinite(rateNum)) continue;
      lineItems.push({
        activity: activityLabel(mission, estateName),
        description,
        qty,
        rate: rateNum,
        amount: round2(qty * rateNum),
        sku: '',
        mission_type: mission,
        estate_id: estateId,
        estate_name: estateName,
      });
    }
  }

  return lineItems;
}

/**
 * Apply edited spray/spread/scout rates onto service lines (not fuel surcharge).
 * Returns updated line_items + subtotal for invoice-only edits.
 */
export function applyMissionRatesToLineItems(lineItems, { sprayRate, spreadRate, scoutRate } = {}) {
  const next = (lineItems || []).map((line) => {
    if (!line || line.line_type === 'fuel_surcharge') return line;
    const mission = String(line.mission_type || '');
    let rate = Number(line.rate);
    if (mission === 'Spray' && sprayRate != null && sprayRate !== '') {
      rate = Number(sprayRate);
    } else if (mission === 'Spread' && spreadRate != null && spreadRate !== '') {
      rate = Number(spreadRate);
    } else if (mission === 'Scout' && scoutRate != null && scoutRate !== '') {
      rate = Number(scoutRate);
    }
    if (!Number.isFinite(rate)) return line;
    const qty = Number(line.qty) || 0;
    return { ...line, rate, amount: round2(qty * rate) };
  });
  const subtotal = round2(next.reduce((s, li) => s + (Number(li.amount) || 0), 0));
  return { line_items: next, subtotal };
}

/** Prefer work-summary / per-estate API data over merged single-line drafts. */
export function mergeDraftWithWorkSummaryLines(draft, options) {
  if (!draft) return draft;
  const periodLabel = draft.period_label;
  let clientLines = buildInvoiceLineItemsFromWorkSummary({
    ...options,
    periodLabel,
  });

  if (!clientLines.length && draft.billing_ha_by_estate?.length) {
    clientLines = buildInvoiceLineItemsFromBillingByEstate({
      billingHaByEstate: draft.billing_ha_by_estate,
      plantation: options.plantation || draft.plantation,
      periodLabel,
      missionFilter: options.missionFilter,
    });
  }

  const apiLineCount = draft.line_items?.length || 0;
  const shouldReplace =
    clientLines.length > 0 &&
    (clientLines.length > apiLineCount ||
      (options.estateIds?.length > 1 && apiLineCount <= 1));

  if (!shouldReplace) return draft;

  const subtotal = round2(clientLines.reduce((s, li) => s + (Number(li.amount) || 0), 0));
  return { ...draft, line_items: clientLines, subtotal };
}
