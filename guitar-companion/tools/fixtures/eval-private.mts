// Scores AI tab recognition against private, hand-verified fixtures.
// Opt-in and local only: real scans never leave fixtures/private/ except
// as the crop sent to the configured AI provider (which costs money).
//
// Layout: fixtures/private/cases/<id>/crop.jpg + expected.json
//   expected.json = { "verified": true, "tuningMidi": [...], "rhythmKnown": false,
//                     "events": [{ "order": 0, "stringIndex": 1, "fret": 17, "techniques": ["bend"] }, ...] }
// Usage: start the API with AI_PROVIDER=openai|claude (npm run dev), then
//   node tools/fixtures/eval-private.mts [--api http://127.0.0.1:7071] [--case <id>]
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface Ev {
  order: number;
  stringIndex: number;
  fret: number | null;
  techniques?: string[];
}
interface Expected {
  verified?: boolean;
  tuningMidi?: number[];
  rhythmKnown?: boolean;
  events: Ev[];
}

const args = process.argv.slice(2);
const flag = (name: string) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const api = flag('--api') ?? 'http://127.0.0.1:7071';
const only = flag('--case');
const root = 'fixtures/private/cases';
if (!existsSync(root)) {
  console.error(
    `No ${root}/ directory. See fixtures/synthetic/README.md for the layout.`,
  );
  process.exit(1);
}

/** Notes as ordered columns of "string:fret" so spacing differences don't matter. */
function columns(events: Ev[]): string[] {
  const byOrder = new Map<number, string[]>();
  for (const e of events)
    byOrder.set(e.order, [
      ...(byOrder.get(e.order) ?? []),
      `${e.stringIndex}:${e.fret ?? 'x'}`,
    ]);
  return [...byOrder.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, v]) => v.sort().join('+'));
}

/** Longest common subsequence length: how many columns were read correctly and in order. */
function lcs(a: string[], b: string[]): number {
  const dp = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return dp[a.length][b.length];
}

const rows: Record<string, unknown>[] = [];
for (const id of readdirSync(root).filter((d) => !only || d === only)) {
  const dir = join(root, id);
  const expected = JSON.parse(
    readFileSync(join(dir, 'expected.json'), 'utf8'),
  ) as Expected;
  const image = readFileSync(join(dir, 'crop.jpg')).toString('base64');
  const started = Date.now();
  const res = await fetch(`${api}/api/imports/interpret`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      image: { mimeType: 'image/jpeg', dataBase64: image },
      tuningMidi: expected.tuningMidi ?? [64, 59, 55, 50, 45, 40],
      consent: true,
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    rows.push({ id, error: body?.error?.code ?? res.status });
    continue;
  }
  const want = columns(expected.events);
  const got = columns(body.draft.events);
  const matched = lcs(want, got);
  rows.push({
    id,
    verified: expected.verified === true,
    provider: `${body.provider}/${body.model}`,
    columnsExpected: want.length,
    columnsRead: got.length,
    recall: +(matched / Math.max(1, want.length)).toFixed(2),
    precision: +(matched / Math.max(1, got.length)).toFixed(2),
    // Corrections a user would make: missing + extra columns.
    correctionEffort: want.length - matched + (got.length - matched),
    rhythmFlagCorrect:
      expected.rhythmKnown === undefined
        ? null
        : body.draft.rhythmKnown === expected.rhythmKnown,
    rejected: body.rejectedEventCount,
    needsReview: body.draft.events.filter(
      (e: { confidence: number }) => e.confidence < 0.6,
    ).length,
    tokens: body.usage
      ? `${body.usage.inputTokens}/${body.usage.outputTokens}`
      : null,
    seconds: +((Date.now() - started) / 1000).toFixed(1),
  });
}
console.table(rows);
const out = join(
  root,
  `../eval-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
);
writeFileSync(out, JSON.stringify(rows, null, 2));
console.log(`Saved ${out} (private, gitignored)`);
