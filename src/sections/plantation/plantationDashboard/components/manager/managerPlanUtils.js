import { format, isValid, parse, parseISO } from 'date-fns';

export function missionLabel(missionTypeId) {
  const code = String(missionTypeId || '').toLowerCase();
  if (code === 'spy') return 'Spray';
  if (code === 'spd') return 'Spread';
  return missionTypeId || 'Mission';
}

export function planReference(planId) {
  return `Plan ${planId}`;
}

export function formatPlanDate(pickedDate) {
  if (!pickedDate) return '—';
  const raw = String(pickedDate).trim();
  let date = parseISO(raw);
  if (!isValid(date)) date = parse(raw, 'yyyy-MM-dd', new Date());
  if (!isValid(date)) return raw;
  return format(date, 'EEE, d MMM yyyy');
}

export function formatExtentHa(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${n.toFixed(2)} Ha`;
}

export function allPlanStatus(plan) {
  const cancel = Number(plan?.manager_cancel_reason || 0);
  if (cancel > 0) return { label: 'Cancelled', variant: 'cancelled' };
  const approved = plan?.manager_approval === 1 || plan?.manager_approval === '1';
  if (approved) return { label: 'Approved', variant: 'approved' };
  return { label: 'Pending', variant: 'pending' };
}

export function canApprovePendingPlan(plan) {
  return Number(plan?.can_approve) === 1;
}

export function canEditAllPlan(plan) {
  return Number(plan?.can_edit) === 1;
}

export function planAreaFromDetail(detail) {
  if (!detail) return 0;
  const fields = detail.fields || [];
  let sum = 0;
  for (const f of fields) {
    const area = Number(f.field_area ?? f.area ?? 0);
    if (Number.isFinite(area)) sum += area;
  }
  if (sum > 0) return Math.round(sum * 100) / 100;
  const fromPlan = Number(detail.plan?.totalExtent ?? detail.plan?.area ?? 0);
  return Number.isFinite(fromPlan) ? fromPlan : 0;
}

export function formatBlockHint(reason) {
  if (!reason) return '';
  return String(reason).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
