/**
 * Hide technical migration/seed notes from Corporate Customer & Contract Rates UI.
 */
export function formatFriendlyNotes(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return '—';
  if (
    /^seeded\b/i.test(text) ||
    /^migrated\b/i.test(text) ||
    /plantation_billing_rate/i.test(text) ||
    /\.(spray|spread|scout)_rate\b/i.test(text) ||
    /baseline assignment/i.test(text)
  ) {
    return 'Initial setup';
  }
  return text;
}
