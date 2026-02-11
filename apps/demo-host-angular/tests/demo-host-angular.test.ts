import { describe, expect, it } from 'vitest';
import { mountRuleflowPage, runAngularDemo } from '../src/index';

describe('demo-host-angular', () => {
  it('renders demo html', async () => {
    const html = await runAngularDemo();
    expect(html).toContain('data-ui-page');
  });

  it('returns false for web component mount when DOM is unavailable', async () => {
    const mounted = await mountRuleflowPage();
    expect(mounted).toBe(false);
  });
});
