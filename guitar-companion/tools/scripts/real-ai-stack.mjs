// Local API against a real AI provider with a throwaway database, for
// trying prompts or plans on real models. Costs money per AI call.
// Usage: npm run dev:real-ai [-- --provider openai|claude] [--port 27999]
// Ctrl-C stops the API and the database. The API does NOT reload on code
// changes: restart this after editing anything under packages/api or shared.
import { execSync, spawn } from 'node:child_process';
import { MongoMemoryServer } from 'mongodb-memory-server';

const args = process.argv.slice(2);
const flag = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const provider = flag('--provider', 'openai');
const port = Number(flag('--port', '27999'));

const mongo = await MongoMemoryServer.create({ instance: { port } });
const uri = mongo.getUri();
console.log(`[real-ai] MongoDB (throwaway): ${uri}`);
console.log(`[real-ai] AI_PROVIDER=${provider}; API at http://127.0.0.1:7071`);

// Own process group, so stopping it also stops the Functions host it spawns.
const api = spawn('npx', ['nx', 'serve', 'api'], {
  stdio: 'inherit',
  detached: true,
  env: { ...process.env, AI_PROVIDER: provider, MONGODB_URI: uri },
});

let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  try {
    process.kill(-api.pid, 'SIGTERM');
  } catch {
    // Already gone.
  }
  // Nx starts the Functions host in its own group; stop whatever holds the port.
  try {
    execSync('lsof -ti tcp:7071 -sTCP:LISTEN | xargs kill', {
      stdio: 'ignore',
    });
  } catch {
    // Nothing listening.
  }
  await mongo.stop();
  process.exit(code);
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
api.on('exit', (code) => stop(code ?? 0));
