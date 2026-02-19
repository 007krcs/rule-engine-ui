export type RendererFramework = 'react' | 'angular' | 'vue';

export interface RendererAdapter {
  framework: RendererFramework;
  packageName: string;
  displayName: string;
}

const defaultAdapters: RendererAdapter[] = [
  {
    framework: 'react',
    packageName: '@platform/react-renderer',
    displayName: 'React Renderer',
  },
  {
    framework: 'angular',
    packageName: '@platform/angular-renderer',
    displayName: 'Angular Renderer',
  },
  {
    framework: 'vue',
    packageName: '@platform/vue-renderer',
    displayName: 'Vue Renderer',
  },
];

export function listRendererAdapters(): RendererAdapter[] {
  return defaultAdapters.map((adapter) => ({ ...adapter }));
}

export function getRendererAdapter(framework: RendererFramework): RendererAdapter | undefined {
  return defaultAdapters.find((adapter) => adapter.framework === framework);
}
