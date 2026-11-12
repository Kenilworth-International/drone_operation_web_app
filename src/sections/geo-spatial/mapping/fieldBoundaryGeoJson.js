/**
 * Normalize Esri / GeoJSON field boundaries for Mapping Update preview + API payload.
 */

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function ringLooksClosed(ring) {
  if (!Array.isArray(ring) || ring.length < 4) return false;
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1];
}

function closeRing(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return null;
  const copy = ring.map((pt) => {
    if (!Array.isArray(pt) || pt.length < 2) return null;
    const lon = Number(pt[0]);
    const lat = Number(pt[1]);
    if (!isFiniteNumber(lon) || !isFiniteNumber(lat)) return null;
    return [lon, lat];
  });
  if (copy.some((p) => !p)) return null;
  if (!ringLooksClosed(copy)) {
    copy.push([copy[0][0], copy[0][1]]);
  }
  return copy.length >= 4 ? copy : null;
}

function pushPolygonCoords(polygons, coords) {
  if (!Array.isArray(coords) || !coords.length) return;
  const rings = [];
  for (const ring of coords) {
    const closed = closeRing(ring);
    if (closed) rings.push(closed);
  }
  if (rings.length) polygons.push(rings);
}

function pushGeometry(polygons, geom) {
  if (!geom || typeof geom !== 'object') return;
  if (Array.isArray(geom.rings)) {
    const rings = [];
    for (const ring of geom.rings) {
      const closed = closeRing(ring);
      if (closed) rings.push(closed);
    }
    if (rings.length) polygons.push(rings);
    return;
  }
  if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
    pushPolygonCoords(polygons, geom.coordinates);
    return;
  }
  if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
    for (const poly of geom.coordinates) pushPolygonCoords(polygons, poly);
    return;
  }
  if (geom.type === 'GeometryCollection' && Array.isArray(geom.geometries)) {
    for (const g of geom.geometries) pushGeometry(polygons, g);
  }
}

function extractPolygons(raw) {
  const polygons = [];
  if (!raw || typeof raw !== 'object') {
    throw new Error('Boundary must be a JSON object');
  }

  if (raw.type === 'Polygon' || raw.type === 'MultiPolygon') {
    pushGeometry(polygons, raw);
    return polygons;
  }
  if (raw.type === 'Feature') {
    pushGeometry(polygons, raw.geometry);
    return polygons;
  }
  if (raw.type === 'FeatureCollection' && Array.isArray(raw.features)) {
    for (const f of raw.features) pushGeometry(polygons, f?.geometry);
    return polygons;
  }
  if (raw.geometryType || Array.isArray(raw.features)) {
    if (Array.isArray(raw.features)) {
      for (const f of raw.features) {
        if (f?.geometry) pushGeometry(polygons, f.geometry);
      }
    }
    return polygons;
  }
  if (Array.isArray(raw.rings)) {
    pushGeometry(polygons, raw);
    return polygons;
  }
  throw new Error('Unsupported format — use GeoJSON or Esri JSON polygons');
}

function buildGeometry(polygons) {
  if (!polygons.length) throw new Error('No polygon geometry found');
  if (polygons.length === 1) {
    return { type: 'Polygon', coordinates: polygons[0] };
  }
  return { type: 'MultiPolygon', coordinates: polygons };
}

function ringArea(ring) {
  let sum = 0;
  for (let i = 0, len = ring.length - 1; i < len; i += 1) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return sum / 2;
}

export function geometryAreaHa(geometry) {
  const polys =
    geometry?.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry?.type === 'MultiPolygon'
        ? geometry.coordinates
        : [];
  let totalM2 = 0;
  for (const poly of polys) {
    if (!poly?.length) continue;
    const outer = poly[0];
    const sampleLat = outer[0]?.[1] || 7;
    const mPerDegLat = 111320;
    const mPerDegLon = 111320 * Math.cos((sampleLat * Math.PI) / 180);
    const scaledOuter = outer.map(([lon, lat]) => [lon * mPerDegLon, lat * mPerDegLat]);
    let area = Math.abs(ringArea(scaledOuter));
    for (let i = 1; i < poly.length; i += 1) {
      const hole = poly[i].map(([lon, lat]) => [lon * mPerDegLon, lat * mPerDegLat]);
      area -= Math.abs(ringArea(hole));
    }
    totalM2 += Math.max(0, area);
  }
  return Math.round((totalM2 / 10000) * 100) / 100;
}

/**
 * Parse uploaded file text or existing DB value into normalized Polygon/MultiPolygon.
 */
export function normalizeFieldBoundaryInput(input) {
  let raw = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      throw new Error('Invalid JSON');
    }
  }
  const geometry = buildGeometry(extractPolygons(raw));
  const areaHa = geometryAreaHa(geometry);
  return { geometry, areaHa };
}

export function parseBoundaryFromField(field) {
  if (!field?.boundary_geojson) return null;
  try {
    const { geometry, areaHa } = normalizeFieldBoundaryInput(field.boundary_geojson);
    return { geometry, areaHa };
  } catch {
    return null;
  }
}

export function fieldHasBoundary(field) {
  const raw = field?.boundary_geojson;
  if (raw == null || raw === '') return false;
  if (typeof raw === 'string') return raw.trim().length > 2;
  if (typeof raw === 'object') return Boolean(raw.type || raw.coordinates || raw.rings);
  return false;
}

export function toLeafletFeature(geometry) {
  if (!geometry) return null;
  return {
    type: 'Feature',
    properties: {},
    geometry,
  };
}
