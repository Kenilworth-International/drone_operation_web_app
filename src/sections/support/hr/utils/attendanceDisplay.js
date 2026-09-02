export function formatAttendanceDistance(value) {
  if (value == null || value === '') return null;
  const meters = Number(value);
  if (!Number.isFinite(meters)) return null;
  const rounded = Math.round(meters * 10) / 10;
  return `${rounded} m`;
}

export function getAttendanceRecordDistance(record, kind) {
  if (!record) return null;
  const keys = kind === 'in'
    ? ['mark_in_distance_meters', 'markInDistanceMeters', 'mark_in_distance', 'markInDistance']
    : ['mark_out_distance_meters', 'markOutDistanceMeters', 'mark_out_distance', 'markOutDistance'];
  for (const key of keys) {
    const value = record[key];
    if (value != null && value !== '') {
      const meters = Number(value);
      if (Number.isFinite(meters)) return meters;
    }
  }
  return null;
}

export function getAttendanceLocationValid(record, kind) {
  if (!record) return null;
  const raw = kind === 'in'
    ? (record.mark_in_location_valid ?? record.markInLocationValid)
    : (record.mark_out_location_valid ?? record.markOutLocationValid);
  if (raw == null || raw === '') return null;
  return Number(raw) === 1 || raw === true;
}

export function resolveAttendanceDistanceLabel(options) {
  const {
    recordedDistance,
    liveDistance,
    showLivePreview = false,
    locationReady = false,
    locationError = '',
    pendingAction = null,
  } = options;

  if (recordedDistance != null) {
    return {
      primary: formatAttendanceDistance(recordedDistance) || '—',
      secondary: 'Recorded at mark',
      tone: 'recorded',
    };
  }

  if (locationError) {
    return {
      primary: 'Location off',
      secondary: 'Enable GPS to mark',
      tone: 'warn',
    };
  }

  if (showLivePreview && locationReady && liveDistance != null) {
    return {
      primary: formatAttendanceDistance(liveDistance) || '—',
      secondary: pendingAction === 'mark_out' ? 'Live · used on mark-out' : 'Live · used on mark-in',
      tone: 'live',
    };
  }

  if (!locationReady) {
    return {
      primary: 'Getting GPS…',
      secondary: 'Required to mark',
      tone: 'muted',
    };
  }

  return {
    primary: '—',
    secondary: pendingAction ? 'Shown when you mark' : 'Not marked yet',
    tone: 'muted',
  };
}
