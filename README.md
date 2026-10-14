# Guitar Study Companion

> **Learn from music, not just learn to play music.**

An AI-assisted guitar study application that transforms passages from existing guitar books into reusable musical vocabulary. This is **not** primarily a song-recreation or note-for-note performance app. The goal is to **borrow, understand, adapt, practice, and internalize** ideas for improvisation and original playing.

## Core workflow

1. **Import** a photograph or image of a page from a personally owned guitar tab book (initially supplied test images; no camera integration required).
2. **Select** a short passage or lick and review/edit the recognized tablature.
3. **Understand** notes, intervals, scale degrees, chord tones, harmony, phrasing, and technique.
4. **Practice** a personalized sequence of short exercises with achievable tempo targets.
5. **Apply** the idea in another key, position, chord progression, or improvised variation.
6. **Save** the idea to a personal lick/vocabulary library with notes and practice history.

## Product principles

- **Transfer over transcription:** Success means using an idea creatively, not reproducing a solo exactly.
- **Explain the why:** Prefer chord-tone and phrasing explanations over generic scale labels.
- **Short musical units:** Optimize for a few bars or a phrase, not full-song ingestion.
- **Human-correctable:** Recognition and musical analysis must be inspectable and editable.
- **Structured music first:** AI explanations consume verified musical data, not just raw images.
- **Cost-aware:** Keep infrastructure serverless and cap costly AI processing.
- **Copyright-aware:** Personal study by default; no public distribution of scanned pages or copyrighted arrangements.

## Initial stack

- Nx monorepo, Angular frontend
- Azure Static Web Apps for UI
- Azure Functions (TypeScript/Node.js) for request-driven APIs
- MongoDB Atlas for persistent data
- Shared TypeScript contracts and validation in Nx libraries
- Pluggable AI provider interface for image interpretation and teaching
- Blob storage only when persistence of uploaded images becomes necessary

See [Architecture](docs/ARCHITECTURE.md) and [Decisions](docs/DECISIONS.md).

## Milestone status

The authoritative checklist is [MILESTONES.md](docs/MILESTONES.md). Check a task only when its acceptance criteria have been verified. All tasks start unchecked.

## Documentation

| Document | Purpose |
|---|---|
| [Milestones](docs/MILESTONES.md) | Execution plan with checkboxes and exit criteria |
| [Roadmap](docs/ROADMAP.md) | Product phases and sequencing |
| [Architecture](docs/ARCHITECTURE.md) | Components, API shape, deployment and cost controls |
| [Domain Model](docs/DOMAIN_MODEL.md) | Music representation and persistence |
| [Testing](docs/TESTING.md) | Fixture-based validation using provided tab-book images |
| [Feature Backlog](docs/FEATURE_BACKLOG.md) | Ideas beyond committed milestones |
| [Decisions](docs/DECISIONS.md) | Architecture decision records and open questions |
| [AI Contracts](docs/AI_CONTRACTS.md) | Structured outputs, prompts, and guardrails |
| [Contributing](docs/CONTRIBUTING.md) | Workflow and definition of done |

## Getting started

1. Add representative tab-book images under a local, gitignored `fixtures/private/` directory.
2. Complete Milestone 0 before adding significant application code.
3. Build one vertical slice: **image → corrected phrase → analysis → exercise → transformation**.
4. Validate generated music with deterministic checks and user review.

**Status:** Planning; no implementation claimed.
