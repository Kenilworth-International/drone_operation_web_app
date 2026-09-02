export function isSameLeaveApproverAtBothLevels(item) {
  const l1 = Number(item?.level1_approver_id || item?.level1ApproverId || 0);
  const l2 = Number(item?.level2_approver_id || item?.level2ApproverId || 0);
  return Boolean(l1 && l2 && l1 === l2);
}

export function isLateDepartureApproval(item) {
  return item?.approvalKind === 'late_departure' || item?.request_mode === 'late_departure';
}

export function getApprovalKind(item) {
  return isLateDepartureApproval(item) ? 'late_departure' : 'leave';
}

export function isPendingReportingApproval(item) {
  const status = String(item?.current_status || item?.status || '').toLowerCase();
  if (status !== 'pending_l1') return false;
  return !isSameLeaveApproverAtBothLevels(item);
}

export function isPendingHodApproval(item) {
  const status = String(item?.current_status || item?.status || '').toLowerCase();
  if (status === 'pending_l2') return true;
  if (status === 'pending_l1' && isSameLeaveApproverAtBothLevels(item)) return true;
  return false;
}

export function splitApprovalsInbox(approvals = []) {
  const list = Array.isArray(approvals) ? approvals : [];
  return {
    reportingApprovals: list.filter(isPendingReportingApproval),
    hodApprovals: list.filter(isPendingHodApproval),
  };
}

export function getApprovalModeLabel(item) {
  if (isLateDepartureApproval(item)) {
    const until = String(item?.requested_until_time || '').slice(0, 5);
    return until ? `Late Departure · until ${until}` : 'Late Departure';
  }
  const mode = String(item?.request_mode || item?.requestMode || '').toLowerCase();
  if (mode === 'half_day') {
    const session = String(item?.half_day_session || item?.halfDaySession || 'morning').toLowerCase();
    return session === 'afternoon' || session === 'evening' ? 'Half Day · Afternoon' : 'Half Day · Morning';
  }
  if (mode === 'short') {
    return `Short · ${item?.short_leave_minutes || item?.shortLeaveMinutes || 120} min`;
  }
  return 'Full Day';
}

export function getApprovalDateLabel(item, formatDate) {
  if (isLateDepartureApproval(item)) {
    return formatDate(item?.attendance_date || item?.start_date);
  }
  const start = formatDate(item?.start_date || item?.startDate);
  const end = formatDate(item?.end_date || item?.endDate);
  return end && end !== start ? `${start} → ${end}` : start;
}

export function getApprovalTypeBadge(item) {
  if (isLateDepartureApproval(item)) return 'Late Departure';
  return item?.leaveTypeName || item?.leave_type_code || 'Leave';
}

export function getApprovalDateDisplay(item, formatDate) {
  if (isLateDepartureApproval(item)) {
    return formatDate(item?.attendance_date || item?.start_date);
  }
  const start = formatDate(item?.start_date || item?.startDate);
  const end = formatDate(item?.end_date || item?.endDate);
  return end && end !== start ? `${start} → ${end}` : start;
}

export function getApprovalStageLabel(item) {
  const status = String(item?.current_status || item?.status || '').toLowerCase();
  if (isSameLeaveApproverAtBothLevels(item)) {
    if (status === 'pending_l1' || status === 'pending_l2') return 'Awaiting approval';
    return 'Pending';
  }
  if (status === 'pending_l2') return 'Awaiting HOD';
  if (status === 'pending_l1') return 'Awaiting RO';
  return 'Pending';
}

export function getApprovalEmployeePhotoUrl(item) {
  const direct = item?.employeePhotoUrl || item?.employee_photo_url;
  if (direct) return String(direct);
  return null;
}

function normalizeApprovalAttachment(entry, index) {
  if (entry && typeof entry === 'object') {
    const filename = String(entry.filename || entry.name || `File ${index + 1}`).trim();
    const url = String(entry.url || '').trim();
    const probe = `${url} ${filename}`.toLowerCase();
    return {
      filename,
      url,
      isImage: Boolean(entry.isImage) || /\.(jpe?g|png|webp|gif|bmp|heic)$/i.test(probe),
      isPdf: Boolean(entry.isPdf) || /\.pdf$/i.test(probe),
    };
  }

  const name = String(entry || '').trim();
  if (!name) {
    return { filename: '', url: '', isImage: false, isPdf: false };
  }
  const lower = name.toLowerCase();
  return {
    filename: name,
    url: name.startsWith('http') ? name : name,
    isImage: /\.(jpe?g|png|webp|gif|bmp|heic)$/i.test(lower),
    isPdf: /\.pdf$/i.test(lower),
  };
}

export function getApprovalAttachments(item) {
  const fromFiles = Array.isArray(item?.attachment_files) ? item.attachment_files : [];
  if (fromFiles.length > 0) {
    return fromFiles
      .map((file, index) => normalizeApprovalAttachment(file, index))
      .filter((file) => file.url);
  }

  let raw = item?.attachment_urls ?? item?.attachmentUrls ?? [];
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = raw.trim() ? [raw] : [];
    }
  }
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry, index) => normalizeApprovalAttachment(entry, index))
    .filter((file) => file.url);
}
