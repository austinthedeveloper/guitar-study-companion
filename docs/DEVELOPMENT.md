# Development

The Nx workspace lives in [`guitar-companion/`](../guitar-companion). Run all commands from there.

## Prerequisites

- Node 22 (`nvm use`; pinned in `.nvmrc`). Angular 22 requires `^22.22.3`.
- `npm ci`. This also installs Azure Functions Core Tools and the SWA CLI as dev dependencies, so global installs are optional.
- `npx playwright install chromium` for e2e (`npx playwright install` for all browsers).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | **One-command local start.** Runs the Functions API on :7071 and the Angular dev server on :4200, which proxies `/api`. |
| `npm run e2e` | Whole-site e2e on Chromium against production builds and the full stack (ephemeral Mongo + Functions + SWA CLI on :4280). |
| `npm run e2e:all-browsers` | The same suite on Chromium, Firefox, and WebKit. |
| `npm run e2e:ui` | Playwright UI mode. |
| `npm run verify` | Everything CI runs: format check, lint, unit tests, typecheck, build, e2e. |
| `npm run dev:real-ai` | The API against a real AI provider (`-- --provider openai\|claude\|fake`) with a throwaway MongoDB on :27999. Costs money per AI call. It doesn't reload on code changes, so restart it after editing API or shared code. |
| `node tools/fixtures/phrase-from-fixture.mts <case>` | Saves a private verified fixture as a phrase on the running API and prints its id. |
| `node tools/fixtures/eval-private.mts` | Scores AI recognition against private fixtures (see DECISIONS.md for past results). |
| `npx nx test <project>` | Unit tests for one project (Vitest). |
| `npx nx graph` | Project dependency graph. |

Running a single e2e spec only warns about route coverage. CI, or `ROUTE_COVERAGE=1`, makes uncovered routes fail the run.

### Nx daemon is off

`nx.json` sets `"useDaemonProcess": false`. With the daemon on, project-graph creation failed on about every other run with `ERR_REQUIRE_ESM` for `listr2` (required by `@angular/build`, which the Angular Vite plugin loads while Nx reads `vite.config.mts`). With the daemon off, it passed every time, at a cost of about 1.6 s per graph. CI never used the daemon, which is why only local runs failed. Re-check this before turning the daemon back on after an Nx or Angular upgrade.

## Workspace layout

```text
apps/
  web/          thin Angular shell: routes + providers only
  web-e2e/      Playwright: pages/, journeys/, api/, support/
  api/          thin Azure Functions shell (v4 model): registers triggers that call @gsc/api/handlers
packages/
  shared/contracts      @gsc/contracts        zod schemas + DTOs + API paths
  shared/music-domain   @gsc/music-domain     pure music logic: pitch, spelling, intervals, chords, roles, scales, practice plans
  api/ai-core           @gsc/api/ai-core      AI provider interface, registry, fake provider
  api/data-access       @gsc/api/data-access  MongoDB connection + repositories
  api/handlers          @gsc/api/handlers     endpoint logic, runtime-agnostic and unit-testable
  web/routes            @gsc/web/routes       route manifest (used by app + e2e coverage guard)
  web/ui                @gsc/web/ui           presentational components only (inputs/outputs, no services)
  web/audio             @gsc/web/audio        playback: plucked-string synth, metronome, MIDI export/out
  web/data-access       @gsc/web/data-access  HTTP clients/state
  web/feature-*         @gsc/web/feature-*    routed pages that connect ui ↔ data-access
tools/
  e2e/start-stack.mjs             e2e stack launcher
  scripts/write-local-settings.mjs  .env → Functions local.settings.json
  scripts/real-ai-stack.mjs         npm run dev:real-ai
  fixtures/eval-private.mts         recognition accuracy on private fixtures
  fixtures/phrase-from-fixture.mts  private fixture → saved phrase
fixtures/
  synthetic/   safe to commit, used in CI
  private/     gitignored real book scans
```

Module boundaries are enforced by lint (`eslint.config.mjs`):
- `scope:web` and `scope:api` may only use their own scope plus `scope:shared`.
- `type:ui` may not depend on `data-access` or `feature` libraries.
- `type:util` depends only on other `type:util` libraries.

## Environment variables and secrets policy

- `.env.example` documents every setting. Copy it to `.env` (gitignored) for local use.
- The API reads settings from `local.settings.json`, which is **generated** from `.env` by `nx serve api`. Never edit or commit that file.
- Deployed values live in Azure app settings: Static Web Apps → Environment variables, or the Function App's configuration. Use Key Vault references for secrets such as `MONGODB_URI` and AI provider keys.
- AI provider keys and database credentials exist **only** on the API side. The Angular app has no secrets and calls only `/api`.
- `E2E_MODE=true` enables test-only endpoints. It must never be set in a deployed environment.
- Never commit real values, raw scan images, or provider responses that contain page content.

| Variable | Default | Purpose |
|---|---|---|
| `APP_VERSION` | `dev` | Version reported by `/api/health` |
| `AI_PROVIDER` | `fake` | `fake`, `openai`, or `claude` |
| `AI_TIMEOUT_MS` | `60000` | Recognition request timeout |
| `AI_DAILY_REQUESTS` | `50` | Per-user AI requests per UTC day; then recognition and explanations return 429 and plans skip AI tips |
| `AI_DAILY_TOKENS` | `300000` | Per-user AI tokens (input + output) per UTC day |
| `AI_PASSES` | `2` | Parallel readings per image; disagreements are flagged for review (cost scales with this) |
| `AI_MAX_OUTPUT_TOKENS` | provider default | Output token cap |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | *(empty)* | Required for `openai` (vision-capable model) |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | *(empty)* / `claude-opus-5-5` | Required for `claude` |
| `MONGODB_URI` | *(empty)* | Mongo connection string; empty means running without a DB |
| `MONGODB_DB` | `gsc` | Database name |
| `E2E_MODE` | `false` | Test-only seeding endpoints |

## Deployment approach (ADR-013; not yet deployed)

Everything runs in Azure. The owner's choice is Blob Storage for the site; the rest are recommendations.

| Piece | Service | Notes |
|---|---|---|
| Web | Storage account **static website** (`$web` container) | Upload `dist/apps/web/browser`. Set the index and error documents to `index.html` so deep links load the app (they return 404 status with the app, which browsers handle). The default `https://<account>.z??.web.core.windows.net` endpoint already has HTTPS, which is enough for the private beta. A custom domain with HTTPS needs **Azure Front Door** (Standard) in front, which also returns a clean 200 for deep links. Add it when a domain is wanted. |
| API | **Function App, Flex Consumption**, Linux, Node 22 | Deploy the `dist/apps/api` bundle. Microsoft recommends Flex Consumption for new apps, with a monthly free grant per subscription. Set **CORS** to the site's origin only. Use a system-assigned **managed identity**. |
| Secrets | **Key Vault** | OpenAI and Anthropic keys and the database connection string, referenced from app settings (`@Microsoft.KeyVault(...)`), never in code or the web bundle. |
| Database | **Azure Cosmos DB for MongoDB (vCore)** | Our MongoDB driver code works unchanged. The free tier (32 GB, one per subscription, limited regions) is enough for the beta, but **has no backups or high availability**. Either accept that for the beta and export data periodically, or start on the smallest paid tier. |
| Logs | **Application Insights** | Set `APPLICATIONINSIGHTS_CONNECTION_STRING` on the Function App. |
| Sign-in | **Microsoft Entra External ID** (ADR-014) | |

**Web → API address:** the site and API are on different origins, so the web app reads `config.json` at startup (`{ "apiBaseUrl": "https://<func>.azurewebsites.net" }`). Locally and in e2e there is no `config.json`, so the app keeps calling relative `/api` paths through the dev proxy or SWA CLI.

**Owner steps, before the first deploy:** create a resource group in one region where the Cosmos vCore free tier is available. In it, create the storage account (static website on), the Function App (Flex Consumption, Node 22), Key Vault, App Insights, and the Cosmos vCore cluster. Then give the Function App's identity "Key Vault Secrets User" on the vault. I'll then write the GitHub Actions deploy workflow (OIDC federated credentials, no stored secrets) and a deployed smoke suite.

## Observability and failure handling

- **Logs:** handlers log structured events with counts and token usage only, never images or musical content (`interpret.ok`, `explain.ok`, `coach.ok`, `coach.skipped`, `*.ai_error`). The Functions host sends them to Application Insights once the Function App has `APPLICATIONINSIGHTS_CONNECTION_STRING` set (a deployment setting; nothing to change in code).
- **Unexpected errors** return a generic 500 with `errorId`, the first 8 characters of the Functions invocation id. The UI shows it as "Reference: …", and the same id is in the `unhandled` log entry, which Application Insights indexes by invocation id.
- **Retries:** the web client retries GETs up to twice (300 ms, then 900 ms) on network errors and 502/503/504. Writes and AI requests are never retried automatically. AI SDK clients make one retry of their own (`maxRetries: 1`).
- **AI allowance:** per user per UTC day, `AI_DAILY_REQUESTS` (default 50; a 2-pass recognition counts 2) and `AI_DAILY_TOKENS` (default 300k). Over the limit, recognition and explanations return 429 `rate_limited`, and practice plans are still built but without AI tips. Counters are in the `aiUsage` collection, or in memory without a database.

## Estimated per-request cost drivers

From most to least expensive, typically:

1. **AI vision/LLM calls.** These dominate. Tokens scale with crop resolution and output size. Mitigations: crop and size limits, one interpretation per crop, content-hash caching, per-user caps, and the fake provider in dev and CI.
2. **Function executions:** execution time × memory, plus cold starts. Health and CRUD requests are cheap; AI orchestration requests are long-running.
3. **MongoDB Atlas:** a tier-based fixed cost (free M0 or shared tier for MVP). Per-request cost is negligible at this scale.
4. **Bandwidth and storage:** image uploads in request bodies, and blob storage only if images are retained.
5. **Static Web Apps:** the free tier for MVP. The Standard tier is needed for custom auth or a linked Function App.
