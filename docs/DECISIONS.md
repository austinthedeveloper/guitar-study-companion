# Architecture Decision Records

Record consequential choices here. Status values: `Proposed`, `Accepted`, `Superseded`.

## ADR-001 — Angular + Nx monorepo

**Status:** Proposed

**Decision:** Use Angular for the web UI and Nx for applications/shared libraries.

**Why:** Familiarity enables faster debugging and correction, while Nx supports reusable contracts and music logic.

**Tradeoff:** Tooling/build integration for Azure Functions needs a proof-of-concept.

## ADR-002 — Azure Functions rather than an always-on API server

**Status:** Proposed

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

**Status:** Proposed

**Decision:** Define provider-neutral `interpretImage`, `explainPhrase`, and `proposeExercises` interfaces with schema validation.

**Why:** Enables model comparison and cost control without rewriting product logic.

## Open decisions

- [ ] Choose initial authentication method (defer until hosted multi-user milestone if local-only).
- [ ] Choose image upload path: request body vs private blob + short-lived URL.
- [ ] Select AI provider/model based on private fixture evaluation, cost, and privacy terms.
- [ ] Determine notation renderer/editor (existing library vs custom Angular UI).
- [ ] Decide whether rhythm editing is mandatory for M1 or can be explicitly unknown.
- [ ] Determine which Azure Functions hosting option best fits usage and current pricing.
- [ ] Decide whether saved images are opt-in or retained briefly by default.
