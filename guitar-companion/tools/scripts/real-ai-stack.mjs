// Local API against a real AI provider, for trying prompts or plans on real
// models or previewing the app before deploying. Costs money per AI call.
// Usage: npm run dev:real-ai [-- --provider openai|claude] [--port 27999]
//          [--web] [--data <dir>] [--vault <name>]
//   --web   also serves the Angular app on :4200 (proxies /api)
//   --data  keeps the database in <dir> across runs (default: throwaway)
//   --vault Key Vault to read OPENAI-API-KEY from (default: kv-gsc-fjn7)
// npm run dev:openai is the full app with OpenAI and a kept database.
// The OpenAI key comes from the shell env, else the vault (via `az`), else
// .env. Ctrl-C stops everything. The API does NOT reload on code changes:
// restart this after editing anything under packages/api or shared.
import { execFileSync, execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { MongoMemoryServer } from 'mongodb-memory-server';

const args = process.argv.slice(2);
const flag = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const provider = flag('--provider', 'openai');
const port = Number(flag('--port', '27999'));
const dataDir = flag('--data', undefined);
const vault = flag('--vault', 'kv-gsc-fjn7');
const withWeb = args.includes('--web');

const dotenv = existsSync('.env') ? readFileSync('.env', 'utf8') : '';
const inDotenv = (key) =>
  new RegExp(`^\\s*${key}\\s*=\\s*\\S`, 'm').test(dotenv);

const aiEnv = { AI_PROVIDER: provider };
if (provider === 'openai') {
  if (!process.env.OPENAI_API_KEY) {
    try {
      aiEnv.OPENAI_API_KEY = execFileSync(
        'az',
        [
          'keyvault',
          'secret',
          'show',
          '--vault-name',
          vault,
          '-n',
          'OPENAI-API-KEY',
          '--query',
          'value',
          '-o',
          'tsv',
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
      ).trim();
      console.log(`[real-ai] OPENAI_API_KEY from Key Vault ${vault}`);
    } catch {
      if (!inDotenv('OPENAI_API_KEY')) {
        console.error(
          `[real-ai] No OpenAI key: run \`az login\` (Key Vault ${vault}) or set OPENAI_API_KEY in .env.`,
        );
        process.exit(1);
      }
      console.log('[real-ai] Key Vault unavailable; OPENAI_API_KEY from .env');
    }
  }
  // The model the beta uses, unless the shell or .env names another.
  if (!process.env.OPENAI_MODEL && !inDotenv('OPENAI_MODEL'))
    aiEnv.OPENAI_MODEL = 'gpt-6-luna';
}

if (dataDir) mkdirSync(dataDir, { recursive: true });
const mongo = await MongoMemoryServer.create({
  instance: dataDir
    ? { port, dbPath: dataDir, storageEngine: 'wiredTiger' }
    : { port },
});
const uri = mongo.getUri();
console.log(
  `[real-ai] MongoDB (${dataDir ? `kept in ${dataDir}` : 'throwaway'}): ${uri}`,
);
console.log(`[real-ai] AI_PROVIDER=${provider}; API at http://127.0.0.1:7071`);
if (withWeb) console.log('[real-ai] App at http://localhost:4200');

const env = { ...process.env, ...aiEnv, MONGODB_URI: uri };
// Own process groups, so stopping them also stops what they spawn.
const children = [
  spawn('npx', ['nx', 'serve', 'api'], {
    stdio: 'inherit',
    detached: true,
    env,
  }),
];
if (withWeb)
  children.push(
    spawn('npx', ['nx', 'serve', 'web'], {
      stdio: 'inherit',
      detached: true,
      env,
    }),
  );

let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      // Already gone.
    }
  }
  // Nx starts the Functions host in its own group; stop whatever holds the port.
  try {
    execSync('lsof -ti tcp:7071 -sTCP:LISTEN | xargs kill', {
      stdio: 'ignore',
    });
  } catch {
    // Nothing listening.
  }
  // Keeps the files in dataDir; only a throwaway database is deleted.
  await mongo.stop({ doCleanup: !dataDir });
  process.exit(code);
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
for (const child of children) child.on('exit', (code) => stop(code ?? 0));
