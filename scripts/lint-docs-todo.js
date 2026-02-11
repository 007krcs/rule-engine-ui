const { execSync } = require('child_process');

const target = 'apps/ruleflow-web/src/content/docs';
const pattern = '\\bTODO\\b';

function fail(message, details) {
  console.error(message);
  if (details) console.error(details);
  process.exit(1);
}

function lintTodoTokens() {
  try {
    const output = execSync(`rg -n "${pattern}" ${target}`, { stdio: 'pipe' }).toString();
    if (output.trim().length > 0) {
      fail('Doc lint failed: TODO tokens remain in docs content.', output.trim());
    }
  } catch (error) {
    if (error && typeof error.status === 'number' && error.status === 1) {
      return;
    }
    fail('Doc TODO lint failed to run. Ensure ripgrep is installed.', error);
  }
}

lintTodoTokens();
