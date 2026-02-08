import { describe, expect, it } from 'vitest';
import { runAngularDemo } from '../src/index';

describe('demo-host-angular', () => {
  it('renders demo html', async () => {
    const html = await runAngularDemo();
    expect(html).toContain('data-ui-page');
  });
});
