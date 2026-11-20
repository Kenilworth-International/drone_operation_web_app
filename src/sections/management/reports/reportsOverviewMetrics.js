import { pct } from './reportsExcelExport';

/** Sum DJI completed Ha from field.task[] */
export function opsCompletedFromField(field) {
  if (!Array.isArray(field?.task) || !field.task.length) return 0;
  return field.task.reduce((sum, t) => sum + (Number(t.dji_field_area) || 0), 0);
}

export function pilotCompletedFromField(field) {
  return Number(field?.completed_area_by_pilot_for_field) || 0;
}

/**
 * Flatten pilot-performance API payload into field rows with both completion sources.
 */
export function flattenPilotPerformance(response) {
  const rows = [];
  (response?.pilots || []).forEach((pilot) => {
    (pilot.plans || []).forEach((plan) => {
      (plan.fields || []).forEach((field) => {
        const assigned = Number(field.field_area);
        if (!Number.isFinite(assigned)) return;
        const completedPilot = pilotCompletedFromField(field);
        const completedOps = opsCompletedFromField(field);
        rows.push({
          date: plan.date,
          pilotName: pilot.pilot_name,
          group: plan.group,
          plantation: plan.plantation,
          region: plan.region,
          estate: plan.estate,
          fieldName: field.field_name,
          planType: plan.type,
          assigned,
          completedPilot,
          completedOps,
          taskStatus: field.task_status,
          pctPilot: pct(completedPilot, assigned),
          pctOps: pct(completedOps, assigned),
        });
      });
    });
  });
  return rows;
}

export function summarizeFieldRows(rows) {
  const totals = (rows || []).reduce(
    (acc, row) => {
      acc.assigned += Number(row.assigned) || 0;
      acc.completedPilot += Number(row.completedPilot) || 0;
      acc.completedOps += Number(row.completedOps) || 0;
      return acc;
    },
    { assigned: 0, completedPilot: 0, completedOps: 0 }
  );
  return {
    ...totals,
    pctPilot: pct(totals.completedPilot, totals.assigned),
    pctOps: pct(totals.completedOps, totals.assigned),
    rowCount: (rows || []).length,
  };
}

/** Roll up to pilot summary with dual completion. */
export function rollupPilotSummary(response) {
  const map = {};
  (response?.pilots || []).forEach((pilot) => {
    const name = pilot.pilot_name || 'Unknown';
    if (!map[name]) {
      map[name] = {
        pilotName: name,
        assignedSpray: 0,
        assignedSpread: 0,
        assignedTotal: 0,
        completedPilotSpray: 0,
        completedPilotSpread: 0,
        completedPilotTotal: 0,
        completedOpsSpray: 0,
        completedOpsSpread: 0,
        completedOpsTotal: 0,
        flyingTime: Number(pilot.flying_time) || 0,
      };
    }
    const row = map[name];
    (pilot.plans || []).forEach((plan) => {
      const assigned = Number(plan.assigned_area_to_pilot_in_plan) || 0;
      if (plan.type === 'spy') row.assignedSpray += assigned;
      else if (plan.type === 'spd') row.assignedSpread += assigned;
      row.assignedTotal += assigned;
      (plan.fields || []).forEach((field) => {
        const p = pilotCompletedFromField(field);
        const o = opsCompletedFromField(field);
        if (plan.type === 'spy') {
          row.completedPilotSpray += p;
          row.completedOpsSpray += o;
        } else if (plan.type === 'spd') {
          row.completedPilotSpread += p;
          row.completedOpsSpread += o;
        }
        row.completedPilotTotal += p;
        row.completedOpsTotal += o;
      });
    });
    row.pctPilot = pct(row.completedPilotTotal, row.assignedTotal);
    row.pctOps = pct(row.completedOpsTotal, row.assignedTotal);
  });
  return Object.values(map);
}

/** Daily trend from flattened field rows. */
export function dailyTrendFromRows(rows) {
  const byDate = new Map();
  (rows || []).forEach((row) => {
    const key = String(row.date || '').slice(0, 10);
    if (!key) return;
    if (!byDate.has(key)) {
      byDate.set(key, { date: key, assigned: 0, completedPilot: 0, completedOps: 0 });
    }
    const bucket = byDate.get(key);
    bucket.assigned += Number(row.assigned) || 0;
    bucket.completedPilot += Number(row.completedPilot) || 0;
    bucket.completedOps += Number(row.completedOps) || 0;
  });
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}
