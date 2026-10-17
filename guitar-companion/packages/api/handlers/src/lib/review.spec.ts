import { Phrase, PracticePlan, PracticeSession } from '@gsc/contracts';
import { buildReviewQueue } from './review';

const phrase = (
  id: string,
  revision = 1,
  extra: Partial<Phrase> = {},
): Phrase => ({
  id,
  title: `Phrase ${id}`,
  source: { bookTitle: 'Book' },
  context: { tuningMidi: [64, 59, 55, 50, 45, 40], capo: 0 },
  rhythmKnown: false,
  ticksPerQuarter: 480,
  events: [
    {
      id: 'e1',
      order: 0,
      stringIndex: 0,
      fret: 5,
      durationTicks: null,
      techniques: [],
    },
  ],
  tags: [],
  favorite: false,
  revision,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...extra,
});
const plan = (
  id: string,
  phraseId: string,
  phraseRevision = 1,
  exercises = 2,
): PracticePlan => ({
  id,
  phraseId,
  phraseRevision,
  settings: { difficulty: 'medium', minutes: 15, focus: 'balanced' },
  exercises: Array.from({ length: exercises }, (_, i) => ({
    id: `x${i + 1}`,
    kind: 'slow' as const,
    title: 'Slow',
    objective: 'o',
    eventIds: ['e1'],
    referenceNotes: [],
    tempo: { startBpm: 48, targetBpm: 80, stepBpm: 5, rhythmic: false },
    repetitions: 6,
    successCriterion: 's',
    instructions: [],
    coaching: [],
    minutes: 4,
  })),
  rejected: [],
  coachedBy: null,
  createdAt: '2026-10-02T00:00:00.000Z',
});
const session = (
  planId: string,
  done: string[],
  updatedAt: string,
): PracticeSession => ({
  planId,
  progress: Object.fromEntries(
    done.map((id) => [id, { completedAt: updatedAt, bestBpm: 60 }]),
  ),
  notes: '',
  updatedAt,
});
const now = new Date('2026-10-16T12:00:00.000Z');

describe('buildReviewQueue', () => {
  it('orders unfinished, due, stale plan, stale explanation, not started', () => {
    const queue = buildReviewQueue(
      [
        phrase('new'),
        phrase('stale', 2, {
          explanation: {
            summary: 's',
            points: [],
            phraseRevision: 1,
            provider: 'fake',
            model: 'm',
            createdAt: '2026-10-03T00:00:00.000Z',
          },
        }),
        phrase('done-long-ago'),
        phrase('done-recently'),
        phrase('half'),
      ],
      [
        plan('p-stale', 'stale', 1),
        plan('p-old', 'done-long-ago'),
        plan('p-recent', 'done-recently'),
        plan('p-half', 'half'),
      ],
      [
        session('p-old', ['x1', 'x2'], '2026-10-05T00:00:00.000Z'),
        session('p-recent', ['x1', 'x2'], '2026-10-14T00:00:00.000Z'),
        session('p-half', ['x1'], '2026-10-15T00:00:00.000Z'),
      ],
      now,
    );
    expect(queue.map((i) => [i.phraseId, i.kind, i.detail])).toEqual([
      ['half', 'unfinished', '1 of 2 exercises done.'],
      ['done-long-ago', 'due', 'Finished 11 days ago; time for a review run.'],
      [
        'stale',
        'stale-plan',
        'The practice plan was built for an earlier version.',
      ],
      [
        'stale',
        'stale-explanation',
        'The explanation was written for an earlier version.',
      ],
      ['new', 'not-started', 'No practice plan yet.'],
    ]);
  });

  it('uses the newest plan per phrase and lists at most five unstarted phrases', () => {
    const queue = buildReviewQueue(
      [phrase('a'), ...Array.from({ length: 7 }, (_, i) => phrase(`n${i}`))],
      [
        { ...plan('old', 'a'), createdAt: '2026-10-01T00:00:00.000Z' },
        { ...plan('new', 'a', 1, 3), createdAt: '2026-10-10T00:00:00.000Z' },
      ],
      [],
      now,
    );
    expect(queue[0]).toMatchObject({
      phraseId: 'a',
      detail: '0 of 3 exercises done.',
    });
    expect(queue.filter((i) => i.kind === 'not-started')).toHaveLength(5);
  });
});
