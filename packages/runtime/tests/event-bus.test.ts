import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/event-bus/EventBus';

describe('event-bus', () => {
  it('publishes events to subscribed listeners', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.subscribe('filterChanged', handler);

    bus.publish('filterChanged', { field: 'status', value: 'active' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ field: 'status', value: 'active' });
  });

  it('does not call listener after unsubscribe', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.subscribe('filterChanged', handler);
    bus.unsubscribe('filterChanged', handler);

    bus.publish('filterChanged', { value: 'inactive' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('isolates listeners by event type', () => {
    const bus = new EventBus();
    const clicked = vi.fn();
    const changed = vi.fn();
    bus.subscribe('onDataPointClick', clicked);
    bus.subscribe('filterChanged', changed);

    bus.publish('onDataPointClick', { index: 2 });

    expect(clicked).toHaveBeenCalledTimes(1);
    expect(changed).not.toHaveBeenCalled();
  });
});
