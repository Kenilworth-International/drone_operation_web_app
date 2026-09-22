export function formatDate(dateString) {
  if (!dateString) return 'N/A';
  try {
    if (typeof dateString === 'string') {
      if (dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
        return dateString.split('T')[0];
      }
      const date = new Date(dateString);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleDateString();
      }
    }
    return String(dateString);
  } catch {
    return String(dateString);
  }
}

export function formatTime(timeString) {
  if (!timeString) return 'N/A';
  const value = String(timeString);
  return value.length >= 5 ? value.slice(0, 5) : value;
}

/** Preferred: use workflow_stage from API; fall back for older rows. */
export function getWorkflowStage(report) {
  if (report?.workflow_stage) return report.workflow_stage;
  if (report?.action === 'd') return 'declined';
  if (report?.action === 'r' || report?.maintenanceId || report?.maintenance_id) return 'in_repair';
  if (report?.approved_at || report?.approved_by) return 'approved';
  const inv = report?.investigation_status || 'n';
  if (inv === 'v' || inv === 'c') return 'review';
  if (inv === 'i' || Number(report?.investigation_required) === 1) return 'investigating';
  return 'pending';
}

export function getActionStatus(report) {
  const stage = getWorkflowStage(report);
  const maintenanceId = report?.maintenance_id || report?.maintenanceId;
  switch (stage) {
    case 'declined':
      return { key: 'declined', label: 'Declined' };
    case 'investigating':
      return { key: 'investigating', label: 'Investigating' };
    case 'review':
      return { key: 'review', label: 'Investigation review' };
    case 'approved':
      return { key: 'approved', label: 'Approved' };
    case 'in_repair':
      return {
        key: 'repair',
        label: maintenanceId ? `In repair #${maintenanceId}` : 'In repair',
      };
    default:
      return { key: 'pending', label: 'Pending review' };
  }
}

export function getAvailableActions(report) {
  const stage = getWorkflowStage(report);
  const actions = [];

  if (stage === 'declined') {
    return actions;
  }

  // Fleet no longer runs investigation — recommend to HR instead
  if (stage === 'pending' || stage === 'investigating' || stage === 'review') {
    actions.push('decline', 'recommend_investigation', 'approve');
  } else if (stage === 'approved' || stage === 'in_repair') {
    // Approve already done; recommend still allowed if HR not yet notified
    actions.push('recommend_investigation');
  }

  return actions;
}

export function getEquipmentLabel(report) {
  const items = report?.equipment_items;
  if (Array.isArray(items) && items.length) {
    return items
      .map((item) => {
        const name = item.label || item.item_name || item.item_code || `Item #${item.id}`;
        const serial = item.device_serial || item.deviceSerial;
        return serial ? `${name} (${serial})` : name;
      })
      .join(', ');
  }
  return report?.equipment_type_name || 'N/A';
}
