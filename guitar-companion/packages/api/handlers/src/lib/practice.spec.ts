import { CreatePhraseRequest, Phrase, PracticePlan } from '@gsc/contracts';
import { FakeAiProvider } from '@gsc/api/ai-core';
import { memoryPracticeStore, memoryStore } from './memory-store.testing';
import { createPhrase, updateHarmony } from './phrases';
import { createPlan, getLatestPlan, getSession, saveSession } from './practice';

const lick: CreatePhraseRequest = {
  title: 'Lick',
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
};
const settings = { difficulty: 'medium', minutes: 15, focus: 'balanced' };

async function setup() {
  const phrases = memoryStore();
  const deps = {
    phrases,
    practice: memoryPracticeStore(),
    userId: 'u1',
    ai: new FakeAiProvider(),
  };
  const phrase = (await createPhrase(lick, { store: phrases, userId: 'u1' }))
    .body as Phrase;
  return { deps, phrase };
}

describe('practice handlers', () => {
  it('creates a rule-built plan with AI tips and finds it as the latest', async () => {
    const { deps, phrase } = await setup();
    const res = await createPlan(phrase.id, { revision: 1, settings }, deps);
    expect(res.status).toBe(201);
    const plan = res.body as PracticePlan;
    expect(plan).toMatchObject({
      phraseId: phrase.id,
      phraseRevision: 1,
      coachedBy: { provider: 'fake', model: 'fake-coach' },
      rejected: [],
    });
    expect(plan.exercises.map((x) => x.kind)).toEqual([
      'technique',
      'slow',
      'apply',
    ]);
    expect(plan.exercises[0].coaching[0]).toMatch(/Synthetic tip/);
    expect((await getLatestPlan(phrase.id, deps)).body).toEqual(plan);
  });

  it('keeps the plan with rule steps only when coaching fails', async () => {
    const { deps, phrase } = await setup();
    const res = await createPlan(
      phrase.id,
      { revision: 1, settings },
      { ...deps, scenario: 'unavailable' },
    );
    expect(res.status).toBe(201);
    const plan = res.body as PracticePlan;
    expect(plan.coachedBy).toBeNull();
    expect(plan.exercises.every((x) => x.coaching.length === 0)).toBe(true);
    expect(plan.exercises[0].instructions.length).toBeGreaterThan(0);
  });

  it('builds only for the revision the player is looking at', async () => {
    const { deps, phrase } = await setup();
    await updateHarmony(
      phrase.id,
      { revision: 1, key: 'E' },
      {
        store: deps.phrases,
        userId: 'u1',
      },
    );
    expect(
      (await createPlan(phrase.id, { revision: 1, settings }, deps)).status,
    ).toBe(409);
    expect(
      (await createPlan('nope', { revision: 1, settings }, deps)).status,
    ).toBe(404);
    expect(
      (
        await createPlan(
          phrase.id,
          { revision: 2, settings: { minutes: 2 } },
          deps,
        )
      ).status,
    ).toBe(400);
  });

  it('starts an empty session and saves progress for real exercises only', async () => {
    const { deps, phrase } = await setup();
    const plan = (await createPlan(phrase.id, { revision: 1, settings }, deps))
      .body as PracticePlan;
    expect((await getSession(plan.id, deps)).body).toMatchObject({
      planId: plan.id,
      progress: {},
      notes: '',
    });
    const id = plan.exercises[0].id;
    const saved = await saveSession(
      plan.id,
      {
        progress: {
          [id]: { completedAt: '2026-10-16T10:00:00.000Z', bestBpm: 64 },
        },
        notes: 'Bend is flat',
      },
      deps,
    );
    expect(saved.status).toBe(200);
    expect((await getSession(plan.id, deps)).body).toMatchObject({
      notes: 'Bend is flat',
    });
    expect(
      (
        await saveSession(
          plan.id,
          {
            progress: { x99: { completedAt: null, bestBpm: null } },
            notes: '',
          },
          deps,
        )
      ).status,
    ).toBe(400);
    expect((await getSession('nope', deps)).status).toBe(404);
    expect((await getLatestPlan('other', deps)).status).toBe(404);
  });
});
