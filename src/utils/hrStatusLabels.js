export const humanizeToken = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

export const leaveStatusLabel = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'approved') return 'Approved';
  if (s === 'pending_l1') return 'Waiting for reporting officer';
  if (s === 'pending_l2') return 'Waiting for HOD';
  if (s === 'rejected') return 'Rejected';
  if (s === 'cancelled' || s === 'canceled') return 'Cancelled';
  return humanizeToken(status) || 'Unknown';
};

export const attendanceDayStatusLabel = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'completed') return 'Finished for the day';
  if (s === 'in_progress') return 'Marked in — not out yet';
  if (s === 'not_marked') return 'No attendance recorded';
  return humanizeToken(status) || 'Unknown';
};

export const requestModeLabel = (mode) => {
  const s = String(mode || '').toLowerCase();
  if (s === 'full_day') return 'Full day';
  if (s === 'half_day') return 'Half day';
  if (s === 'short') return 'Short leave';
  return humanizeToken(mode) || '—';
};

export const lieuStatusLabel = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'available') return 'Ready to use';
  if (s === 'used') return 'Already used';
  if (s === 'expired') return 'Expired';
  return humanizeToken(status) || '—';
};

export const autoReasonLabel = (reason) => {
  const key = String(reason || '')
    .toLowerCase()
    .trim();
  const map = {
    late_mark_in: 'Late arrival',
    early_mark_out: 'Left early',
    insufficient_hours: 'Did not complete required hours',
  };
  if (map[key]) return map[key];
  return humanizeToken(reason) || 'Automatic short leave';
};

export const autoShortLeaveLine = (entry) => {
  if (!entry) return null;
  const reason = autoReasonLabel(
    typeof entry === 'string' ? entry : entry.autoReason || entry.auto_reason,
  );
  const mins =
    typeof entry === 'object'
      ? entry.shortLeaveMinutes ?? entry.short_leave_minutes
      : null;
  return mins ? `Auto short leave: ${reason} (${mins} min)` : `Auto short leave: ${reason}`;
};

export const nopayDayLabel = (message) => {
  if (!message || message === true) return 'No pay day';
  const raw = String(message).trim();
  if (!raw) return 'No pay day';
  const key = raw.toLowerCase();

  const byCode = {
    late_mark_in: 'No pay · Late arrival',
    insufficient_hours: 'No pay · Incomplete hours',
    early_mark_out: 'No pay · Left early',
    late_mark_in_half_day_nopay: 'No pay · Morning half-day',
  };
  if (byCode[key]) return byCode[key];

  // Token-like codes (underscores, no spaces) → short label
  if (/^[a-z0-9_]+$/i.test(raw) && raw.includes('_')) {
    return `No pay · ${autoReasonLabel(raw)}`;
  }

  // Backend often stores the long policy sentence — compress to a short label.
  const lower = key;
  if (lower.includes('half') && (lower.includes('no pay') || lower.includes('nopay'))) {
    return 'No pay · Morning half-day';
  }
  if (lower.includes('late') && (lower.includes('mark-in') || lower.includes('mark in') || lower.includes('arrival'))) {
    return 'No pay · Late arrival';
  }
  if (lower.includes('insufficient') || lower.includes('required hours') || lower.includes('did not complete')) {
    return 'No pay · Incomplete hours';
  }
  if (lower.includes('early') && (lower.includes('mark-out') || lower.includes('mark out') || lower.includes('left'))) {
    return 'No pay · Left early';
  }
  if (lower.includes('no pay') || lower.includes('nopay') || lower.includes('no-pay')) {
    return 'No pay day';
  }

  // Keep short custom notes; truncate very long leftovers.
  if (raw.length > 80) return `${raw.slice(0, 77).trim()}…`;
  return raw;
};

/** One-line supporting hint under the short no-pay title (optional). */
export const nopayDayHint = (message) => {
  if (!message || message === true) return 'Marked as unpaid for this attendance day.';
  const lower = String(message).toLowerCase();
  if (lower.includes('5th') || lower.includes('9th') || lower.includes('13th') || lower.includes('no-pay slot')) {
    return 'Auto short-leave no-pay slot for this month (5th, 9th, 13th…).';
  }
  if (lower.includes('half')) {
    return 'Casual leave was exhausted, so half-day was recorded as no pay.';
  }
  return 'Marked as unpaid for this attendance day.';
};

/** Turn attendance_records.notes JSON into a short human-readable line for tables. */
export const formatAttendanceNotesDisplay = (raw) => {
  if (raw == null || raw === '') return '—';

  let notes = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return '—';
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        notes = JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    } else {
      return trimmed;
    }
  }

  if (typeof notes !== 'object' || Array.isArray(notes) || notes == null) {
    return String(raw);
  }

  const parts = [];
  if (notes.nopay || notes.nopayReason) {
    parts.push(nopayDayLabel(notes.nopayReason || true));
  }

  const autoHalf = notes.autoHalfDay || notes.auto_half_day;
  if (autoHalf) {
    const halfKey = String(autoHalf).toLowerCase();
    if (halfKey.includes('nopay')) {
      parts.push('Automatic no-pay half-day');
    } else {
      parts.push('Automatic morning half-day');
    }
  }

  if (notes.shortLeaveReplacedByHalfDay) {
    parts.push('Short leave replaced by half-day');
  }

  const autoShort = notes.autoShortLeave || notes.auto_short_leave;
  if (autoShort) {
    parts.push(autoShortLeaveLine(autoShort));
  }

  const lateMinutes = Number(notes.lateMinutes);
  if (Number.isFinite(lateMinutes) && lateMinutes > 0) {
    parts.push(`Late ${Math.round(lateMinutes)} min`);
  }

  const allowedLate = Number(notes.allowedLateMinutes);
  if (Number.isFinite(allowedLate) && allowedLate > 0) {
    parts.push(`Late allowance ${Math.round(allowedLate)} min`);
  }

  const shortfall = Number(notes.shortfallMinutes);
  if (Number.isFinite(shortfall) && shortfall > 0) {
    parts.push(`Shortfall ${Math.round(shortfall)} min`);
  }

  if (notes.weeklyGraceUsed) {
    parts.push('Weekly grace used');
  }

  if (notes.leaveAutoCancelled) {
    parts.push('Leave cancelled on mark-in');
  }

  const filtered = parts.filter(Boolean);
  return filtered.length ? filtered.join(' · ') : '—';
};

export const GEOFENCE_RADIUS_METERS = 20;

export const locationValidLabel = (value) => {
  if (value == null || value === '') return 'Not checked';
  return Number(value) === 1 ? 'At office location' : 'Outside office range';
};

/** Caption under mark-in/out time when GPS and/or geofence data exists. */
export const attendanceLocationCaption = ({ locationValid, lat, lng, distanceMeters }) => {
  const hasCoords =
    lat != null &&
    lng != null &&
    lat !== '' &&
    lng !== '' &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng));

  const distance =
    distanceMeters != null && distanceMeters !== '' && Number.isFinite(Number(distanceMeters))
      ? Math.round(Number(distanceMeters))
      : null;

  if (locationValid != null && locationValid !== '') {
    const atOffice = Number(locationValid) === 1;
    const label = atOffice ? 'At office location' : 'Location';
    return distance != null ? `${label} · ${distance} m` : label;
  }

  if (hasCoords) {
    if (distance != null) return `${distance} m from office`;
    return 'View on map';
  }

  return 'Not checked';
};

export const isOutsideGeofenceRange = (distanceMeters, locationValid, radiusMeters = GEOFENCE_RADIUS_METERS) => {
  if (locationValid != null && locationValid !== '') {
    return Number(locationValid) !== 1;
  }
  const distance = Number(distanceMeters);
  if (!Number.isFinite(distance)) return false;
  return distance > Number(radiusMeters || GEOFENCE_RADIUS_METERS);
};

export const formatAttendanceDistanceDetail = ({
  distanceMeters,
  locationValid,
  radiusMeters = GEOFENCE_RADIUS_METERS,
}) => {
  const distance = Number(distanceMeters);
  if (!Number.isFinite(distance)) {
    return { text: '-', statusLabel: 'Not checked', outsideRange: false };
  }
  const outsideRange = isOutsideGeofenceRange(distance, locationValid, radiusMeters);
  const rounded = Math.round(distance);
  return {
    text: `${rounded} m`,
    statusLabel: outsideRange
      ? `${rounded} m · ${radiusMeters} m+ (outside range)`
      : `${rounded} m · within ${radiusMeters} m`,
    outsideRange,
  };
};

export const overlookingStatusLabel = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'accepted') return 'Accepted';
  if (s === 'declined') return 'Declined';
  if (s === 'pending') return 'Waiting for response';
  return humanizeToken(status) || '—';
};
