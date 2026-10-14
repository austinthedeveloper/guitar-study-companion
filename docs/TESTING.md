# Testing Strategy

## Approach

Use **user-provided photographs of existing guitar tab books** as the primary real-world fixtures. Native camera capture is deliberately out of scope for early milestones. Uploaded images may vary in lighting, angle, print quality, notation style, and presence of standard staff notation.

## Fixture policy

- Put real book images in `fixtures/private/` (gitignored; never commit or upload to public CI).
- Store non-copyrighted, hand-created or synthetic examples in `fixtures/synthetic/`.
- For each private fixture, record an internal identifier, crop, transcription ground truth, tuning, known/unknown rhythm, and musical context.
- Do not require the original page image to be retained permanently; support deletion.

## Initial test matrix

- [ ] Clean single-line tab with fret numbers only.
- [ ] Tab plus standard notation and rhythmic stems.
- [ ] Hammer-ons, pull-offs, slides, bends, and vibrato.
- [ ] Multiple-digit frets (10, 12, 15) and adjacent notes.
- [ ] Chord shapes and simultaneous notes.
- [ ] Crooked/low-contrast page photo.
- [ ] Alternate tuning and capo.
- [ ] Missing tempo, unknown key, or ambiguous harmony.
- [ ] Partial page/cropped phrase with incomplete context.

## Test layers

1. **Unit:** note-to-pitch conversion, intervals, transposition, fret range, schema validation.
2. **Fixture:** compare recognition to corrected expected event sequences; track errors by type.
3. **Integration:** Functions endpoints, persistence, auth, AI failure handling.
4. **E2E (whole site):** every route and every user flow, driven through a real browser against the real UI + Functions + database stack. See [E2E strategy](#e2e-strategy).
5. **Human musical review:** check whether explanations are useful, exercises playable, and variations musical.

## E2E strategy

E2E coverage is a **release requirement**, not a final-milestone task. Each milestone adds specs for the flows it introduces, and the full suite must pass for the milestone to be checked off.

### Tooling

- **Playwright** via `@nx/playwright` in `apps/web-e2e`. Run it on Chromium on every PR, and on Chromium, Firefox, and WebKit nightly or before a release.
- Playwright `webServer` starts the whole stack: the Angular dev server, the Functions host (`func start`), and the SWA CLI (`swa start`) so `/api` routing and (from M5 on) auth match production.
- `@axe-core/playwright` runs an accessibility scan on every page that is visited.

### Determinism

- **AI:** e2e runs use `AI_PROVIDER=fake`. This is a provider-interface implementation that returns synthetic, schema-valid drafts keyed by fixture ID. It can also simulate failure modes (timeout, invalid JSON, low-confidence regions, unknown rhythm) so recovery paths are tested. Real providers never run in PR CI.
- **Database:** use an ephemeral MongoDB (`mongodb-memory-server` locally, a service container in CI). Each test seeds its own data through a helper that is enabled only when `E2E_MODE=true` and is never compiled into production builds.
- **Images:** upload only `fixtures/synthetic/` images (rendered tab with no copyright). Private fixtures stay local and are exercised through an opt-in `e2e:private` target.
- **Audio/time:** stub `AudioContext` and use Playwright's clock control for the metronome and playback. Assert on state and DOM, not on sound.

### Whole-site coverage rule

- Each Angular route is listed in a route manifest. A guard spec fails if any route has no e2e spec tagged with it (`@route:/path`).
- Every page needs at least: a load/render check, its primary happy path, its empty state, its error state (API or AI failure), and an axe scan.
- Every flow that crosses pages has a journey spec.

### Journey specs (grow by milestone)

| Milestone | Journey |
|---|---|
| M0 | App shell loads; health status from the API is shown; unknown route shows a not-found page |
| M1 | Upload → zoom/crop → metadata → consent gate (declining sends nothing) → draft with uncertainty → correct strings/frets/order/techniques → save; also rejection of oversized or wrong-type files, AI failure without losing edits, rhythm left as unknown |
| M2 | Saved phrase → set key/chords → analysis with note roles highlighted; verified and inferred claims shown separately; correct an assumption → re-analysis; editing the phrase marks stale analysis |
| M3 | Generate a plan → adjust difficulty/focus → metronome/playback controls → complete exercises → progress persists across reload |
| M4 | Transpose → choose position/range → fingering is shown within fret limits → variations → application exercise over a progression |
| M5 | Library search/filter/tag/favorite/annotate; review queue; sign in/out; **cross-user isolation** (user B cannot view or change user A's phrase via the UI or a direct URL); AI usage cap message |
| Full | **North-star journey:** import → correction → analysis → practice → transpose → save → find it in the library |

### Deployed smoke tests

After deployment (M5+), a small read-mostly smoke subset runs against the Azure environment using a dedicated test account. Real-AI e2e runs only manually or on a capped nightly schedule, to keep costs bounded.

## Acceptance notes

Recognition accuracy alone is not the main metric. Track **time to corrected phrase** and **quality of the learning outcome**. When rhythm is absent, tests should verify that the app flags it as unknown rather than hallucinating durations.

## Fixture review template

```md
### Fixture: [private ID]
- Source/page: [private notes]
- Input conditions:
- Known tuning/capo:
- Expected notes and techniques:
- Rhythm present? yes/no
- Context (key/chords), if known:
- Recognition errors:
- Time to correction:
- Analysis quality:
- Practice-plan quality:
- Follow-up action:
```
