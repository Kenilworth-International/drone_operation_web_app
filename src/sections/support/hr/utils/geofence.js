export function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function evaluateAttendanceGeofence({ workLocation, userLat, userLng, radiusMeters = 20 }) {
  const officeLat = workLocation?.latitude != null ? Number(workLocation.latitude) : null;
  const officeLng = workLocation?.longitude != null ? Number(workLocation.longitude) : null;
  const userLatitude = userLat != null ? Number(userLat) : null;
  const userLongitude = userLng != null ? Number(userLng) : null;
  const allowedRadius = Number(radiusMeters || workLocation?.radiusMeters || 20);
  const workLocationName = workLocation?.name || workLocation?.code || 'Work location';

  if (!Number.isFinite(officeLat) || !Number.isFinite(officeLng)) {
    return {
      valid: null,
      distanceMeters: null,
      radiusMeters: allowedRadius,
      reason: 'work_location_not_configured',
      workLocationName,
      message: `${workLocationName} does not have map coordinates yet. Ask ICT to set latitude/longitude for this work location.`,
    };
  }

  if (!Number.isFinite(userLatitude) || !Number.isFinite(userLongitude)) {
    return {
      valid: false,
      distanceMeters: null,
      radiusMeters: allowedRadius,
      reason: 'device_location_missing',
      workLocationName,
      message: 'Getting location…',
    };
  }

  const distance = haversineDistanceMeters(userLatitude, userLongitude, officeLat, officeLng);
  const distanceMeters = Number(distance.toFixed(2));
  const withinRange = distance <= allowedRadius;

  return {
    valid: withinRange,
    distanceMeters,
    radiusMeters: allowedRadius,
    reason: withinRange ? 'within_range' : 'outside_range',
    workLocationName,
    message: withinRange
      ? `In range · ${distanceMeters}m`
      : `${distanceMeters}m away · max ${allowedRadius}m`,
  };
}
