/** Format API DATE fields as YYYY-MM-DD in Asia/Colombo (avoids UTC off-by-one). */
export function formatApiDateYmd(value) {
  if (value == null || value === '') return '';
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  }
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
}

/** Locale display date from API DATE values (Colombo calendar day). */
export function formatApiDateDisplay(value, fallback = '—') {
  const ymd = formatApiDateYmd(value);
  if (!ymd) return fallback;
  const [y, m, d] = ymd.split('-').map((part) => Number(part));
  if (!y || !m || !d) return fallback;
  const local = new Date(y, m - 1, d, 12, 0, 0);
  if (Number.isNaN(local.getTime())) return ymd;
  return local.toLocaleDateString();
}
