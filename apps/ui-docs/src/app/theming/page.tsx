export default function ThemingPage() {
  return (
    <div className="docs-section">
      <section className="docs-hero">
        <h1>Theme Customization</h1>
        <p>
          Platform UI Kit uses CSS variables as the runtime contract. Tenants can apply white-label
          overrides without rebuilding component code.
        </p>
      </section>

      <section className="docs-panel">
        <h2>Dark Mode</h2>
        <p>
          Set <code>data-theme=&quot;dark&quot;</code> on <code>html</code>, <code>:root</code>, or a themed
          container. Core tokens switch via cascade layers without touching component classes.
        </p>
        <pre className="docs-code">{`<html data-theme="dark">...</html>`}</pre>
      </section>

      <section className="docs-panel">
        <h2>Density</h2>
        <p>
          Control compactness with <code>data-density</code>. Components read height/padding from density-aware
          variables.
        </p>
        <pre className="docs-code">{`<div data-density="compact">...</div>`}</pre>
      </section>

      <section className="docs-panel">
        <h2>RTL Readiness</h2>
        <p>
          Components use logical properties (for example <code>padding-inline</code>,{' '}
          <code>inset-inline-start</code>). Apply <code>dir=&quot;rtl&quot;</code> at container or document
          level.
        </p>
      </section>

      <section className="docs-panel">
        <h2>CSS Variable Overrides</h2>
        <p>
          Override any token variable directly. This is the preferred path for tenant theming from API payloads.
        </p>
        <pre className="docs-code">{`:root {\n  --pf-color-primary-500: #0052cc;\n  --pf-radius-md: 0.5rem;\n}`}</pre>
      </section>

      <section className="docs-panel">
        <h2>Component Style Overrides Pattern</h2>
        <p>
          Keep overrides in the <code>@layer overrides</code> layer so base/component layers remain stable and
          predictable.
        </p>
        <pre className="docs-code">{`@layer overrides {\n  .pf-button--contained.pf-button--primary {\n    letter-spacing: 0.01em;\n  }\n}`}</pre>
      </section>
    </div>
  );
}
