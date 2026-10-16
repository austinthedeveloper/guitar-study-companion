import { Exercise, Phrase } from '@gsc/contracts';
import { planForPhrase } from '@gsc/music-domain';
import { AiProvider } from './ai-provider';
import { buildCoachFacts, coachExercises } from './coach';
import { FakeAiProvider } from './fake/fake-provider';

const phrase: Phrase = {
  id: 'p1',
  revision: 1,
  title: 'Bend lick',
  source: { bookTitle: 'Book' },
  context: { tuningMidi: [64, 59, 55, 50, 45, 40], capo: 0, chords: 'E7' },
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
const exercises: Exercise[] = planForPhrase({
  ...phrase,
  settings: { difficulty: 'medium', minutes: 30, focus: 'balanced' },
}).accepted.map((x) => ({ ...x, coaching: [] }) as Exercise);

const answering = (json: unknown): AiProvider => ({
  name: 'scripted',
  interpretTab: async () => {
    throw new Error('unused');
  },
  generateJson: async () => ({ json, model: 'm' }),
});

describe('buildCoachFacts', () => {
  it('describes each exercise by its notes, reference frets, and tempo', () => {
    const facts = buildCoachFacts(phrase, exercises);
    const bend = facts.exercises.find((x) => x.technique === 'bend');
    expect(bend).toMatchObject({
      notes: [{ step: 1, string: 2, fret: 17, name: 'E5', bendTo: 'F#5' }],
      referenceFrets: [19],
      tempo: '48→64 bpm',
    });
  });
});

describe('coachExercises', () => {
  const bendId = exercises.find((x) => x.technique === 'bend')!.id;

  it('keeps tips, dropping ones that name frets the exercise does not use', async () => {
    const result = await coachExercises(
      answering({
        exercises: [
          {
            id: bendId,
            tips: [
              'Check the pitch against fret 19 before you bend.',
              'Try it at fret 12 instead.',
              'Keep your thumb over the neck.',
              'Listen for the target.',
              'A fourth tip is one too many.',
            ],
          },
          { id: 'x99', tips: ['Unknown exercise'] },
        ],
      }),
      phrase,
      exercises,
    );
    expect(result.tips).toEqual({
      [bendId]: [
        'Check the pitch against fret 19 before you bend.',
        'Keep your thumb over the neck.',
        'Listen for the target.',
      ],
    });
    expect(result.droppedTips).toBe(3);
  });

  it('rejects malformed output', async () => {
    await expect(
      coachExercises(answering({ tips: [] }), phrase, exercises),
    ).rejects.toMatchObject({ code: 'ai_invalid_output' });
  });

  it('gets a tip per exercise from the fake provider', async () => {
    const result = await coachExercises(
      new FakeAiProvider(),
      phrase,
      exercises,
    );
    expect(Object.keys(result.tips)).toEqual(exercises.map((x) => x.id));
    expect(result.tips[bendId][0]).toMatch(/start from E5/);
  });
});
