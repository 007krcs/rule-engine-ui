import { createRoot } from 'react-dom/client';
import { registerMaterialAdapters } from '@platform/react-material-adapter';
import { registerAgGridAdapter } from '@platform/react-aggrid-adapter';
import { registerHighchartsAdapter } from '@platform/react-highcharts-adapter';
import { registerD3Adapter } from '@platform/react-d3-adapter';
import { registerCompanyAdapter } from '@platform/react-company-adapter';

import App from './App';

registerMaterialAdapters();
registerAgGridAdapter();
registerHighchartsAdapter();
registerD3Adapter();
registerCompanyAdapter();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}
