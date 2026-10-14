// Starts the full e2e stack against production builds:
//   ephemeral MongoDB -> Azure Functions host (fake AI, E2E_MODE) -> SWA CLI
// SWA serves the built web app and proxies /api, mirroring Azure routing.
// Expects `nx run-many -t build -p web api` to have run (the e2e target depends on it).
import { spawn } from 'node:child_process';
import { MongoMemoryServer } from 'mongodb-memory-server';

const API_PORT = Number(process.env.E2E_API_PORT ?? 7071);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 4280);
const children = [];

function run(name, cmd, args, env = {}) {
  const child = spawn(cmd, args, {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const prefix = (chunk) =>
    chunk
      .toString()
      .split('\n')
      .filter(Boolean)
      .map((l) => `[${name}] ${l}`)
      .join('\n') + '\n';
  child.stdout.on('data', (d) => process.stdout.write(prefix(d)));
  child.stderr.on('data', (d) => process.stderr.write(prefix(d)));
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`[e2e-stack] ${name} exited unexpectedly (${code})`);
      shutdown(1);
    }
  });
  children.push(child);
  return child;
}

let shuttingDown = false;
let mongo;
async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) c.kill('SIGTERM');
  await mongo?.stop().catch(() => undefined);
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

mongo = await MongoMemoryServer.create();
const apiEnv = {
  APP_VERSION: 'e2e',
  AI_PROVIDER: 'fake',
  MONGODB_URI: mongo.getUri(),
  MONGODB_DB: 'gsc-e2e',
  E2E_MODE: 'true',
  AI_TIMEOUT_MS: '3000',
};
console.log(`[e2e-stack] mongo at ${mongo.getUri()}`);

await new Promise((resolve, reject) => {
  const w = spawn(
    'node',
    ['tools/scripts/write-local-settings.mjs', 'dist/apps/api'],
    {
      env: { ...process.env, ...apiEnv },
      stdio: 'inherit',
    },
  );
  w.on('exit', (code) =>
    code === 0 ? resolve() : reject(new Error('write-local-settings failed')),
  );
});

run(
  'api',
  'npx',
  [
    'func',
    'start',
    '--script-root',
    'dist/apps/api',
    '--port',
    String(API_PORT),
  ],
  apiEnv,
);
run('swa', 'npx', [
  'swa',
  'start',
  'dist/apps/web/browser',
  '--api-devserver-url',
  `http://localhost:${API_PORT}`,
  '--port',
  String(WEB_PORT),
  '--swa-config-location',
  'dist/apps/web/browser',
]);
