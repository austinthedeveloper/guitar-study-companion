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

**Status:** Superseded by ADR-013 (Azure Cosmos DB for MongoDB vCore, to keep everything in Azure)

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


## ADR-012 — Transposition is exact; fingering is searched

**Status:** Accepted

**Decision (2026-10-16):** Transposition moves every pitch by the same number of semitones; nothing is re-voiced or approximated, and no AI is involved. Fingering is a least-cost search over the phrase's columns. The costs are hand moves beyond a four-fret span, distance from the original string (which keeps the shape by default), and distance outside a chosen position. The hard constraints are reach (5 frets in a chord), slurs and slides on one string, no open-string bends, natural harmonics only at real nodes, and the fret limit. An independent `validateTransposition`, plus a check that roles are unchanged, guards the result. Variations are rule-made and state what they changed. Transposed phrases and variations can be saved as new phrases with `derivedFrom` provenance, so M3 practice works on them unchanged.

**Why:** Pitch arithmetic is verifiable, so code is the authority (AI_CONTRACTS). The playability rules are what makes a transposition usable.

**Also changed:** notes outside the key are now spelled by scale degree from the tonic: b2, b3, b6 and b7 as flats; the tritone as #4 in major keys and b5 in minor. The b3 of C is now Eb (it was D#), matching how scales were already spelled. Where the degree spelling would need a double accidental or a white-key enharmonic (Fb, Cb, E#, B#), the plain name is used instead, so the b5 of Bb minor stays E.

## ADR-013 — All-Azure hosting: Blob static site, Flex Consumption Functions, Cosmos DB for MongoDB vCore

**Status:** Accepted (owner chose Azure and Blob Storage for the site; the API and database choices are recommendations, not yet deployed)

**Decision (2026-10-16):** The web app is a Storage account static website, with Azure Front Door added for a custom domain. The API is a Function App on the Flex Consumption plan (Node 22), with CORS limited to the site, a managed identity, and secrets in Key Vault. The database is Azure Cosmos DB for MongoDB (vCore); this replaces the "MongoDB Atlas" proposal in ADR-003 so everything stays in Azure. Logs go to Application Insights. This supersedes the earlier plan of Static Web Apps with managed functions.

**Why:** It's the owner's stated preference (Azure, Blob for the site). Flex Consumption is Microsoft's recommended serverless plan and scales to zero. Cosmos vCore speaks the MongoDB protocol, so the data layer is unchanged.

**Tradeoffs:**
- **Origins:** the site and API are separate origins, so we need CORS and a runtime `config.json` with the API address. We also lose Static Web Apps' built-in auth, so sign-in is handled in the app (ADR-014).
- **Free database tier:** Cosmos vCore's free tier has no backups.
- **Custom domain:** HTTPS on a custom domain needs Front Door, which is a paid service.

## ADR-014 — Sign-in with Microsoft Entra External ID; test-only login for e2e

**Status:** Accepted (owner requirements; not yet built)

**Decision (2026-10-16):** Users sign in with **SSO (Google and Microsoft accounts)** or **email and password** through one Microsoft Entra External ID user flow (an external tenant). Its Basic tier is free for the first 50,000 monthly active users. The SPA uses MSAL (authorization code with PKCE). The API validates the access token's signature (JWKS), issuer and audience on every request, and uses the token's subject as `userId`. Every repository query is already scoped by `userId`. For e2e, a **test-only `POST /api/e2e/login`** issues a short-lived token for a named test user, signed with an e2e-only key. The endpoint and that token issuer exist only when `E2E_MODE=true`, which a deployment must never set. Cross-user isolation tests log in as two users.

**Why:** It meets the owner's requirements (SSO first, email and password as the backup) in Azure, at no cost at beta scale. The e2e endpoint keeps tests fast and deterministic, without automating a real identity provider.

**Owner steps:**
1. Create the external tenant.
2. Register two apps: the SPA, and the API with an exposed scope.
3. Add Google as an identity provider (a Google Cloud OAuth client).
4. Create a sign-up and sign-in flow with email and password, Google and Microsoft.
5. Share the tenant subdomain and the two client IDs.

## Open decisions

- [x] Choose initial authentication method: Microsoft Entra External ID with SSO and email/password (ADR-014).
- [x] Image upload path: the **request body**, carrying a base64 JPEG/PNG/WebP crop of at most 4 MB and 2048 px on the longest side. The full page never leaves the browser and nothing is stored. Revisit if retention becomes opt-in (M5).
- [ ] Select the default AI provider/model from private fixture evaluation, cost, and privacy terms. OpenAI and Claude adapters both exist; run `tools/fixtures/eval-private.mts` against each.
  - 2026-10-13, OpenAI `gpt-5.6-sol`, 3 verified cases: 26/29 positions read correctly (100%, 78%, 93%). Correct rhythm-unknown flag; about 1.5k input and 0.7-3.2k output tokens per crop; 10-43 s per crop. **Confidence was poorly calibrated:** no notes were flagged for review, even in the misread cases. Claude is not yet evaluated (needs `ANTHROPIC_API_KEY`).
  - 2026-10-16, OpenAI `gpt-6-luna` (lower cost), same 3 cases: 100%, **11%**, 93%. scan01 and scan05 matched sol (scan05 again misread one fret, 5→6). On the tilted power-chord riff (scan03), every fret was right, but each chord sat one string too high (two on the last column), and the `x x` dead-note pairs came back as single dead notes. A user could fix this by shifting strings, but a strict score counts it as 16 corrections. Again no notes were flagged for review. About 1.5k input and 1.5-2.8k output tokens per crop; 18-26 s per crop.
  - 2026-10-16, follow-up on scan03 with luna. Prompt `tab-v2` tells the model to follow tilted lines and cross-check each string by counting up from the bottom line. Over 2 runs, the chords were on the right strings once and shifted once (67% and 22%). Rotating the same crop 4° level put the chords on the right strings in both runs (67%, then 100%). The remaining misses were stacked `x x` dead-note pairs read as a single note. **Decision:** add a manual Straighten slider (±15°) to the crop step, with guide lines, and keep `tab-v2`. Auto-deskew can come later if users skip the slider.
  - 2026-10-16, crop enlargement. The fixture crops are already at the photo's native resolution (the intro tab is about 900 px wide on a 3024 px photo), so the `x` marks are only a few pixels tall. Over 3 runs, the straightened scan03 was exact in 2 runs; enlarged 2× it was exact in all 3, with fewer output tokens (about 2.7-3.2k vs 3.4-3.8k), faster replies (26-29 s vs 34-35 s) and about 1.4k more input tokens. Enlarging scan01 and scan05 changed nothing (100% and 93%). **Decision:** the client enlarges crops up to 2×, capped at `MAX_CROP_DIMENSION`. scan05's first note is a small grace-note 5 (hammered on to 7), confirmed in the book by the owner. Both models read it as 6 in every run. This is a real misread of small grace-note digits, not a fixture error.
  - 2026-10-16, review flags. The eval now scores what the editor highlights: low confidence or a note named in an uncertainty. With 1 pass, it highlighted 1 of 5 misread columns and 6 correct ones. Running **2 parallel passes** and flagging the columns they disagree on highlighted 11 of 13 misread columns, with 2 correct columns highlighted. The 2 misses were dead-note pairs that both passes merged the same way. Cost and output tokens roughly double, but replies take about as long because the passes run in parallel. The slowest raw tilted crop took about 59 s, close to the 60 s timeout. **Decision:** `AI_PASSES` defaults to 2; set it to 1 to halve the cost.
  - 2026-10-30, unreadable images. The first live recognition (luna, a blurry phone photo) came back with 17 notes flagged for review and most frets wrong: a draft that takes longer to fix than to type. Prompt `tab-v3` asks the model for an `imageQuality` verdict (`clear`, `poor`, `unreadable`) with a one-line reason. **Decision:** the server refuses the draft with `422 ai_image_unreadable` when any pass says `unreadable`, or when more than half of the notes (at least 6) are low-confidence or disputed between passes; on clear scans, 2 passes flagged only 2 correct columns, so that share is a strong blur signal. The import page then explains why and suggests a sharper photo, a tighter selection, or manual entry. A `poor` verdict keeps the draft and lists the reason first among the recognition notes. The refused call still counts against the AI allowance. Not yet evaluated on the private fixtures.
- [x] Phrase explanations (M2): the model is given **facts computed in code** (notes, intervals, roles, scale candidates) and the user's stated key and chords, never the tab to reinterpret. Its output is split into observations, which must cite note ids, and interpretations, which carry an assumption. The server drops citations of unknown notes, and drops observations that cite nothing. It explains only the saved revision (409 otherwise) and stores the result against that revision, so harmony edits make it stale rather than silently wrong. Explanations don't bump the phrase revision. First real run (2026-10-16, `gpt-6-luna`, an invented A7→D7 blues lick): it was accurate and specific (b3→3 over A7, a bend from b7 to the root, then the 3rd and root of D7), with every citation correct, in 8 s using about 1.0k input and 0.7k output tokens. With no chords, it described the contour and explicitly declined to assign harmonic roles.
- [x] Practice coaching (M3): the first real plan (2026-10-16, `gpt-6-luna`, the scan05 riff, 30 balanced minutes) had 10 rule-built exercises and nothing rejected. It took about 12 s, with about 2.8k input and 1.1k output tokens. String numbers, frets and note names in the tips were right, but slide tips sometimes reversed the slide ("stop at fret 6" when the tab slides from 6 to 5). A fret filter can't catch that, because both frets belong to the exercise. **Fix:** the facts sent to the model now spell out each move ("slide from fret 6 to fret 5", "pull-off from fret 3 to the open string") for coaching and explanations alike. All slide tips were correct in 3 of 3 runs afterwards. **Lesson:** describe direction in code; don't make the model infer it from where a technique is marked.
- [x] Determine notation renderer/editor: a custom Angular tab editor for correction; alphaTab or VexFlow for display (to be chosen during M1/M2).
- [x] Rhythm may be explicitly **unknown** in M1 (`durationTicks: null`, `rhythmKnown: false`).
- [x] Determine which Azure Functions hosting option best fits usage and current pricing: Flex Consumption (ADR-013).
- [x] Images are **not retained** in M1. Only the corrected phrase is saved. Retention, if ever added, will be opt-in.
