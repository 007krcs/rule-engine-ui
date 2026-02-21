export interface ModelMetadata {
  id: string;
  name: string;
  version: string;
  owner?: string;
  description?: string;
  labels?: Record<string, string>;
}

export class ModelRegistry {
  private readonly models = new Map<string, ModelMetadata>();

  register(model: ModelMetadata): void {
    this.models.set(model.id, model);
  }

  get(modelId: string): ModelMetadata | undefined {
    return this.models.get(modelId);
  }

  list(): ModelMetadata[] {
    return Array.from(this.models.values());
  }
}
