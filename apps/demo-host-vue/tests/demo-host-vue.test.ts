import { describe, expect, it } from 'vitest';
import { runVueDemo } from '../src/index';

describe('demo-host-vue', () => {
  it('renders demo html', async () => {
    const html = await runVueDemo();
    expect(html).toContain('data-ui-page');
  });
});
