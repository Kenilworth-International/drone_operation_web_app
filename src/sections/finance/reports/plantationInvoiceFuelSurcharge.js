export const BASE_FUEL_PRICE = 300;
export const FUEL_LITERS_PER_HA = 5;

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** First day of month from invoice period end (YYYY-MM-01). */
export function billingMonthFromPeriodEnd(periodEnd) {
  const text = String(periodEnd || '').trim();
  const match = text.match(/^(\d{4})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-01`;
  const d = new Date(`${text}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

/** Rate per Ha: (monthly fuel price − base) × liters/Ha. Can be negative (discount). */
export function fuelSurchargeRatePerHa(
  fuelPrice,
  baseFuelPrice = BASE_FUEL_PRICE,
  litersPerHa = FUEL_LITERS_PER_HA
) {
  return round2((Number(fuelPrice) - Number(baseFuelPrice)) * Number(litersPerHa));
}

export function stripFuelSurchargeLines(lineItems) {
  return (lineItems || []).filter((li) => li.line_type !== 'fuel_surcharge');
}

/**
 * Insert a fuel surcharge row under each Spray service line (same estate QTY).
 */
export function appendFuelSurchargeLines(
  lineItems,
  { enabled, fuelPrice, baseFuelPrice = BASE_FUEL_PRICE, litersPerHa = FUEL_LITERS_PER_HA }
) {
  const baseLines = stripFuelSurchargeLines(lineItems);
  if (!enabled || !baseLines.length) return baseLines;

  const price = Number(fuelPrice);
  if (!Number.isFinite(price)) return baseLines;

  const ratePerHa = fuelSurchargeRatePerHa(price, baseFuelPrice, litersPerHa);
  if (ratePerHa === 0) return baseLines;

  const result = [];
  for (const line of baseLines) {
    result.push(line);
    if (line.mission_type !== 'Spray' || !(Number(line.qty) > 0)) continue;

    const qty = round2(line.qty);
    const estateName = String(line.estate_name || '').trim() || 'Estate';
    result.push({
      activity: `Service: Spraying - ${estateName} Fuel surcharge`,
      description: String(line.description || '').replace(/\(Hectare\)$/i, ' Fuel surcharge'),
      qty,
      // Fuel surcharge reuses spray Ha — never carry plan_count (would double-count plans).
      plan_count: null,
      rate: ratePerHa,
      amount: round2(qty * ratePerHa),
      sku: '',
      mission_type: 'FuelSurcharge',
      line_type: 'fuel_surcharge',
      parent_mission_type: 'Spray',
      estate_id: line.estate_id,
      fuel_price: price,
      fuel_base_price: Number(baseFuelPrice),
      fuel_liters_per_ha: Number(litersPerHa),
    });
  }
  return result;
}

export function isBillableServiceLine(line) {
  return line && line.line_type !== 'fuel_surcharge';
}

/** Unique service plans only (excludes fuel surcharge rows). */
export function sumInvoiceLinePlans(lineItems) {
  return (lineItems || []).reduce((sum, li) => {
    if (!isBillableServiceLine(li)) return sum;
    return sum + (Number(li.plan_count) || 0);
  }, 0);
}

/** Service Ha only (excludes fuel surcharge so spray Ha is not doubled). */
export function sumInvoiceLineHa(lineItems) {
  return round2(
    (lineItems || []).reduce((sum, li) => {
      if (!isBillableServiceLine(li)) return sum;
      return sum + (Number(li.qty) || 0);
    }, 0)
  );
}

export function sumLineItemsAmount(lineItems) {
  return round2((lineItems || []).reduce((s, li) => s + (Number(li.amount) || 0), 0));
}

export function applyFuelSurchargeToDraft(draft, fuelOptions) {
  if (!draft) return draft;
  const lines = appendFuelSurchargeLines(draft.line_items, fuelOptions);
  return {
    ...draft,
    line_items: lines,
    subtotal: sumLineItemsAmount(lines),
  };
}
