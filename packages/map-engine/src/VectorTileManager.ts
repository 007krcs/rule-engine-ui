import type { DataSourceAdapter } from '@platform/runtime';
import { ClusterEngine, type Cluster, type HeatmapCell, type MapPoint } from './ClusterEngine';
import { parseGeoJSON, type GeoJsonFeatureCollection } from './GeoJSONParser';

export type ProjectionMode = 'mercator' | 'globe';

export interface VectorTileQuery {
  z: number;
  x: number;
  y: number;
}

export interface MapLayerConfig {
  id: string;
  type: 'vector' | 'geojson' | 'heatmap' | 'route';
  source: string;
  visible?: boolean;
  style?: Record<string, unknown>;
}

export class VectorTileManager {
  private projection: ProjectionMode = 'mercator';
  private readonly clusterEngine = new ClusterEngine();

  constructor(private readonly dataSource: DataSourceAdapter) {}

  async connect(): Promise<void> {
    await this.dataSource.connect();
  }

  switchProjection(mode: ProjectionMode): ProjectionMode {
    this.projection = mode;
    return this.projection;
  }

  getProjection(): ProjectionMode {
    return this.projection;
  }

  async loadVectorTile(query: VectorTileQuery): Promise<unknown> {
    return this.dataSource.fetch({
      kind: 'vectorTile',
      z: query.z,
      x: query.x,
      y: query.y,
    });
  }

  async ingestGeoJSON(query: unknown): Promise<GeoJsonFeatureCollection> {
    const payload = await this.dataSource.fetch(query);
    if (typeof payload !== 'string' && (!payload || typeof payload !== 'object')) {
      throw new Error('DataSourceAdapter returned invalid GeoJSON payload.');
    }
    return parseGeoJSON(payload as string | GeoJsonFeatureCollection);
  }

  buildClusters(points: MapPoint[], zoom: number, radius?: number): Cluster[] {
    return this.clusterEngine.cluster(points, zoom, radius);
  }

  buildHeatmap(points: MapPoint[], zoom: number): HeatmapCell[] {
    return this.clusterEngine.heatmap(points, zoom);
  }

  subscribe(topic: string, handler: Function): void {
    this.dataSource.subscribe?.(topic, handler);
  }
}
