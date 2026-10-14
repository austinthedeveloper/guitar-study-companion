# Architecture

## Proposed system

```text
Angular (Nx) on Azure Static Web Apps
    | HTTPS / authenticated API calls
Azure Functions (Node.js + TypeScript; HTTP triggers)
    |-- Import / crop interpretation
    |-- Music analysis and deterministic transformations
    |-- AI orchestration and structured-output validation
    |-- Practice plans / library endpoints
    |-- Optional blob storage for source images
    +-- MongoDB Atlas (users, phrases, plans, sessions)
                 +-- External multimodal AI provider (server-side only)
```

## Why serverless

An always-on Express server is not necessary for this workload. Azure Functions can run request-driven HTTP endpoints, avoiding a continuously provisioned app server on a suitable consumption-based plan. **This does not guarantee zero cost:** execution, outbound networking, storage, AI tokens, and database tiers can still cost money. Verify current Azure plan, Static Web Apps integration limits, region, cold starts, and MongoDB network options before deployment.

## Suggested workspace layout

```text
apps/
  web/                 # Angular UI
  api/                 # Azure Functions handlers
libs/
  contracts/           # DTOs, schemas, shared validation
  music-domain/        # Pure music logic, transposition, fingerings
  ai-core/             # Provider adapter, prompts, output validation
  data-access/         # Mongo repositories, mapping
  ui/                  # Shared Angular components
fixtures/
  private/             # gitignored copyrighted test scans
  synthetic/           # safe-to-commit generated tab fixtures
infra/                 # Azure deployment definitions (later)
docs/
```

## Endpoint sketch (subject to refinement)

- `POST /api/imports/interpret` — interpret a selected image crop; return draft tab and uncertainties.
- `POST /api/phrases` — persist user-confirmed phrase.
- `GET /api/phrases/:id` — retrieve owned phrase.
- `POST /api/phrases/:id/analyze` — analyze in specified key/chord context.
- `POST /api/phrases/:id/practice-plans` — create a practice plan.
- `POST /api/phrases/:id/transform` — transpose or generate controlled variations.
- `GET /api/library` — list/search owned phrases.
- `POST /api/practice-sessions` — save progress.

## Responsibilities

**Frontend:** image selection/cropping, transcription correction, fretboard/tablature visualization, exercise controls, progress.

**Functions:** input validation, auth, ownership checks, rate limits, orchestration, persistence, and AI requests. Never expose AI or database credentials in Angular.

**Music-domain library:** deterministic pitch calculation, interval math, key transposition, fretboard mapping, note-range checks. Use AI for explanation and suggestion, not arithmetic that can be verified in code.

**AI layer:** vision-based draft transcription, pedagogical explanations, exercise suggestions, constrained variations. Use strict schemas and reject invalid outputs.

## Storage and privacy

- Keep images local/in memory where possible during early development.
- If uploading to storage, use private blobs, short retention by default, and explicit deletion controls.
- Store normalized phrases and user notes in MongoDB; avoid storing entire copyrighted books.
- Never include real copyrighted page images in a public repository or CI fixtures.
- Obtain user permission before submitting images to external AI providers; document provider retention behavior.
- Add authentication before any multi-user hosted release. Enforce authorization on every resource ID.

## Cost controls

- Limit image size, crop dimensions, passage length, and requests per user.
- Prefer one interpretation per crop; cache by a content hash where appropriate and privacy-safe.
- Use deterministic processing for transformations and repeated analysis.
- Record token usage, estimated AI spend, error rates, and processing latency.
- Support a manual-entry fallback if vision is too expensive or unreliable.
- Avoid scheduled compute and always-on servers for MVP.

## Deployment guidance

Start locally, then deploy Angular to Azure Static Web Apps and HTTP functions using a supported Functions hosting/deployment configuration. Keep MongoDB Atlas connection strings in managed environment secrets. Confirm Azure Functions runtime/Nx build compatibility with a minimal deployed spike in M0; do not assume a specific plugin combination works without verification.
