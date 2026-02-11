const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const pattern = 'TODO screenshot';
const target = 'apps/ruleflow-web/src/content/docs';

function fail(message, details) {
  console.error(message);
  if (details) {
    console.error(details);
  }
  process.exit(1);
}

function lintTodoScreenshots() {
  try {
    const output = execSync(`rg -n "${pattern}" ${target}`, { stdio: 'pipe' }).toString();
    if (output.trim().length > 0) {
      fail('Doc lint failed: TODO screenshot placeholders remain.', output.trim());
    }
  } catch (error) {
    if (error && typeof error.status === 'number' && error.status === 1) {
      return;
    }
    fail('Doc lint failed to run. Ensure ripgrep is installed.', error);
  }
}

function lintDemoAdapters() {
  const demoPackages = [
    '@platform/react-aggrid-adapter',
    '@platform/react-highcharts-adapter',
    'registerAgGridAdapter',
    'registerHighchartsAdapter',
  ];
  const docFiles = fs
    .readdirSync(target)
    .filter((name) => name.endsWith('.mdx'))
    .map((name) => path.join(target, name));

  const violations = [];
  for (const filePath of docFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (!demoPackages.some((token) => line.includes(token))) return;
      const start = Math.max(0, idx - 3);
      const end = Math.min(lines.length - 1, idx + 3);
      const windowText = lines.slice(start, end + 1).join(' ').toLowerCase();
      if (!windowText.includes('demo')) {
        violations.push(`${filePath}:${idx + 1} ${line.trim()}`);
      }
    });
  }

  if (violations.length > 0) {
    fail(
      'Doc lint failed: demo adapter packages must be labeled as demo near their usage.',
      violations.join('\n'),
    );
  }
}

lintTodoScreenshots();
lintDemoAdapters();
