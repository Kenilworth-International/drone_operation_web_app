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

/**
 * Legacy-style Excel: header row + data (+ optional total), no meta banner.
 * Matches earlier ops-room exports; extra columns/rows are fine.
 */
export function exportLegacyExcel({
  sheetName = 'Report',
  fileName,
  headers,
  rows,
  merges = null,
  cols = null,
}) {
  const body = (rows || []).map((row) =>
    (row || []).map((cell) => (cell == null ? '' : cell))
  );
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...body]);
  if (merges?.length) worksheet['!merges'] = merges;
  if (cols?.length) worksheet['!cols'] = cols;
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, String(sheetName).slice(0, 31));
  XLSX.writeFile(workbook, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
  return fileName;
}

/** Multi-row header Excel (e.g. by-date pivoted layout). */
export function exportLegacyAoaExcel({
  sheetName = 'Report',
  fileName,
  aoa,
  merges = null,
  cols = null,
}) {
  const worksheet = XLSX.utils.aoa_to_sheet(aoa || []);
  if (merges?.length) worksheet['!merges'] = merges;
  if (cols?.length) worksheet['!cols'] = cols;
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, String(sheetName).slice(0, 31));
  XLSX.writeFile(workbook, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
  return fileName;
}

export function monthBounds(yearMonth) {
  const [y, m] = String(yearMonth || '').split('-').map(Number);
  if (!y || !m) {
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
      yearMonth: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`,
    };
  }
  return {
    start: new Date(y, m - 1, 1),
    end: new Date(y, m, 0),
    yearMonth: `${y}-${pad2(m)}`,
  };
}
