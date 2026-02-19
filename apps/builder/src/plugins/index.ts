import { myCompanyPlugin } from './my-company-plugin';
import { rendererPlugins } from './renderer-plugins';

export const builderPlugins = [myCompanyPlugin, ...rendererPlugins];
