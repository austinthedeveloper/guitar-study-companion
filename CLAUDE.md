# Guitar Study Companion: working notes for agents

The product and decisions live in `docs/`: MILESTONES (what's next), DECISIONS (ADRs and AI eval history), DEVELOPMENT (setup and layout), TESTING (e2e strategy). The Nx workspace is `guitar-companion/`; it has its own `CLAUDE.md` with Nx tooling rules. This file covers how to work in this repo quickly and safely.

## Workflow

- Branch `feature/cld-<name>` from `main` (or from the previous `cld` branch when stacking). Never commit to `main`. The owner merges and pushes.
- Run commands from `guitar-companion/` after `source ~/.nvm/nvm.sh && nvm use` (Node 22).
- **Before every commit, run `npm run verify`.** It runs the CI steps in order: `nx format:check`, then lint, test, typecheck and build for all projects, then the full e2e suite. Commit only if it passes. Chain steps with `&&`, never `;`. Run `npx nx format:write` first; CI fails on formatting.
- Commit message trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Check off `docs/MILESTONES.md` items with a short note on what was built, in the same commit as the work. Record AI evaluation results and decisions in `docs/DECISIONS.md`.
- The owner likes a cleanup round between milestones.

## Architecture rules that matter in practice

- **ADR-007:** `@gsc/web/ui` components are presentational (inputs and outputs, no services). Pages in `@gsc/web/feature-*` connect them to `@gsc/web/data-access`. Apps only compose routes. Shared styles (`.btn-*`) go in `apps/web/src/styles.css`.
- **`@gsc/music-domain` has no dependencies.** It uses structural types such as `EventLike`, not contracts. Put every musical fact here: notes, intervals, roles, scales, moves, plans, review.
- **Facts vs interpretation.** Code computes the musical facts. AI only explains or coaches from facts built in code (`buildExplainFacts`, `buildCoachFacts`), never from raw tab. Show AI text apart from facts, labelled as AI, and validate it: cited note ids must exist, and frets mentioned must be in the exercise. Spell out anything directional in the facts (e.g. "slide from fret 6 to fret 5"); the model gets direction wrong if left to infer it.
- **Revisions.** Writes derived from a phrase send the `revision` the user saw; a mismatch gets a 409 (`staleRevision()` in handlers/http). Derived data (explanations, plans) stores the `phraseRevision` it was built from, and the UI marks it stale when that's older than the phrase.
- **Contracts:** optional fields are `.optional()`, not nullable. AI wire schemas are strict-mode (every field required, optional = nullable) and get converted. MongoDB uses `ignoreUndefined: true`; without it, undefined fields are stored as null and fail parsing on read.
- **Playback** on a page: provide `ExercisePlayback` (web/data-access) in the component and feed it `phraseNoteEvents(...)` (web/audio). `AUDIO_ENGINE` is the injectable factory that tests replace.
- **AI providers** implement `interpretTab` and `generateJson`. Add a new text task to `GenerateJsonInput['task']` and give the fake provider a deterministic answer built from `input.data`. Wrap calls in `withAiTimeout`.

## Testing recipes

- **Unit tests for pages:** don't use `fixture.whenStable()` when the page chains HTTP requests; it waits for requests the test hasn't flushed yet and deadlocks. Settle with `TestBed.tick()` plus `await new Promise(r => setTimeout(r))` a few times (see `practice-page.spec.ts`).
- **e2e helpers** (`apps/web-e2e/src/support`):
  - `createPhrase(request, title, contextOverrides?, events?)` and `highStringLick(...frets)` create phrases.
  - `updateHarmony` saves harmony through the API.
  - `reachReview(page, scenario)` walks through an import.
  - `stubAudio(page)` gives a fake AudioContext. Its clock follows `performance.now()`, so `page.clock.install()` and `runFor()` drive the metronome. Check `audioLog(page)` for what was scheduled.
  - Fake AI failures: send the header `x-gsc-fake-scenario: unavailable|timeout` (via `page.route(..., route.continue({ headers }))`).
- **Every new route** needs an entry in `ROUTE_PATHS` and an e2e spec tagged `routeTag(...)`, or the coverage guard fails.
- **To check visuals,** write a throwaway `apps/web-e2e/src/pages/zz-shot.spec.ts` that calls `page.screenshot({ path: '<scratchpad>/x.png' })`, run it with `--grep shot`, read the PNG, then delete the spec.
- **Angular:** bind `[selected]` on each `<option>`, not `[value]` on the `<select>` (the value is set before the options render). Outputs can't be named like DOM events (`play`, `stop`, ...). Custom elements are inline, so add `class="block"` when spacing matters.

## Trying real AI (costs money; the owner has OpenAI credits and wants Claude evaluated later)

```sh
npm run dev:real-ai                       # throwaway Mongo + API with AI_PROVIDER=openai (or -- --provider claude|fake)
node tools/fixtures/phrase-from-fixture.mts scan05-riff --chords "E5"   # prints a phrase id
curl -X POST localhost:7071/api/phrases/<id>/plans -H 'content-type: application/json' \
  -d '{"revision":1,"settings":{"difficulty":"medium","minutes":30,"focus":"balanced"}}'
node tools/fixtures/eval-private.mts      # recognition accuracy on private fixtures (needs AI_PROVIDER set)
```

- **The API does not reload on code changes.** Restart `dev:real-ai` after editing `packages/api` or `packages/shared`. A prompt change that doesn't change the input token count in the logs (`coach.ok`, `explain.ok`) means you're testing the old build.
- Run each real-model check 2–3 times; outputs vary from run to run. Log token counts, and keep costs well under a cent per call.
- `fixtures/private/` holds real book scans and is gitignored. Never commit it, and never send a full page to AI; only send crops, or note facts.

## Pitfalls already hit

- The Nx daemon is off (`useDaemonProcess: false`); with it on, the graph fails about half the time (listr2 `ERR_REQUIRE_ESM`). If "Failed to process project graph" comes back, check whether the daemon was re-enabled.
- macOS has no `timeout` command. Never leave a bare `cat > file` without a heredoc, because it waits on stdin forever.
- Occasionally one Vitest process stalls at startup during a parallel `run-many` (seen in contracts, handlers, web; never reproducible alone). If a run hangs with an idle `vitest` and no workers, kill it and rerun; it isn't the code. Adding an HTTP request to a page breaks its `whenStable()`-based unit tests until the test flushes that request too.
- Kill background servers when done: `pkill -f "nx serve api"; pkill -f "func start"`.
- Python `str.replace` edits that skip their assertion silently no-op once Prettier has re-wrapped the code. Always `assert old in s`, and re-read the target after formatting. A global `sed` hits the same line in every test in a file; scope it.
- Pages showing several tabs have duplicate `cell-*` test ids; scope locators (e.g. `getByTestId('transposed-tab').getByTestId('cell-0-2')`).
- Playwright reports a failed e2e run only as "Running target e2e ... failed". Grep the log for `✘` or `failed` before trusting the run.
