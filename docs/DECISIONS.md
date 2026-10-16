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

## ADR-011 — Practice plans: rules and AI together, MIDI playback, separate sessions

**Status:** Accepted

**Decision (owner, 2026-10-16):** Practice plans for M3 combine **deterministic rules** and **AI**. Rules build the exercise skeleton from verified notes: isolate each figure, slow practice, connect figures, and apply over the chords. That keeps notes, fingerings and tempos checkable. AI adds instructions and technique-specific advice, and goes through the same validation as explanations. Playback uses **MIDI**, through Web Audio synthesis of MIDI note events in the browser (with optional Web MIDI output), and comes with a **metronome**. Practice progress is stored in a separate **practice sessions** collection that references a plan and the phrase revision it was built from, not on the phrase itself.

**Why:** Rules keep exercises honest about notes and playability; AI adds the coaching language rules can't. Separate sessions keep phrase documents small, preserve history across phrase edits, and match the domain model (PracticePlan and PracticeSession).

**Tradeoff:** Two generation paths to test. A plan built on an older phrase revision must be marked stale, the same way explanations are.


- [ ] Choose initial authentication method (defer until hosted multi-user milestone if local-only).
- [x] Image upload path: the **request body**, carrying a base64 JPEG/PNG/WebP crop of at most 4 MB and 2048 px on the longest side. The full page never leaves the browser and nothing is stored. Revisit if retention becomes opt-in (M5).
- [ ] Select the default AI provider/model from private fixture evaluation, cost, and privacy terms. OpenAI and Claude adapters both exist; run `tools/fixtures/eval-private.mts` against each.
  - 2026-10-13, OpenAI `gpt-5.6-sol`, 3 verified cases: 26/29 positions read correctly (100%, 78%, 93%). Correct rhythm-unknown flag; about 1.5k input and 0.7-3.2k output tokens per crop; 10-43 s per crop. **Confidence was poorly calibrated:** no notes were flagged for review, even in the misread cases. Claude is not yet evaluated (needs `ANTHROPIC_API_KEY`).
  - 2026-10-16, OpenAI `gpt-6-luna` (lower cost), same 3 cases: 100%, **11%**, 93%. scan01 and scan05 matched sol (scan05 again misread one fret, 5→6). On the tilted power-chord riff (scan03), every fret was right, but each chord sat one string too high (two on the last column), and the `x x` dead-note pairs came back as single dead notes. A user could fix this by shifting strings, but a strict score counts it as 16 corrections. Again no notes were flagged for review. About 1.5k input and 1.5-2.8k output tokens per crop; 18-26 s per crop.
  - 2026-10-16, follow-up on scan03 with luna. Prompt `tab-v2` tells the model to follow tilted lines and cross-check each string by counting up from the bottom line. Over 2 runs, the chords were on the right strings once and shifted once (67% and 22%). Rotating the same crop 4° level put the chords on the right strings in both runs (67%, then 100%). The remaining misses were stacked `x x` dead-note pairs read as a single note. **Decision:** add a manual Straighten slider (±15°) to the crop step, with guide lines, and keep `tab-v2`. Auto-deskew can come later if users skip the slider.
  - 2026-10-16, crop enlargement. The fixture crops are already at the photo's native resolution (the intro tab is about 900 px wide on a 3024 px photo), so the `x` marks are only a few pixels tall. Over 3 runs, the straightened scan03 was exact in 2 runs; enlarged 2× it was exact in all 3, with fewer output tokens (about 2.7-3.2k vs 3.4-3.8k), faster replies (26-29 s vs 34-35 s) and about 1.4k more input tokens. Enlarging scan01 and scan05 changed nothing (100% and 93%). **Decision:** the client enlarges crops up to 2×, capped at `MAX_CROP_DIMENSION`. scan05's first note is a small grace-note 5 (hammered on to 7), confirmed in the book by the owner. Both models read it as 6 in every run. This is a real misread of small grace-note digits, not a fixture error.
  - 2026-10-16, review flags. The eval now scores what the editor highlights: low confidence or a note named in an uncertainty. With 1 pass, it highlighted 1 of 5 misread columns and 6 correct ones. Running **2 parallel passes** and flagging the columns they disagree on highlighted 11 of 13 misread columns, with 2 correct columns highlighted. The 2 misses were dead-note pairs that both passes merged the same way. Cost and output tokens roughly double, but replies take about as long because the passes run in parallel. The slowest raw tilted crop took about 59 s, close to the 60 s timeout. **Decision:** `AI_PASSES` defaults to 2; set it to 1 to halve the cost.
- [x] Phrase explanations (M2): the model is given **facts computed in code** (notes, intervals, roles, scale candidates) and the user's stated key and chords, never the tab to reinterpret. Its output is split into observations, which must cite note ids, and interpretations, which carry an assumption. The server drops citations of unknown notes, and drops observations that cite nothing. It explains only the saved revision (409 otherwise) and stores the result against that revision, so harmony edits make it stale rather than silently wrong. Explanations don't bump the phrase revision. First real run (2026-10-16, `gpt-6-luna`, an invented A7→D7 blues lick): it was accurate and specific (b3→3 over A7, a bend from b7 to the root, then the 3rd and root of D7), with every citation correct, in 8 s using about 1.0k input and 0.7k output tokens. With no chords, it described the contour and explicitly declined to assign harmonic roles.
- [x] Determine notation renderer/editor: a custom Angular tab editor for correction; alphaTab or VexFlow for display (to be chosen during M1/M2).
- [x] Rhythm may be explicitly **unknown** in M1 (`durationTicks: null`, `rhythmKnown: false`).
- [ ] Determine which Azure Functions hosting option best fits usage and current pricing.
- [x] Images are **not retained** in M1. Only the corrected phrase is saved. Retention, if ever added, will be opt-in.
