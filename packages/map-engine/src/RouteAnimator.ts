export interface RoutePoint {
  lng: number;
  lat: number;
}

export interface RouteAnimationController {
  start(): void;
  stop(): void;
}

export interface RouteAnimatorOptions {
  speed?: number;
  onFrame: (point: RoutePoint, progress: number) => void;
}

export class RouteAnimator {
  animate(points: RoutePoint[], options: RouteAnimatorOptions): RouteAnimationController {
    const speed = Math.max(0.1, options.speed ?? 1);
    let running = false;
    let frameId = 0;
    let startedAt = 0;
    const totalDuration = Math.max(1, (points.length - 1) * (1000 / speed));

    const tick = (timestamp: number) => {
      if (!running) return;
      if (startedAt === 0) startedAt = timestamp;
      const elapsed = timestamp - startedAt;
      const progress = Math.min(1, elapsed / totalDuration);
      const point = interpolate(points, progress);
      options.onFrame(point, progress);
      if (progress >= 1) {
        running = false;
        return;
      }
      frameId = requestFrame(tick);
    };

    return {
      start: () => {
        if (running || points.length === 0) return;
        running = true;
        startedAt = 0;
        frameId = requestFrame(tick);
      },
      stop: () => {
        running = false;
        cancelFrame(frameId);
      },
    };
  }
}

function interpolate(points: RoutePoint[], progress: number): RoutePoint {
  if (points.length === 0) return { lng: 0, lat: 0 };
  if (points.length === 1) return points[0] ?? { lng: 0, lat: 0 };
  const scaled = progress * (points.length - 1);
  const index = Math.floor(scaled);
  const nextIndex = Math.min(points.length - 1, index + 1);
  const local = scaled - index;
  const left = points[index] ?? points[0] ?? { lng: 0, lat: 0 };
  const right = points[nextIndex] ?? left;
  return {
    lng: left.lng + (right.lng - left.lng) * local,
    lat: left.lat + (right.lat - left.lat) * local,
  };
}

function requestFrame(cb: (time: number) => void): number {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    return globalThis.requestAnimationFrame(cb);
  }
  return globalThis.setTimeout(() => cb(Date.now()), 16) as unknown as number;
}

function cancelFrame(id: number): void {
  if (typeof globalThis.cancelAnimationFrame === 'function') {
    globalThis.cancelAnimationFrame(id);
    return;
  }
  globalThis.clearTimeout(id);
}
