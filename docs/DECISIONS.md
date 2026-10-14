# Architecture Decision Records

Record consequential choices here. Status values: `Proposed`, `Accepted`, `Superseded`.

## ADR-001 — Angular + Nx monorepo

**Status:** Accepted

**Decision:** Use Angular for the web UI and Nx for applications/shared libraries.

**Why:** Familiarity enables faster debugging and correction, while Nx supports reusable contracts and music logic.

**Tradeoff:** Tooling/build integration for Azure Functions needs a proof-of-concept.

## ADR-002 — Azure Functions rather than an always-on API server

**Status:** Accepted

**Decision:** Use Node.js/TypeScript HTTP-triggered Azure Functions for API endpoints.

**Why:** Request-driven workloads and low idle infrastructure overhead.

**Tradeoff:** Cold starts, request duration, deployment complexity, and plan-specific billing. If analysis becomes long-running, consider queue-triggered processing rather than keeping an HTTP request open.

## ADR-003 — MongoDB Atlas

**Status:** Proposed

**Decision:** Store users, phrases, analyses, practice plans, and progress in MongoDB Atlas.

**Why:** Flexible nested document structures fit evolving music models.

**Tradeoff:** Cost, indexes, connection management, and network security need attention.

## ADR-004 — Supplied images before camera scanning

**Status:** Proposed

**Decision:** Test with uploaded images of existing tab-book pages. Defer native camera capture.

**Why:** Validates the core learning product before investing in capture UX.

## ADR-005 — Verified structured music as source of truth

**Status:** Proposed

**Decision:** Recognition produces an editable draft; only confirmed musical events drive deterministic transforms.

**Why:** Prevents cascading hallucinations from recognition into analysis and exercises.

## ADR-006 — AI provider abstraction

**Status:** Accepted

**Decision:** Define provider-neutral `interpretImage`, `explainPhrase`, and `proposeExercises` interfaces with schema validation.

**Why:** Enables model comparison and cost control without rewriting product logic.

**Implementation:** A registry in `@gsc/api/ai-core` resolves `AI_PROVIDER` (`fake` by default, `openai`, or `claude`). The deterministic `fake` provider is used for dev and e2e and simulates failure modes. Every provider returns the same strict JSON Schema (`DRAFT_WIRE_JSON_SCHEMA`), and the shared pipeline (`interpretTab`) validates it: malformed or impossible events are dropped and explained, partial rhythm is cleared, and timeouts and outages map to retryable errors.

- **OpenAI:** Responses API with a strict `json_schema` format. Requires `OPENAI_MODEL`, a vision-capable model of the owner's choice.
- **Claude:** Messages API with an `output_config.format` JSON schema and effort `high`. The model defaults to `claude-opus-5-5` and can be overridden with `ANTHROPIC_MODEL`. Server-side refusal fallback (`fallbacks: "default"`) is enabled, so a policy decline is retried on a fallback model in the same call.

## ADR-007 — Presentational libraries, thin apps

**Status:** Accepted

**Decision:** UI components live in `@gsc/web/ui` and are purely presentational (inputs/outputs, no injected services). Routed pages live in `@gsc/web/feature-*` and connect UI to `@gsc/web/data-access`. Apps only compose routes and providers. API handlers live in `@gsc/api/handlers`, and the Functions app only registers triggers. Tag-based lint rules enforce the boundaries.

**Why:** Reuse, testability without a runtime, and a clear separation of concerns.

## ADR-008 — Tailwind CSS

**Status:** Accepted

**Decision:** Use Tailwind v4 (PostCSS) for styling.

**Why:** Most of the UI is custom (tab editor, fretboard, cropper). Utility classes keep presentational components self-contained, and there is no Bootstrap JavaScript to conflict with Angular.

## ADR-009 — Whole-site e2e against production builds

**Status:** Accepted

**Decision:** Playwright drives production builds served by the SWA CLI, which proxies to the real Functions host. Tests use ephemeral MongoDB and the fake AI provider. A route manifest (`@gsc/web/routes`) plus a reporter fail CI if any route lacks a tagged spec.

**Why:** It mirrors Azure routing, is deterministic and free in CI, and makes "e2e on the whole site" enforceable rather than aspirational.

## ADR-010 — Client-side HEIC decoding

**Status:** Accepted

**Decision:** Decode iPhone HEIC photos in the browser with `heic-to` (libheif, WASM). It is lazy-loaded only when a HEIC file is chosen. Crops are always re-encoded as JPEG before upload.

**Why:** Phone photos are often HEIC, but Chromium and Firefox can't display HEIC, AI providers don't accept it, and common server image libraries ship without a HEVC decoder.

**Tradeoff:** The decoder is LGPL-3.0 and about 1 MB. It stays a separate dynamically loaded chunk and is only fetched when a HEIC file is used. Revisit before any public distribution.

## Open decisions

- [ ] Choose initial authentication method (defer until hosted multi-user milestone if local-only).
- [x] Image upload path: the **request body**, carrying a base64 JPEG/PNG/WebP crop of at most 4 MB and 2048 px on the longest side. The full page never leaves the browser and nothing is stored. Revisit if retention becomes opt-in (M5).
- [ ] Select the default AI provider/model from private fixture evaluation, cost, and privacy terms. OpenAI and Claude adapters both exist; run `tools/fixtures/eval-private.mts` against each.
  - 2026-10-13, OpenAI `gpt-5.6-sol`, 3 verified cases: 26/29 positions read correctly (100%, 78%, 93%). Correct rhythm-unknown flag; about 1.5k input and 0.7-3.2k output tokens per crop; 10-43 s per crop. **Confidence was poorly calibrated:** no notes were flagged for review, even in the misread cases. Claude is not yet evaluated (needs `ANTHROPIC_API_KEY`).
- [x] Determine notation renderer/editor: a custom Angular tab editor for correction; alphaTab or VexFlow for display (to be chosen during M1/M2).
- [x] Rhythm may be explicitly **unknown** in M1 (`durationTicks: null`, `rhythmKnown: false`).
- [ ] Determine which Azure Functions hosting option best fits usage and current pricing.
- [x] Images are **not retained** in M1. Only the corrected phrase is saved. Retention, if ever added, will be opt-in.
