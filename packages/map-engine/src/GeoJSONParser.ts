export type GeoJsonGeometryType = 'Point' | 'LineString' | 'Polygon';

export interface GeoJsonGeometry {
  type: GeoJsonGeometryType;
  coordinates: number[] | number[][] | number[][][];
}

export interface GeoJsonFeature {
  id?: string | number;
  type: 'Feature';
  geometry: GeoJsonGeometry;
  properties: Record<string, unknown>;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

export function parseGeoJSON(input: string | GeoJsonFeatureCollection): GeoJsonFeatureCollection {
  const parsed = typeof input === 'string' ? (JSON.parse(input) as unknown) : input;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid GeoJSON input.');
  }
  const record = parsed as Record<string, unknown>;
  if (record.type !== 'FeatureCollection' || !Array.isArray(record.features)) {
    throw new Error('GeoJSON must be a FeatureCollection.');
  }

  const features = record.features.map(normalizeFeature).filter((feature): feature is GeoJsonFeature => feature !== null);
  return { type: 'FeatureCollection', features };
}

export function computeBounds(collection: GeoJsonFeatureCollection): [number, number, number, number] | null {
  const points: number[][] = [];
  for (const feature of collection.features) {
    points.push(...extractCoordinates(feature.geometry));
  }
  if (points.length === 0) return null;

  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    const lng = point[0];
    const lat = point[1];
    if (typeof lng !== 'number' || typeof lat !== 'number') continue;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }

  if (!Number.isFinite(minLng)) return null;
  return [minLng, minLat, maxLng, maxLat];
}

function normalizeFeature(input: unknown): GeoJsonFeature | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  if (record.type !== 'Feature') return null;
  const geometry = normalizeGeometry(record.geometry);
  if (!geometry) return null;
  return {
    id: typeof record.id === 'string' || typeof record.id === 'number' ? record.id : undefined,
    type: 'Feature',
    geometry,
    properties: isRecord(record.properties) ? record.properties : {},
  };
}

function normalizeGeometry(input: unknown): GeoJsonGeometry | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  const type = record.type;
  if (type !== 'Point' && type !== 'LineString' && type !== 'Polygon') return null;
  if (!isCoordinates(record.coordinates, type)) return null;
  return {
    type,
    coordinates: record.coordinates,
  };
}

function isCoordinates(
  value: unknown,
  type: GeoJsonGeometryType,
): value is number[] | number[][] | number[][][] {
  if (!Array.isArray(value)) return false;
  if (type === 'Point') {
    return typeof value[0] === 'number' && typeof value[1] === 'number';
  }
  if (type === 'LineString') {
    return value.every(
      (point) =>
        Array.isArray(point) &&
        typeof point[0] === 'number' &&
        typeof point[1] === 'number',
    );
  }
  return value.every(
    (ring) =>
      Array.isArray(ring) &&
      ring.every(
        (point) =>
          Array.isArray(point) &&
          typeof point[0] === 'number' &&
          typeof point[1] === 'number',
      ),
  );
}

function extractCoordinates(geometry: GeoJsonGeometry): number[][] {
  if (geometry.type === 'Point') return [geometry.coordinates as number[]];
  if (geometry.type === 'LineString') return geometry.coordinates as number[][];
  return (geometry.coordinates as number[][][]).flat();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
