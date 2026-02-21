import { eventBus } from '@platform/runtime';

export type CrossFilterPayload = {
  sourceChartId: string;
  field: string;
  value: string | number;
};

export class CrossFilterEngine {
  apply(payload: CrossFilterPayload): void {
    eventBus.publish('filterChanged', {
      componentId: payload.sourceChartId,
      field: payload.field,
      value: payload.value,
    });
    eventBus.publish('chart.crossFilter', payload);
  }
}
