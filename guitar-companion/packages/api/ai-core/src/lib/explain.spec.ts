import { Phrase } from '@gsc/contracts';
import { AiProvider } from './ai-provider';
import { buildExplainFacts, explainPhrase } from './explain';
import { FakeAiProvider } from './fake/fake-provider';

const phrase: Phrase = {
  id: 'p1',
  revision: 3,
  title: 'Bend lick',
  source: { bookTitle: 'Book' },
  context: {
    tuningMidi: [64, 59, 55, 50, 45, 40],
    capo: 0,
    key: 'E',
    chords: 'E7 A7 Xyz',
    chordChanges: [
      { fromOrder: 0, chord: 'E7' },
      { fromOrder: 1, chord: 'A7' },
    ],
  },
  rhythmKnown: false,
  ticksPerQuarter: 480,
  events: [
    {
      id: 'e1',
      order: 0,
      stringIndex: 1,
      fret: 17,
      durationTicks: null,
      techniques: ['bend'],
      bendSemitones: 2,
    },
    {
      id: 'e2',
      order: 1,
      stringIndex: 0,
      fret: 15,
      durationTicks: null,
      techniques: [],
    },
  ],
  createdAt: '2026-10-16T00:00:00.000Z',
  updatedAt: '2026-10-16T00:00:00.000Z',
};

/** A provider that answers generateJson with a fixed payload. */
const answering = (json: unknown): AiProvider => ({
  name: 'scripted',
  interpretTab: async () => {
    throw new Error('unused');
  },
  generateJson: async () => ({ json, model: 'm' }),
});

describe('buildExplainFacts', () => {
  it('gives the model computed notes, roles, and assumptions', () => {
    const facts = buildExplainFacts(phrase);
    expect(facts.tuning).toBe('E A D G B E');
    expect(facts.key).toEqual({ given: 'E', understood: 'E major' });
    expect(facts.chords).toEqual({
      given: 'E7 A7 Xyz',
      notUnderstood: ['Xyz'],
      placement: 'placed',
    });
    expect(facts.steps[0]).toMatchObject({
      chord: 'E7',
      notes: [
        {
          id: 'e1',
          string: 2,
          fret: 17,
          name: 'E5',
          bendTo: 'F#5',
          role: 'R (chord tone)',
          bendToRole: '2',
        },
      ],
    });
    expect(facts.steps[1]).toMatchObject({
      chord: 'A7',
      notes: [{ name: 'G5', role: 'b7 (chord tone)' }],
      interval: 'm2 up',
    });
  });

  it('spells out where slides and slurs go', () => {
    const at = (
      id: string,
      order: number,
      fret: number,
      techniques: string[] = [],
    ) => ({
      id,
      order,
      stringIndex: 4,
      fret,
      durationTicks: null,
      techniques: techniques as Phrase['events'][number]['techniques'],
    });
    const facts = buildExplainFacts({
      ...phrase,
      events: [
        at('s1', 0, 6, ['slide']),
        at('s2', 1, 5),
        at('s3', 2, 3, ['pull-off']),
        at('s4', 3, 0, ['pull-off']),
      ],
    });
    expect(facts.steps.map((s) => s.notes[0].moves)).toEqual([
      ['slide from fret 6 to fret 5'],
      undefined,
      ['pull-off from fret 5 to fret 3'],
      ['pull-off from fret 3 to the open string'],
    ]);
  });

  it('marks placement as assumed or unknown', () => {
    const ctx = { ...phrase.context, chordChanges: undefined };
    expect(
      buildExplainFacts({ ...phrase, context: { ...ctx, chords: 'E7' } }).chords
        .placement,
    ).toBe('assumed');
    expect(
      buildExplainFacts({ ...phrase, context: ctx }).chords.placement,
    ).toBe('unknown');
  });
});

describe('explainPhrase', () => {
  it('keeps cited points and drops citations of notes that do not exist', async () => {
    const result = await explainPhrase(
      answering({
        summary: 'Root bent up, landing on the b7 of A7.',
        points: [
          {
            kind: 'observation',
            text: 'G5 is the b7 of A7.',
            eventIds: ['e2', 'ghost', 'e2'],
            assumption: null,
          },
          {
            kind: 'interpretation',
            text: 'The b7 pulls toward D.',
            eventIds: [],
            assumption: 'The next chord is D.',
          },
        ],
      }),
      phrase,
    );
    expect(result.points).toEqual([
      { kind: 'observation', text: 'G5 is the b7 of A7.', eventIds: ['e2'] },
      {
        kind: 'interpretation',
        text: 'The b7 pulls toward D.',
        eventIds: [],
        assumption: 'The next chord is D.',
      },
    ]);
    expect(result.droppedPoints).toBe(0);
  });

  it('drops observations that cite no real note, and malformed points', async () => {
    const result = await explainPhrase(
      answering({
        summary: 'S',
        points: [
          { kind: 'observation', text: 'Uncheckable.', eventIds: ['ghost'] },
          { kind: 'opinion', text: 'Bad kind', eventIds: [] },
          {
            kind: 'observation',
            text: 'Fine',
            eventIds: ['e1'],
            assumption: 'ignored for observations',
          },
        ],
      }),
      phrase,
    );
    expect(result.points).toEqual([
      { kind: 'observation', text: 'Fine', eventIds: ['e1'] },
    ]);
    expect(result.droppedPoints).toBe(2);
  });

  it('rejects output without a summary', async () => {
    await expect(
      explainPhrase(answering({ points: [] }), phrase),
    ).rejects.toMatchObject({ code: 'ai_invalid_output' });
  });

  it('times out and maps provider failures', async () => {
    const fake = new FakeAiProvider();
    await expect(
      explainPhrase(fake, phrase, { timeoutMs: 50, scenario: 'timeout' }),
    ).rejects.toMatchObject({ code: 'ai_timeout' });
    await expect(
      explainPhrase(fake, phrase, { scenario: 'unavailable' }),
    ).rejects.toMatchObject({ code: 'ai_unavailable' });
  });

  it('gets a cited explanation from the fake provider', async () => {
    const result = await explainPhrase(new FakeAiProvider(), phrase);
    expect(result.points[0]).toMatchObject({
      kind: 'observation',
      text: 'Opens on E5, the R (chord tone) of E7.',
      eventIds: ['e1'],
    });
  });
});
