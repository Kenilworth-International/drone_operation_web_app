import * as XLSX from 'xlsx';

const pad2 = (n) => String(n).padStart(2, '0');

export const toYmd = (date) => {
  if (!date) return '';
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

export const formatRangeLabel = (startDate, endDate) => {
  const a = toYmd(startDate);
  const b = toYmd(endDate);
  if (a && b) return `${a}_to_${b}`;
  return a || b || 'range';
};

/**
 * Export a table to Excel with period metadata in the header rows.
 * @param {{
 *   sheetName?: string,
 *   filePrefix: string,
 *   startDate: Date|string,
 *   endDate: Date|string,
 *   headers: string[],
 *   rows: Array<Array<string|number|null|undefined>>,
 *   title?: string,
 * }} opts
 */
export function exportReportExcel({
  sheetName = 'Report',
  filePrefix = 'report',
  startDate,
  endDate,
  headers,
  rows,
  title = 'DSMS Report',
}) {
  const startYmd = toYmd(startDate);
  const endYmd = toYmd(endDate);
  const meta = [
    [title],
    [`Period: ${startYmd || '—'} → ${endYmd || '—'}`],
    [`Exported: ${new Date().toISOString()}`],
    [],
    headers,
  ];
  const body = (rows || []).map((row) =>
    (row || []).map((cell) => (cell == null ? '' : cell))
  );
  const worksheet = XLSX.utils.aoa_to_sheet([...meta, ...body]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, String(sheetName).slice(0, 31));
  const fileName = `${filePrefix}_${formatRangeLabel(startDate, endDate)}.xlsx`;
  XLSX.writeFile(workbook, fileName);
  return fileName;
}

export function pct(completed, assigned) {
  const a = Number(assigned) || 0;
  const c = Number(completed) || 0;
  if (a <= 0) return null;
  return (c / a) * 100;
}

export function formatPct(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `${Number(value).toFixed(1)}%`;
}

export function formatHa(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}
