import type { DeclarativePlugin, RendererRegistration } from '@platform/plugin-sdk';

const reactRenderer: RendererRegistration = {
  id: 'renderer.react',
  name: 'React Renderer',
  framework: 'react',
  render: ({ mount, componentType }) => {
    mount.innerHTML = `<div style="padding:12px; font-family: Segoe UI, sans-serif;">React renderer placeholder for ${componentType ?? 'component'}.</div>`;
  },
  unmount: (mount) => {
    mount.innerHTML = '';
  },
};

const angularRenderer: RendererRegistration = {
  id: 'renderer.angular',
  name: 'Angular Renderer',
  framework: 'angular',
  render: ({ mount, componentType }) => {
    mount.innerHTML = `<div style="padding:12px; font-family: Segoe UI, sans-serif;">Angular renderer placeholder for ${componentType ?? 'component'}.</div>`;
  },
  unmount: (mount) => {
    mount.innerHTML = '';
  },
};

const vueRenderer: RendererRegistration = {
  id: 'renderer.vue',
  name: 'Vue Renderer',
  framework: 'vue',
  render: ({ mount, componentType }) => {
    mount.innerHTML = `<div style="padding:12px; font-family: Segoe UI, sans-serif;">Vue renderer placeholder for ${componentType ?? 'component'}.</div>`;
  },
  unmount: (mount) => {
    mount.innerHTML = '';
  },
};

export const rendererPlugins: DeclarativePlugin[] = [
  {
    meta: {
      id: 'platform.renderers',
      name: 'Renderer Pack',
      version: '0.1.0',
      apiVersion: '1.0.0',
      description: 'Registers renderers for multiple UI frameworks.',
    },
    renderers: [reactRenderer, angularRenderer, vueRenderer],
  },
];
