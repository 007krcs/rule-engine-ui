export interface MapPoint {
  id: string;
  lng: number;
  lat: number;
  weight?: number;
}

export interface Cluster {
  id: string;
  lng: number;
  lat: number;
  size: number;
  points: MapPoint[];
}

export interface HeatmapCell {
  key: string;
  lng: number;
  lat: number;
  intensity: number;
}

export class ClusterEngine {
  cluster(points: MapPoint[], zoom: number, radius = 60): Cluster[] {
    const buckets = new Map<string, MapPoint[]>();
    const size = this.cellSize(zoom, radius);
    for (const point of points) {
      if (!Number.isFinite(point.lng) || !Number.isFinite(point.lat)) continue;
      const x = Math.floor(point.lng / size);
      const y = Math.floor(point.lat / size);
      const key = `${x}:${y}`;
      const list = buckets.get(key);
      if (list) list.push(point);
      else buckets.set(key, [point]);
    }

    return Array.from(buckets.entries()).map(([key, bucket]) => {
      const lng = bucket.reduce((sum, point) => sum + point.lng, 0) / bucket.length;
      const lat = bucket.reduce((sum, point) => sum + point.lat, 0) / bucket.length;
      return {
        id: `cluster-${key}`,
        lng,
        lat,
        size: bucket.length,
        points: bucket,
      };
    });
  }

  heatmap(points: MapPoint[], zoom: number): HeatmapCell[] {
    const buckets = this.cluster(points, zoom, 40);
    return buckets.map((cluster) => ({
      key: cluster.id,
      lng: cluster.lng,
      lat: cluster.lat,
      intensity: cluster.points.reduce((sum, point) => sum + (point.weight ?? 1), 0),
    }));
  }

  private cellSize(zoom: number, radius: number): number {
    const normalizedZoom = Math.max(1, zoom);
    return radius / normalizedZoom;
  }
}
