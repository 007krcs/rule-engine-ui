import { describe, expect, it, vi } from 'vitest';
import { ClusterEngine } from '../src/ClusterEngine';
import { computeBounds, parseGeoJSON } from '../src/GeoJSONParser';
import { RouteAnimator } from '../src/RouteAnimator';
import { VectorTileManager } from '../src/VectorTileManager';

describe('map-engine', () => {
  it('parses geojson and computes bounds', () => {
    const collection = parseGeoJSON({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [10, 20] },
          properties: {},
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [15, 25] },
          properties: {},
        },
      ],
    });

    const bounds = computeBounds(collection);
    expect(collection.features.length).toBe(2);
    expect(bounds).toEqual([10, 20, 15, 25]);
  });

  it('clusters points and creates heatmap cells', () => {
    const engine = new ClusterEngine();
    const points = [
      { id: 'a', lng: 0, lat: 0 },
      { id: 'b', lng: 0.1, lat: 0.1, weight: 2 },
      { id: 'c', lng: 120, lat: 120 },
    ];
    const clusters = engine.cluster(points, 4);
    const heatmap = engine.heatmap(points, 4);
    expect(clusters.length).toBeGreaterThan(1);
    expect(heatmap.length).toBeGreaterThan(1);
  });

  it('integrates with DataSourceAdapter', async () => {
    const adapter = {
      connect: vi.fn(async () => undefined),
      fetch: vi.fn(async () => ({
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }, properties: {} },
        ],
      })),
      subscribe: vi.fn(),
    };
    const manager = new VectorTileManager(adapter);

    await manager.connect();
    const geojson = await manager.ingestGeoJSON({ key: 'map.geojson' });
    const tile = await manager.loadVectorTile({ z: 1, x: 2, y: 3 });
    manager.switchProjection('globe');
    manager.subscribe('tiles', () => undefined);

    expect(adapter.connect).toHaveBeenCalled();
    expect(adapter.fetch).toHaveBeenCalledTimes(2);
    expect(geojson.features.length).toBe(1);
    expect(tile).toBeTruthy();
    expect(manager.getProjection()).toBe('globe');
    expect(adapter.subscribe).toHaveBeenCalled();
  });

  it('animates route frames', async () => {
    const animator = new RouteAnimator();
    const onFrame = vi.fn();
    const original = globalThis.requestAnimationFrame;
    const originalCancel = globalThis.cancelAnimationFrame;
    let time = 0;
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number =>
      globalThis.setTimeout(() => {
        time += 500;
        cb(time);
      }, 0) as unknown as number;
    globalThis.cancelAnimationFrame = (id: number) => globalThis.clearTimeout(id);

    const controller = animator.animate(
      [
        { lng: 0, lat: 0 },
        { lng: 10, lat: 10 },
      ],
      { speed: 1.5, onFrame },
    );
    controller.start();

    await new Promise((resolve) => globalThis.setTimeout(resolve, 20));
    expect(onFrame).toHaveBeenCalled();
    controller.stop();
    globalThis.requestAnimationFrame = original;
    globalThis.cancelAnimationFrame = originalCancel;
  });
});
