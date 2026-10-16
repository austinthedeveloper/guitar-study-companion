import { analyzeNotes } from './analyze-notes';
import { harmonize } from './harmony';
import { parseKey } from './keys';
import { STANDARD_TUNING_MIDI } from './pitch';
import {
  buildPracticePlan,
  ExerciseDraft,
  PlanSettingsLike,
  reviewExercises,
  splitFigures,
} from './practice';
import { EventLike } from './validate-events';

const ev = (
  id: string,
  order: number,
  stringIndex: number,
  fret: number | null,
  techniques: string[] = [],
  bendSemitones?: number,
): EventLike => ({
  id,
  order,
  stringIndex,
  fret,
  durationTicks: null,
  techniques,
  ...(bendSemitones ? { bendSemitones } : {}),
});

// C4 C#4(h) E4 G4→A4 A4 | F#4 D4~  over A7 (notes 1-5) then D7 (6-7).
const blues = [
  ev('e1', 0, 2, 5),
  ev('e2', 1, 2, 6, ['hammer-on']),
  ev('e3', 2, 1, 5),
  ev('e4', 3, 1, 8, ['bend'], 2),
  ev('e5', 4, 0, 5),
  ev('e6', 5, 1, 7),
  ev('e7', 6, 2, 7, ['vibrato']),
];
const chordChanges = [
  { fromOrder: 0, chord: 'A7' },
  { fromOrder: 5, chord: 'D7' },
];

function plan(
  events: EventLike[],
  settings: Partial<PlanSettingsLike> = {},
  extra: {
    chords?: string;
    changes?: typeof chordChanges;
    tempoBpm?: number;
  } = {},
) {
  const analysis = analyzeNotes({
    events,
    tuningMidi: STANDARD_TUNING_MIDI,
    key: parseKey('A'),
  });
  const harmony = harmonize({
    analysis,
    chords: extra.chords,
    chordChanges: extra.changes,
  });
  return buildPracticePlan({
    events,
    analysis,
    harmony,
    rhythmKnown: false,
    tempoBpm: extra.tempoBpm,
    settings: {
      difficulty: 'medium',
      minutes: 15,
      focus: 'balanced',
      ...settings,
    },
  });
}
const kinds = (xs: ExerciseDraft[]) => xs.map((x) => `${x.kind}:${x.title}`);

describe('splitFigures', () => {
  it('breaks at four notes and at chord changes, never leaving one note alone', () => {
    const analysis = analyzeNotes({
      events: blues,
      tuningMidi: STANDARD_TUNING_MIDI,
    });
    const figures = splitFigures(analysis, [
      'A7',
      'A7',
      'A7',
      'A7',
      'A7',
      'D7',
      'D7',
    ]);
    expect(figures.map((f) => [f.first, f.last])).toEqual([
      [1, 4],
      [5, 7],
    ]);
  });
});

describe('buildPracticePlan', () => {
  it('builds isolate → technique → slow → apply in that order, fitted to 30 minutes', () => {
    const xs = plan(
      blues,
      { minutes: 30 },
      { chords: 'A7 D7', changes: chordChanges },
    );
    expect(kinds(xs)).toEqual([
      'isolate:Figure 1 (notes 1–4)',
      'isolate:Figure 2 (notes 5–7)',
      'technique:Bend in tune',
      'technique:Even hammer-ons and pull-offs',
      'technique:Controlled vibrato',
      'slow:Whole phrase, slowly',
      'apply:Over A7 → D7',
    ]);
    expect(xs.map((x) => x.id)).toEqual([
      'x1',
      'x2',
      'x3',
      'x4',
      'x5',
      'x6',
      'x7',
    ]);
  });

  it('uses phrase notes by id, with a reference fret for the bend target', () => {
    const xs = plan(blues, { minutes: 30 });
    const bend = xs.find((x) => x.technique === 'bend');
    expect(bend?.eventIds).toEqual(['e4']);
    // G4 at fret 8 bent a whole step should match fret 10 (A4).
    expect(bend?.referenceNotes).toEqual([
      { stringIndex: 1, fret: 10, label: 'Bend target for note 4 (A4)' },
    ]);
    const legato = xs.find((x) => x.technique === 'hammer-on');
    expect(legato?.eventIds).toEqual(['e1', 'e2']);
  });

  it('ramps tempo by difficulty, or from the phrase tempo, one note per click without rhythm', () => {
    const slow = plan(blues).find((x) => x.kind === 'slow');
    expect(slow?.tempo).toEqual({
      startBpm: 48,
      targetBpm: 80,
      stepBpm: 5,
      rhythmic: false,
    });
    expect(slow?.instructions.join(' ')).toMatch(/one note per click/);
    const hard = plan(blues, { difficulty: 'hard' }, { tempoBpm: 120 }).find(
      (x) => x.kind === 'slow',
    );
    expect(hard?.tempo).toMatchObject({
      startBpm: 90,
      targetBpm: 120,
      stepBpm: 8,
    });
    expect(hard?.repetitions).toBe(4);
  });

  it('aims "apply" at chord tones, using where bends land', () => {
    const apply = plan(
      blues,
      { minutes: 30 },
      { chords: 'A7 D7', changes: chordChanges },
    ).find((x) => x.kind === 'apply');
    expect(apply?.chord).toBe('A7 → D7');
    expect(apply?.instructions[1]).toBe(
      'Aim for: note 2 (C#4, 3 of A7); note 3 (E4, 5 of A7); note 4 (A4, R of A7); note 5 (A4, R of A7).',
    );
  });

  it('skips "apply" when chords are not placed', () => {
    const xs = plan(blues, { minutes: 60 }, { chords: 'A7 D7' });
    expect(xs.some((x) => x.kind === 'apply')).toBe(false);
  });

  it('fits a short session by focus, always keeping slow practice', () => {
    expect(kinds(plan(blues, { minutes: 15 }))).toEqual([
      'isolate:Figure 1 (notes 1–4)',
      'isolate:Figure 2 (notes 5–7)',
      'technique:Bend in tune',
      'technique:Even hammer-ons and pull-offs',
      'slow:Whole phrase, slowly',
    ]);
    expect(kinds(plan(blues, { minutes: 5, focus: 'technique' }))).toEqual([
      'technique:Bend in tune',
      'slow:Whole phrase, slowly',
    ]);
    // Accuracy: bends are the only drill, and more repetitions.
    const accuracy = plan(blues, { minutes: 60, focus: 'accuracy' });
    expect(
      accuracy.filter((x) => x.kind === 'technique').map((x) => x.technique),
    ).toEqual(['bend']);
    expect(accuracy[0].repetitions).toBe(8);
  });

  it('adds connect steps between three or more figures, and drills muted notes with neighbours', () => {
    const riff = [
      ev('a', 0, 5, 0),
      ev('b', 1, 4, null, ['dead-note']),
      ev('c', 2, 5, 3),
      ev('d', 3, 5, 5),
      ev('e', 4, 4, 5),
      ev('f', 5, 4, 7),
      ev('g', 6, 3, 5),
      ev('h', 7, 3, 7),
      ev('i', 8, 2, 4),
      ev('j', 9, 2, 6),
    ];
    const xs = plan(riff, { minutes: 60 });
    expect(xs.filter((x) => x.kind === 'connect').map((x) => x.title)).toEqual([
      'Join figures 1 and 2',
      'Join figures 2 and 3',
    ]);
    expect(xs.find((x) => x.technique === 'dead-note')?.eventIds).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('returns nothing for a phrase with no notes', () => {
    expect(plan([])).toEqual([]);
  });
});

describe('reviewExercises', () => {
  const base = plan(blues, { minutes: 30 })[0];
  const phrase = { events: blues, stringCount: 6, capo: 0 };

  it('accepts rule-built exercises', () => {
    const xs = plan(blues, { minutes: 60 });
    expect(reviewExercises(xs, phrase).rejected).toEqual([]);
  });

  it('rejects unknown notes, off-neck references, and impossible stretches', () => {
    const wide = [...blues, ev('w1', 9, 0, 2), ev('w2', 9, 1, 12)];
    const result = reviewExercises(
      [
        { ...base, title: 'Ghost', eventIds: ['e1', 'nope'] },
        {
          ...base,
          title: 'Off neck',
          referenceNotes: [{ stringIndex: 0, fret: 23, label: 'x' }],
        },
        { ...base, title: 'Stretch', eventIds: ['w1', 'w2'] },
      ],
      { events: wide, stringCount: 6, capo: 2 },
    );
    expect(result.accepted).toEqual([]);
    expect(result.rejected).toEqual([
      {
        title: 'Ghost',
        reasons: ['Uses notes that are not in the phrase (nope).'],
      },
      {
        title: 'Off neck',
        reasons: ['Reference note at fret 23 is off the neck.'],
      },
      {
        title: 'Stretch',
        reasons: ["A chord spans 10 frets, which one hand can't reach."],
      },
    ]);
  });
});
