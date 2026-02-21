import { promises as fs } from 'node:fs';
import { GovernanceSdk } from '../packages/governance-sdk/src/index';

type Command = 'evaluate-policy' | 'set-flag' | 'set-kill';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const sdk = new GovernanceSdk({
    baseUrl: args.baseUrl,
    headers: args.token ? { authorization: `Bearer ${args.token}` } : undefined,
  });

  if (args.command === 'evaluate-policy') {
    const payload = args.payloadPath ? JSON.parse(await fs.readFile(args.payloadPath, 'utf8')) : {};
    const result = await sdk.evaluatePolicy({
      stage: args.stage ?? 'save',
      currentBundle: payload.currentBundle,
      nextBundle: payload.nextBundle,
      metadata: payload.metadata,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (args.command === 'set-flag') {
    const result = await sdk.upsertFeatureFlag({
      env: args.env ?? 'prod',
      key: required(args.key, '--key is required for set-flag'),
      enabled: args.enabled === 'true',
      value: args.valuePath
        ? (JSON.parse(await fs.readFile(args.valuePath, 'utf8')) as Record<string, unknown>)
        : undefined,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  const result = await sdk.upsertKillSwitch({
    scope: (args.scope ?? 'TENANT') as 'TENANT' | 'RULESET' | 'VERSION' | 'COMPONENT',
    active: args.active !== 'false',
    packageId: args.packageId,
    versionId: args.versionId,
    componentId: args.componentId,
    reason: args.reason,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function parseArgs(argv: string[]) {
  const out: {
    command: Command;
    baseUrl: string;
    token?: string;
    stage?: 'save' | 'submit-for-review' | 'approve' | 'promote';
    env?: string;
    key?: string;
    enabled?: string;
    valuePath?: string;
    payloadPath?: string;
    scope?: string;
    active?: string;
    packageId?: string;
    versionId?: string;
    componentId?: string;
    reason?: string;
  } = {
    command: 'evaluate-policy',
    baseUrl: process.env.RULEFLOW_BASE_URL ?? 'http://localhost:3000',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key) continue;
    if (key === '--command') {
      out.command = (argv[i + 1] as Command) ?? out.command;
      i += 1;
      continue;
    }
    if (key === '--base-url') {
      out.baseUrl = argv[i + 1] ?? out.baseUrl;
      i += 1;
      continue;
    }
    if (key === '--token') {
      out.token = argv[i + 1];
      i += 1;
      continue;
    }
    if (key === '--stage') {
      out.stage = argv[i + 1] as 'save' | 'submit-for-review' | 'approve' | 'promote';
      i += 1;
      continue;
    }
    if (key === '--env') {
      out.env = argv[i + 1];
      i += 1;
      continue;
    }
    if (key === '--key') {
      out.key = argv[i + 1];
      i += 1;
      continue;
    }
    if (key === '--enabled') {
      out.enabled = argv[i + 1];
      i += 1;
      continue;
    }
    if (key === '--value') {
      out.valuePath = argv[i + 1];
      i += 1;
      continue;
    }
    if (key === '--payload') {
      out.payloadPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (key === '--scope') {
      out.scope = argv[i + 1];
      i += 1;
      continue;
    }
    if (key === '--active') {
      out.active = argv[i + 1];
      i += 1;
      continue;
    }
    if (key === '--package-id') {
      out.packageId = argv[i + 1];
      i += 1;
      continue;
    }
    if (key === '--version-id') {
      out.versionId = argv[i + 1];
      i += 1;
      continue;
    }
    if (key === '--component-id') {
      out.componentId = argv[i + 1];
      i += 1;
      continue;
    }
    if (key === '--reason') {
      out.reason = argv[i + 1];
      i += 1;
    }
  }

  return out;
}

function required(value: string | undefined, message: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error(message);
  }
  return value;
}

void main();
