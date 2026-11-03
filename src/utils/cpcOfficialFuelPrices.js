/** Client-side CPC official price helpers (CRA `/cpc-fuel` proxy fallback). */

export const OFFICIAL_FUEL_TYPE_LABELS = {
  petrol_92: 'Petrol 92',
  petrol_95: 'Petrol 95',
  auto_diesel: 'Auto Diesel',
  super_diesel: 'Super Diesel',
  kerosene: 'Kerosene',
};

const CPC_PRODUCT_MATCHERS = [
  { code: 'petrol_92', test: /petrol\s*92/i },
  { code: 'petrol_95', test: /petrol\s*95/i },
  { code: 'super_diesel', test: /super\s*diesel/i },
  { code: 'auto_diesel', test: /auto\s*diesel/i },
  { code: 'kerosene', test: /^lanka\s+kerosene$/i },
];

function mapProductToCode(productName) {
  const name = String(productName || '').trim();
  if (!name || /industrial\s+kerosene/i.test(name)) return null;
  for (const matcher of CPC_PRODUCT_MATCHERS) {
    if (matcher.test.test(name)) return matcher.code;
  }
  return null;
}

function isoDateToYmd(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function parseCpcApiPrices(payload, scrapedAt = new Date().toISOString()) {
  const rows = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
      ? payload
      : [];
  const byCode = new Map();
  for (const row of rows) {
    if (!row) continue;
    const status = String(row.status || 'active').toLowerCase();
    if (status && status !== 'active') continue;
    const code = mapProductToCode(row.product || row.name || row.title);
    if (!code) continue;
    const price = Number(row.price ?? row.price_lkr ?? row.amount);
    if (!Number.isFinite(price)) continue;
    const recordedAt = isoDateToYmd(row.effectiveDate || row.effective_from || row.recorded_at);
    const prev = byCode.get(code);
    if (prev?.recorded_at && recordedAt && recordedAt < prev.recorded_at) continue;
    byCode.set(code, {
      fuel_type: code,
      label: OFFICIAL_FUEL_TYPE_LABELS[code],
      source: 'cpc',
      price_lkr: price,
      recorded_at: recordedAt,
      scraped_at: scrapedAt,
    });
  }
  return [...byCode.values()];
}

/** Same-origin CRA bridge → https://api.ceypetco.gov.lk (dev server only; requires restart after setupProxy change). */
export async function fetchOfficialFuelPricesViaLocalProxy() {
  const scrapedAt = new Date().toISOString();
  const response = await fetch('/cpc-fuel/api/admin/fuel-prices/active', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const contentType = String(response.headers.get('content-type') || '');
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`CPC proxy error: ${response.status}`);
  }
  if (!contentType.includes('json') || raw.trimStart().startsWith('<')) {
    throw new Error(
      'CPC proxy returned HTML instead of JSON — restart the CRA dev server so setupProxy.cpc bridge loads'
    );
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    throw new Error(`CPC proxy returned invalid JSON: ${err.message}`);
  }
  const prices = parseCpcApiPrices(payload, scrapedAt);
  if (!prices.length) throw new Error('CPC proxy returned no matching fuel prices');
  return {
    prices,
    last_verified_at: scrapedAt,
    last_verified_by_source: { cpc_proxy: scrapedAt },
    stale: false,
    source: 'local_cpc_proxy',
    options: Object.entries(OFFICIAL_FUEL_TYPE_LABELS).map(([fuel_type, label]) => ({
      fuel_type,
      label,
    })),
  };
}
