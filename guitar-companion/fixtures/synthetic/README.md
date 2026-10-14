# Synthetic fixtures

Safe-to-commit, hand-made or generated tab images and expected transcriptions with no copyrighted content. Used by e2e and fixture tests in CI.

Real book scans belong in `fixtures/private/`, which is gitignored and never uploaded to CI. See [docs/TESTING.md](../../../docs/TESTING.md#fixture-policy).

## Files

- `synthetic-lick.{png,jpg}` and `synthetic-lick.expected.json`: rendered by `node tools/fixtures/render-synthetic.mjs`.
- `synthetic-lick.heic`: made from the JPG on macOS with `sips -s format heic synthetic-lick.jpg --out synthetic-lick.heic`. It exercises the iPhone HEIC upload path in e2e.

## Private fixture evaluation

Real scans live only in `fixtures/private/` (gitignored). To score real AI providers against them:

1. For each case, make `fixtures/private/cases/<id>/crop.jpg`, a few bars of one tab staff. Exporting a crop from the app's selection step works, as does `sips --cropOffset`.
2. Write `expected.json` with the notes as printed (see the header of `tools/fixtures/eval-private.mts`) and set `"verified": true` once you've checked it against the book.
3. Run the API with a real provider, `AI_PROVIDER=openai` or `AI_PROVIDER=claude` in `.env` plus keys, using `npm run dev`. Then run `node tools/fixtures/eval-private.mts`.

This calls the paid provider once per case. Results are saved next to the cases and stay private.
