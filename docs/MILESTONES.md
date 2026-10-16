# Milestones

**Tracking rule:** Check off `- [x]` only after the work is implemented, tested, and its exit criteria met. Leave incomplete work as `- [ ]`. Commit changes to this file alongside implementation. Do not mark a milestone complete merely because scaffolding exists.

## M0 — Repository foundation

**Goal:** Establish a deployable, low-cost skeleton and documented domain boundaries.

- [x] Initialize Nx workspace with Angular application and Azure Functions API project (choose compatible Nx integration or custom build targets).
- [x] Create shared `contracts`, `music-domain`, and `ai-core` libraries.
- [x] Configure TypeScript strict mode, linting, formatting, unit tests, and CI.
- [x] Define environment variables and secrets policy; provide `.env.example` without credentials.
- [x] Establish local development commands for UI and Functions.
- [x] Create a minimal health endpoint and verify UI-to-API calls locally.
- [x] Document deployment approach and estimated per-request cost drivers.
- [x] Add `fixtures/private/` to `.gitignore` and define safe fixture handling.
- [x] Set up the Playwright e2e harness (full stack: UI + Functions + ephemeral Mongo + fake AI provider), route-coverage guard, and axe checks; run it in CI. See [TESTING.md](TESTING.md#e2e-strategy).

**Exit criteria:** One-command local start is documented; CI passes (lint, unit, e2e); UI can call health endpoint, which is proven by an e2e spec; no secrets or book scans are committed.

## M1 — Image fixture intake and passage selection

**Goal:** Work with supplied book-page images without building a camera feature.

- [x] Support local JPG/PNG upload in Angular.
- [x] Display a page image with zoom and passage crop/selection.
- [x] Capture source metadata (book, page, tuning, capo, optional chord context).
- [x] Add explicit consent/confirmation before sending an image to an external AI service.
- [x] Send selected crop to a serverless API endpoint with size/type limits.
- [x] Return an editable draft transcription with confidence/uncertainty indicators.
- [x] Implement correction UI for strings, frets, note order, durations, and techniques.
- [x] Persist a user-confirmed phrase and retain provenance.
- [x] Add at least three representative private image fixtures and expected outputs. *(3 owner-verified cases: solo bends, a tilted power-chord riff with dead notes, and a sideways legato riff. First OpenAI `gpt-5.6-sol` run read 26 of 29 positions; see DECISIONS.md.)*
- [x] E2E: M1 journey and page specs pass (including consent decline, file limits, AI failure recovery, unknown rhythm).

**Exit criteria:** A user can import a supplied photo, select a phrase, fix recognition mistakes, and save verified notes. No camera capture required.

## M2 — Musical analysis

**Goal:** Explain why the phrase works.

- [x] Define canonical pitch, string/fret, tuning, timing, and articulation types. *(String/fret, timing and articulations are `TabEvent` in contracts; tuning, capo, key, chords and placement are `MusicalContext`; derived pitch types are in music-domain: `NoteFact`, `Interval`, `Key`, `Chord`, `NoteRole`.)*
- [x] Compute notes and intervals deterministically from verified tab and tuning. *(`analyzeNotes` and `parseKey` in music-domain: capo, bend targets, natural harmonics, and key-aware spelling. Shown on the phrase page as "Notes and intervals", labelled as computed from the tab.)*
- [x] Support user-provided key, chord progression, and phrase position within the progression. *(Harmony panel on the phrase page. Chord symbols are parsed, and unknown ones are listed rather than guessed. Users place chords per note; a lone chord is assumed to cover the whole phrase, labelled as assumed. `PUT /api/phrases/{id}/harmony` saves with revision checks, and a stale page gets a 409.)*
- [x] Identify candidate scales and chord tones with uncertainty when harmony is ambiguous. *(`candidateScales` tries 12 scale types on every root and ranks them by stated evidence: the key you gave, the chord roots, the landing note, and the smallest scale that fits. It reports clear, ambiguous (the top candidates have different roots) or too few notes. Scales are spelled by degree (the b5 of A is Eb). Chord tones are shown as note roles.)*
- [x] Generate a concise explanation of phrasing, target notes, and techniques. *(The "Why it works" panel. The AI sees only facts computed in code plus the user's assumptions. Observations must cite real note ids, or they're dropped; interpretations state their assumption. The explanation is stored against the phrase revision and marked stale when harmony changes. `gpt-6-luna` took about 8 s and about 1k/0.7k tokens; see DECISIONS.md.)*
- [x] Highlight note roles on the tablature/fretboard display. *(Tablature: each fret shows its role, with chord tones in bold and bends as `b7→R`; chord names appear where they change; explanation citations highlight their notes in the tab. A fretboard diagram isn't built yet; it belongs with M4 transposition.)*
- [x] Validate analysis against hand-authored examples, including ambiguous cases. *(`analysis-examples.spec.ts`: 9 invented phrases worked out by hand, run through notes, roles and scales. They include an ambiguous pentatonic, the same run resolved by a chord, too few pitches, N.C. and slash chords, unknown chord symbols, flat-key spelling, drop D harmonics and capo.)*
- [x] Allow user feedback/correction of harmonic assumptions. *(Harmony panel: key, chords and placement are editable; roles, spelling and scales update live; saving bumps the revision and marks the explanation stale until it is updated.)*
- [ ] E2E: M2 journey and page specs pass (including stale-analysis invalidation).

**Exit criteria:** A verified lick can be explained in musical context without pretending that key or harmony is always knowable from tab alone.

## M3 — Practice-program generator

**Goal:** Turn the lick into a useful, achievable lesson.

- [ ] Define exercise schema: objective, notes, tempo, repetitions, success condition.
- [ ] Generate a sequence: isolate → slow practice → connect phrases → apply over chords.
- [ ] Include technique-specific drills where justified by the passage.
- [ ] Add metronome/playback MVP (simple synthesized notes or MIDI acceptable).
- [ ] Let users adjust difficulty, session duration, and focus.
- [ ] Track completion and notes without requiring audio performance grading.
- [ ] Add a review step to reject exercises with incorrect notes or impossible fingerings.
- [ ] Test one complete learning plan end-to-end with a real fixture.
- [ ] E2E: M3 journey and page specs pass (stubbed audio and clock; progress persists across reload).

**Exit criteria:** User can complete and track a short practice plan derived from a scanned passage.

## M4 — Transposition and creative application

**Goal:** Help transfer the idea beyond the original passage.

- [ ] Transpose note pitches into a selected key while preserving intervals.
- [ ] Generate at least one playable guitar fingering for the new key.
- [ ] Allow selection of preferred fretboard position and range.
- [ ] Show chord-tone function before and after transposition.
- [ ] Generate two controlled variations (e.g., rhythm change, alternate ending).
- [ ] Offer an application exercise over a user-entered chord progression.
- [ ] Validate fret limits, tuning, playability constraints, and preserved musical intent.
- [ ] E2E: M4 journey and page specs pass.

**Exit criteria:** A user can take one lick into another key and practice applying a variation over chords.

## M5 — Vocabulary library and private beta

**Goal:** Make repeated study useful over time.

- [ ] Save and search phrases by key, technique, interval pattern, and source.
- [ ] Add tags, personal annotations, and favorite phrases.
- [ ] Surface past practice sessions and pending review items.
- [ ] Add authentication and per-user data isolation if deploying for multiple users.
- [ ] Add observability, error handling, retry policy, and AI usage caps.
- [ ] Deploy UI and API to Azure and configure database access securely.
- [ ] Run a private beta with a varied set of book images and record failure modes.
- [ ] Review privacy, image retention, and copyright-related UX before broader use.
- [ ] E2E: M5 journey specs pass, including cross-user isolation; deployed smoke suite passes against Azure.

**Exit criteria:** Private end-to-end product works in Azure, with a reusable library and bounded operational cost.

## Release gate

- [ ] All M0–M5 exit criteria satisfied.
- [ ] No known data-loss or cross-user-access bugs.
- [ ] AI responses are clearly distinguishable from deterministic music calculations.
- [ ] Scan and source-image retention settings are understandable.
- [ ] Cost/usage monitoring is configured.
- [ ] Full e2e suite (every route, plus the north-star journey) passes on Chromium, Firefox, and WebKit.
