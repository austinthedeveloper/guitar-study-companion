// Turns a private verified fixture (fixtures/private/cases/<id>/expected.json)
// into a saved phrase on a running local API, and prints its id. Pair with
// `npm run dev:real-ai` to try explanations or practice plans on real notes.
// Usage: node tools/fixtures/phrase-from-fixture.mts <case-id>
//          [--api http://127.0.0.1:7071] [--key A] [--chords "A7 D7"]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Ev {
  order: number;
  stringIndex: number;
  fret: number | null;
  techniques?: string[];
  bendSemitones?: number;
}

const args = process.argv.slice(2);
const flag = (name: string) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const id = args[0];
if (!id || id.startsWith('--')) {
  console.error('Usage: node tools/fixtures/phrase-from-fixture.mts <case-id>');
  process.exit(1);
}
const api = flag('--api') ?? 'http://127.0.0.1:7071';
const expected = JSON.parse(
  readFileSync(join('fixtures/private/cases', id, 'expected.json'), 'utf8'),
) as { tuningMidi?: number[]; source?: string; events: Ev[] };

const phrase = {
  title: `${id} (private fixture)`,
  source: {
    bookTitle: 'Private fixture',
    ...(expected.source ? { songTitle: expected.source.slice(0, 200) } : {}),
  },
  context: {
    tuningMidi: expected.tuningMidi ?? [64, 59, 55, 50, 45, 40],
    capo: 0,
    ...(flag('--key') ? { key: flag('--key') } : {}),
    ...(flag('--chords') ? { chords: flag('--chords') } : {}),
  },
  rhythmKnown: false,
  ticksPerQuarter: 480,
  events: expected.events.map((e, i) => ({
    id: `e${i + 1}`,
    order: e.order,
    stringIndex: e.stringIndex,
    fret: e.fret,
    durationTicks: null,
    techniques: e.techniques ?? [],
    ...(e.bendSemitones ? { bendSemitones: e.bendSemitones } : {}),
  })),
};
const res = await fetch(`${api}/api/phrases`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(phrase),
});
const body = await res.json();
if (!res.ok) {
  console.error(res.status, JSON.stringify(body));
  process.exit(1);
}
console.log(body.id);
