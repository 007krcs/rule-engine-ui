import { describe, expect, it } from 'vitest';
import App from '../src/App';

describe('demo-host-react', () => {
  it('exports a React component', () => {
    expect(typeof App).toBe('function');
  });
});
