// Generates local.settings.json for the Functions host from the workspace
// .env file plus the current process env, so .env is the single local source
// of settings. Usage: node tools/scripts/write-local-settings.mjs <scriptRoot>
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const scriptRoot = process.argv[2];
if (!scriptRoot)
  throw new Error('Usage: write-local-settings.mjs <scriptRoot>');

const KEYS = [
  'APP_VERSION',
  'AI_PROVIDER',
  'MONGODB_URI',
  'MONGODB_DB',
  'E2E_MODE',
];

const fromFile = {};
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) fromFile[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const values = { FUNCTIONS_WORKER_RUNTIME: 'node', AzureWebJobsStorage: '' };
for (const key of KEYS) {
  const value = process.env[key] ?? fromFile[key];
  if (value !== undefined && value !== '') values[key] = value;
}

writeFileSync(
  join(scriptRoot, 'local.settings.json'),
  JSON.stringify(
    { IsEncrypted: false, Values: values, Host: { CORS: '*' } },
    null,
    2,
  ),
);
