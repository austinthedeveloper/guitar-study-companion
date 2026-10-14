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
| `npx nx test <project>` | Unit tests for one project (Vitest). |
| `npx nx graph` | Project dependency graph. |

Running a single e2e spec only warns about route coverage. CI, or `ROUTE_COVERAGE=1`, makes uncovered routes fail the run.

## Workspace layout

```text
apps/
  web/          thin Angular shell: routes + providers only
  web-e2e/      Playwright: pages/, journeys/, api/, support/
  api/          thin Azure Functions shell (v4 model): registers triggers that call @gsc/api/handlers
packages/
  shared/contracts      @gsc/contracts        zod schemas + DTOs + API paths
  shared/music-domain   @gsc/music-domain     pure music logic (pitch, intervals, transposition)
  api/ai-core           @gsc/api/ai-core      AI provider interface, registry, fake provider
  api/data-access       @gsc/api/data-access  MongoDB connection + repositories
  api/handlers          @gsc/api/handlers     endpoint logic, runtime-agnostic and unit-testable
  web/routes            @gsc/web/routes       route manifest (used by app + e2e coverage guard)
  web/ui                @gsc/web/ui           presentational components only (inputs/outputs, no services)
  web/data-access       @gsc/web/data-access  HTTP clients/state
  web/feature-*         @gsc/web/feature-*    routed pages that connect ui ↔ data-access
tools/
  e2e/start-stack.mjs             e2e stack launcher
  scripts/write-local-settings.mjs  .env → Functions local.settings.json
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
| `AI_MAX_OUTPUT_TOKENS` | provider default | Output token cap |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | *(empty)* | Required for `openai` (vision-capable model) |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | *(empty)* / `claude-opus-5-5` | Required for `claude` |
| `MONGODB_URI` | *(empty)* | Mongo connection string; empty means running without a DB |
| `MONGODB_DB` | `gsc` | Database name |
| `E2E_MODE` | `false` | Test-only seeding endpoints |

## Deployment approach (planned; not yet verified in Azure)

- **Web:** `nx build web` produces a static output in `dist/apps/web/browser`. It includes `staticwebapp.config.json` (SPA fallback, security headers, Node 22 API runtime).
- **API:** `nx build api` produces a single esbuild bundle in `dist/apps/api`: `main.js`, `host.json` and `package.json`, with `@azure/functions-core` supplied by the host. Deploy it as the Static Web App's **managed functions** for MVP, which gives a single resource, same-origin `/api`, and built-in auth. Move to a linked "bring your own" Function App only if we need features managed functions lack (non-HTTP triggers, longer timeouts, managed identity).
- **DB:** MongoDB Atlas, with network access restricted and the connection string in app settings.
- **Open:** a minimal deployed spike is still needed to confirm the bundle runs under SWA managed functions (see ARCHITECTURE.md).

## Estimated per-request cost drivers

From most to least expensive, typically:

1. **AI vision/LLM calls.** These dominate. Tokens scale with crop resolution and output size. Mitigations: crop and size limits, one interpretation per crop, content-hash caching, per-user caps, and the fake provider in dev and CI.
2. **Function executions:** execution time × memory, plus cold starts. Health and CRUD requests are cheap; AI orchestration requests are long-running.
3. **MongoDB Atlas:** a tier-based fixed cost (free M0 or shared tier for MVP). Per-request cost is negligible at this scale.
4. **Bandwidth and storage:** image uploads in request bodies, and blob storage only if images are retained.
5. **Static Web Apps:** the free tier for MVP. The Standard tier is needed for custom auth or a linked Function App.
