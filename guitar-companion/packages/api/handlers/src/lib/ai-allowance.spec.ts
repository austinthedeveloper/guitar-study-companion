import { CreatePhraseRequest, Phrase, PracticePlan } from '@gsc/contracts';
import { FakeAiProvider } from '@gsc/api/ai-core';
import {
  AiAllowance,
  memoryUsageStore,
  OVER_LIMIT_SCENARIO,
} from './ai-allowance';
import { explainPhraseHandler } from './explain';
import { memoryPracticeStore, memoryStore } from './memory-store.testing';
import { createPhrase } from './phrases';
import { createPlan } from './practice';

const now = () => new Date('2026-10-16T12:00:00.000Z');

describe('AiAllowance', () => {
  it('allows until the daily request or token limit is reached', async () => {
    const store = memoryUsageStore();
    const allowance = new AiAllowance(
      store,
      { requests: 3, tokens: 1000 },
      now,
    );
    expect(await allowance.check('u1')).toBeNull();
    await allowance.record('u1', 2, { inputTokens: 100, outputTokens: 50 });
    expect(await allowance.check('u1')).toBeNull();
    await allowance.record('u1', 1);
    const refused = await allowance.check('u1');
    expect(refused).toMatchObject({
      status: 429,
      body: { error: { code: 'rate_limited', retryable: false } },
    });
    // Other users and other days are unaffected.
    expect(await allowance.check('u2')).toBeNull();
    const tomorrow = new AiAllowance(
      store,
      { requests: 3, tokens: 1000 },
      () => new Date('2026-10-17T00:00:01.000Z'),
    );
    expect(await tomorrow.check('u1')).toBeNull();
  });

  it('counts tokens too', async () => {
    const allowance = new AiAllowance(
      memoryUsageStore(),
      { requests: 99, tokens: 1000 },
      now,
    );
    await allowance.record('u1', 1, { inputTokens: 900, outputTokens: 100 });
    expect((await allowance.check('u1'))?.status).toBe(429);
  });

  it('simulates a used-up allowance for e2e', async () => {
    const allowance = new AiAllowance(memoryUsageStore(), undefined, now);
    expect((await allowance.check('u1', OVER_LIMIT_SCENARIO))?.status).toBe(
      429,
    );
  });
});

describe('allowance in AI handlers', () => {
  const lick: CreatePhraseRequest = {
    title: 'Lick',
    source: { bookTitle: 'Book' },
    context: { tuningMidi: [64, 59, 55, 50, 45, 40], capo: 0, chords: 'A7' },
    rhythmKnown: false,
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
  };
  async function setup(limit: number) {
    const phrases = memoryStore();
    const store = memoryUsageStore();
    const allowance = new AiAllowance(
      store,
      { requests: limit, tokens: 1e6 },
      now,
    );
    const phrase = (await createPhrase(lick, { store: phrases, userId: 'u1' }))
      .body as Phrase;
    return { phrases, store, allowance, phrase };
  }

  it('records explanations and refuses once the allowance is used', async () => {
    const { phrases, store, allowance, phrase } = await setup(1);
    const deps = {
      store: phrases,
      userId: 'u1',
      ai: new FakeAiProvider(),
      allowance,
    };
    expect(
      (await explainPhraseHandler(phrase.id, { revision: 1 }, deps)).status,
    ).toBe(200);
    expect((await store.get('u1', '2026-10-16')).requests).toBe(1);
    const refused = await explainPhraseHandler(
      phrase.id,
      { revision: 1 },
      deps,
    );
    expect(refused.status).toBe(429);
    expect((await store.get('u1', '2026-10-16')).requests).toBe(1);
  });

  it('still builds plans when the allowance is used, without AI tips', async () => {
    const { phrases, allowance, phrase } = await setup(0);
    const res = await createPlan(
      phrase.id,
      {
        revision: 1,
        settings: { difficulty: 'medium', minutes: 15, focus: 'balanced' },
      },
      {
        phrases,
        practice: memoryPracticeStore(),
        userId: 'u1',
        ai: new FakeAiProvider(),
        allowance,
      },
    );
    expect(res.status).toBe(201);
    expect((res.body as PracticePlan).coachedBy).toBeNull();
  });
});
