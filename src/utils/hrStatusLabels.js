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
  if (!message) return 'No pay day';
  const raw = String(message).trim();
  const key = raw.toLowerCase();
  const map = {
    late_mark_in:
      'No pay — automatic short leave on a no-pay slot (late arrival).',
    insufficient_hours:
      'No pay — automatic short leave on a no-pay slot (did not complete required hours).',
    early_mark_out:
      'No pay — automatic short leave on a no-pay slot (left early).',
  };
  if (map[key]) return map[key];
  // Token-like codes (underscores, no spaces) → humanize
  if (/^[a-z0-9_]+$/i.test(raw) && raw.includes('_')) {
    return `No pay — ${autoReasonLabel(raw)}`;
  }
  return raw;
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
