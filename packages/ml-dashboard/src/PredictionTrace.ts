export type ExplanationMode = 'local' | 'global';

export interface PredictionRecord {
  predictionId: string;
  modelId: string;
  timestamp: string;
  predicted: number;
  actual?: number;
  score?: number;
  protectedGroup?: string;
  features: Record<string, number>;
  contributions: Record<string, number>;
}

export interface BiasMetrics {
  groupPositiveRate: Record<string, number>;
  demographicParityGap: number;
  meanPredictionByGroup: Record<string, number>;
}

export class PredictionTrace {
  private readonly traces: PredictionRecord[] = [];

  add(record: PredictionRecord): void {
    this.traces.push(record);
  }

  list(modelId?: string): PredictionRecord[] {
    if (!modelId) return [...this.traces];
    return this.traces.filter((record) => record.modelId === modelId);
  }

  forPrediction(predictionId: string): PredictionRecord | undefined {
    return this.traces.find((record) => record.predictionId === predictionId);
  }

  biasMetrics(modelId: string): BiasMetrics {
    const traces = this.list(modelId).filter((record) => record.protectedGroup);
    const byGroup = new Map<string, PredictionRecord[]>();
    for (const trace of traces) {
      const key = trace.protectedGroup as string;
      const list = byGroup.get(key) ?? [];
      list.push(trace);
      byGroup.set(key, list);
    }

    const groupPositiveRate: Record<string, number> = {};
    const meanPredictionByGroup: Record<string, number> = {};
    for (const [group, records] of byGroup.entries()) {
      if (records.length === 0) continue;
      const positive = records.filter((record) => record.predicted >= 0.5).length;
      const mean = records.reduce((sum, record) => sum + record.predicted, 0) / records.length;
      groupPositiveRate[group] = positive / records.length;
      meanPredictionByGroup[group] = mean;
    }

    const rates = Object.values(groupPositiveRate);
    const demographicParityGap =
      rates.length <= 1 ? 0 : Math.max(...rates) - Math.min(...rates);

    return {
      groupPositiveRate,
      demographicParityGap,
      meanPredictionByGroup,
    };
  }
}
