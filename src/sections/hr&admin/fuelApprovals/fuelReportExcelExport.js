/**
 * Detailed fuel report Excel matching the classic Fuel_Report_YYYY-MM_all.xlsx layout:
 * - Vehicle + Generator sheets
 * - Full transaction columns (card, price, WF Cal, difference, voucher/payment)
 * - Vehicle: subtotal row per person
 * - Generator: blank separator between people
 */
import * as XLSX from 'xlsx';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(String(value).includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatPaidAt = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const voucherStageLabel = (stage) => {
  const map = {
    no_voucher: 'No voucher',
    voucher_pending: 'Voucher pending',
    voucher_declined: 'Voucher declined',
    finance_declined: 'Finance declined',
    awaiting_payment: 'Awaiting payment',
    paid: 'Paid',
    voucher_linked: 'Linked',
  };
  return map[stage] || stage || '';
};

const wfCalFor = (row) => {
  const liters = Number(row.liters);
  const unit = Number(row.unit_price);
  if (!Number.isFinite(liters) || !Number.isFinite(unit)) return null;
  return round2(liters * unit);
};

const sortDetailRows = (rows) =>
  [...rows].sort((a, b) => {
    const nameCmp = String(a.person_name || '').localeCompare(String(b.person_name || ''), undefined, {
      sensitivity: 'base',
    });
    if (nameCmp !== 0) return nameCmp;
    const dateCmp = String(b.date || '').localeCompare(String(a.date || ''));
    if (dateCmp !== 0) return dateCmp;
    return Number(b.id) - Number(a.id);
  });

const groupByPerson = (rows) => {
  const sorted = sortDetailRows(rows);
  const groups = [];
  let current = null;
  sorted.forEach((row) => {
    const key = String(row.person_name || row.person_user_id || row.user_id || '—');
    if (!current || current.key !== key) {
      current = { key, rows: [] };
      groups.push(current);
    }
    current.rows.push(row);
  });
  return groups;
};

const vehicleHeaders = [
  'Date',
  'Time',
  'Person Name',
  'User ID',
  'Vehicle',
  'Fuel Category',
  'Card Holder',
  'Card No',
  'Card ID',
  'Card Balance',
  'Liters',
  'Unit Price',
  'Amount',
  'WF Cal',
  'Difference',
  'Approval',
  'Approved By',
  'Reject Reason',
  'Voucher No',
  'Voucher Stage',
  'Payment',
  'Payment Method',
  'Payment Ref',
  'Paid At',
  'Paid By',
  'Tx ID',
];

const generatorHeaders = [
  'Date',
  'Time',
  'Person Name',
  'User ID',
  'Card No',
  'Card ID',
  'Card Balance',
  'Liters',
  'Unit Price',
  'Amount',
  'WF cal',
  'Difference',
  'Approval',
  'Approved By',
  'Reject Reason',
  'Voucher No',
  'Voucher Stage',
  'Payment',
  'Payment Method',
  'Payment Ref',
  'Paid At',
  'Paid By',
  'Tx ID',
];

const vehicleRowValues = (row) => {
  const liters = row.liters != null ? Number(row.liters) : null;
  const amount = row.amount != null ? Number(row.amount) : null;
  const wf = wfCalFor(row);
  const diff = amount != null && wf != null ? round2(amount - wf) : null;
  return [
    formatDate(row.date),
    row.time || '',
    row.person_name || '',
    row.person_user_id ?? row.user_id ?? '',
    row.vehicle_no || '',
    row.fuel_category_name || row.category || '',
    row.card_holder || '',
    row.card_number || '',
    row.card_id ?? '',
    row.card_balance != null ? Number(row.card_balance) : '',
    liters,
    row.unit_price != null ? Number(row.unit_price) : '',
    amount,
    wf,
    diff,
    row.approval_status || '',
    row.approved_by_name || '',
    row.reject_reason || '',
    row.voucher_no || '',
    voucherStageLabel(row.voucher_stage),
    row.payment_status || '',
    row.payment_method || '',
    row.payment_reference || '',
    formatPaidAt(row.paid_at),
    row.paid_by_name || '',
    row.id,
  ];
};

const generatorRowValues = (row) => {
  const liters = row.liters != null ? Number(row.liters) : null;
  const amount = row.amount != null ? Number(row.amount) : null;
  const wf = wfCalFor(row);
  const diff = amount != null && wf != null ? round2(amount - wf) : null;
  return [
    formatDate(row.date),
    row.time || '',
    row.person_name || '',
    row.person_user_id ?? row.user_id ?? '',
    row.card_number || '',
    row.card_id ?? '',
    row.card_balance != null ? Number(row.card_balance) : '',
    liters,
    row.unit_price != null ? Number(row.unit_price) : '',
    amount,
    wf,
    diff,
    row.approval_status || '',
    row.approved_by_name || '',
    row.reject_reason || '',
    row.voucher_no || '',
    voucherStageLabel(row.voucher_stage),
    row.payment_status || '',
    row.payment_method || '',
    row.payment_reference || '',
    formatPaidAt(row.paid_at),
    row.paid_by_name || '',
    row.id,
  ];
};

const vehicleSubtotal = (groupRows) => {
  let liters = 0;
  let amount = 0;
  let wf = 0;
  groupRows.forEach((row) => {
    liters += Number(row.liters) || 0;
    amount += Number(row.amount) || 0;
    wf += wfCalFor(row) || 0;
  });
  liters = round2(liters);
  amount = round2(amount);
  wf = round2(wf);
  const diff = round2(amount - wf);
  // Align with classic layout: blank identity cols, totals on Liters/Amount/WF Cal/Difference
  return [
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    liters,
    null,
    amount,
    wf,
    diff,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ];
};

const emptyGeneratorSeparator = () => generatorHeaders.map(() => null);

function buildVehicleAoA(rows) {
  const aoa = [vehicleHeaders];
  const groups = groupByPerson(rows.filter((r) => r.fuel_source === 'vehicle'));
  groups.forEach((group) => {
    group.rows.forEach((row) => aoa.push(vehicleRowValues(row)));
    aoa.push(vehicleSubtotal(group.rows));
  });
  return aoa;
}

function buildGeneratorAoA(rows) {
  const aoa = [generatorHeaders];
  const groups = groupByPerson(rows.filter((r) => r.fuel_source === 'generator'));
  groups.forEach((group, idx) => {
    if (idx > 0) aoa.push(emptyGeneratorSeparator());
    group.rows.forEach((row) => aoa.push(generatorRowValues(row)));
  });
  return aoa;
}

/**
 * @param {object[]} rows - mapped fuel report rows (vehicle + generator)
 * @param {{ months?: string[] }} [options]
 */
export function downloadDetailedFuelReportExcel(rows, options = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildVehicleAoA(list)), 'Vehicle');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildGeneratorAoA(list)), 'Generator');

  const months = (options.months || []).filter(Boolean);
  const stamp = months.length ? months.join('_') : 'all';
  XLSX.writeFile(wb, `Fuel_Report_${stamp}_all.xlsx`);
}
