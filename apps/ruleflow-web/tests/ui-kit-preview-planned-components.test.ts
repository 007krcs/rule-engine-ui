import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ComponentDefinition } from '@platform/component-registry';
import { UiKitPreview } from '@/components/ui-kit/UiKitPreview';

type PreviewCase = {
  hint: string;
  expectedText: string;
  displayName: string;
  defaultProps: Record<string, unknown>;
};

const previewCases: PreviewCase[] = [
  {
    hint: 'platform.svgIcon',
    displayName: 'SvgIcon',
    expectedText: 'SVG Icon',
    defaultProps: { name: 'checkCircle', path: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2', size: 24, color: '#2e7d32' },
  },
  {
    hint: 'platform.imageList',
    displayName: 'ImageList',
    expectedText: 'Image List',
    defaultProps: { columns: 3, gap: 10, images: [{ src: 'https://picsum.photos/seed/ruleflow-1/360/220', alt: 'Server rack', title: 'Runtime cluster' }] },
  },
  { hint: 'platform.paper', displayName: 'Paper', expectedText: 'Paper Surface', defaultProps: { elevation: 1, outlined: true, padding: 16 } },
  {
    hint: 'platform.bottomNavigation',
    displayName: 'BottomNavigation',
    expectedText: 'Bottom Navigation',
    defaultProps: { value: 'home', items: [{ value: 'home', label: 'Home' }, { value: 'flows', label: 'Flows' }, { value: 'alerts', label: 'Alerts' }] },
  },
  {
    hint: 'platform.speedDial',
    displayName: 'SpeedDial',
    expectedText: 'Speed Dial',
    defaultProps: { actions: [{ id: 'new-rule', label: 'New Rule' }] },
  },
  { hint: 'platform.link', displayName: 'Link', expectedText: 'Open deployment runbook', defaultProps: { label: 'Open deployment runbook', href: '/docs/tutorial-builder' } },
  {
    hint: 'platform.masonry',
    displayName: 'Masonry',
    expectedText: 'Masonry',
    defaultProps: { columns: 2, gap: 12, items: [{ id: '1', title: 'Cluster health', description: '99.9% availability', height: 110 }] },
  },
  { hint: 'platform.noSsr', displayName: 'NoSSR', expectedText: 'NoSSR', defaultProps: { fallbackText: 'Loading client-only content...', contentText: 'Client metrics panel ready.' } },
  { hint: 'platform.portal', displayName: 'Portal', expectedText: 'Portal Demo', defaultProps: { target: '#overlay-root', title: 'Portal Demo', content: 'Overlay content rendered outside the layout tree.' } },
  { hint: 'platform.clickAwayListener', displayName: 'ClickAwayListener', expectedText: 'Click Away Listener', defaultProps: { message: 'Click outside the panel to dismiss.' } },
  { hint: 'platform.popper', displayName: 'Popper', expectedText: 'Popper', defaultProps: { open: true, placement: 'bottom', content: 'Contextual actions for selected row.' } },
  { hint: 'platform.transitionFade', displayName: 'TransitionFade', expectedText: 'Transition Fade', defaultProps: { in: true, durationMs: 240, label: 'Faded content block' } },
];

describe('ui-kit preview planned component upgrades', () => {
  it('renders upgraded components without planned placeholders', () => {
    previewCases.forEach(({ hint, displayName, expectedText, defaultProps }) => {
      const component = createComponent(hint, displayName, defaultProps);

      const html = renderToStaticMarkup(
        React.createElement(UiKitPreview, {
          component,
          values: defaultProps,
        }),
      );

      expect(html).toContain(expectedText);
      expect(html).not.toContain('not yet implemented in the platform UI kit');
      expect(html).not.toContain('is not configured yet');
    });
  });

  it('matches snapshots for upgraded component previews', () => {
    const snapshots = previewCases.map(({ hint, displayName, defaultProps }) => {
      const component = createComponent(hint, displayName, defaultProps);
      return {
        hint,
        html: renderToStaticMarkup(
          React.createElement(UiKitPreview, {
            component,
            values: defaultProps,
          }),
        ),
      };
    });
    expect(snapshots).toMatchSnapshot();
  });
});

function createComponent(hint: string, displayName: string, defaultProps: Record<string, unknown>): ComponentDefinition {
  return {
    id: hint,
    adapterHint: hint,
    displayName,
    description: `${displayName} preview definition`,
    category: 'Utils',
    propsSchema: { type: 'object' },
    defaultProps,
    availability: 'implemented',
    supportsDrag: true,
    status: 'beta',
  };
}
