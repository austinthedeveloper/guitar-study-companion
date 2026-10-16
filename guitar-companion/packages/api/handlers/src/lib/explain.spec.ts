import { CreatePhraseRequest, Phrase } from '@gsc/contracts';
import { FakeAiProvider } from '@gsc/api/ai-core';
import { explainPhraseHandler } from './explain';
import { memoryStore } from './memory-store.testing';
import { createPhrase, updateHarmony } from './phrases';

const lick: CreatePhraseRequest = {
  title: 'Lick',
  source: { bookTitle: 'Book' },
  context: { tuningMidi: [64, 59, 55, 50, 45, 40], capo: 0, chords: 'A7' },
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
};

const setup = async () => {
  const deps = {
    store: memoryStore(),
    userId: 'u1',
    ai: new FakeAiProvider(),
    now: () => new Date('2026-10-16T12:00:00.000Z'),
  };
  const id = ((await createPhrase(lick, deps)).body as Phrase).id;
  return { deps, id };
};

describe('explainPhraseHandler', () => {
  it('explains the stored phrase and saves it against its revision', async () => {
    const { deps, id } = await setup();
    const res = await explainPhraseHandler(id, { revision: 1 }, deps);
    expect(res.status).toBe(200);
    expect((res.body as Phrase).explanation).toMatchObject({
      phraseRevision: 1,
      provider: 'fake',
      model: 'fake-explain',
      createdAt: '2026-10-16T12:00:00.000Z',
      points: [
        {
          kind: 'observation',
          text: 'Opens on A4, the R (chord tone) of A7.',
          eventIds: ['e1'],
        },
        expect.objectContaining({ kind: 'interpretation' }),
      ],
    });
  });

  it('refuses to explain a revision the user is not looking at', async () => {
    const { deps, id } = await setup();
    await updateHarmony(id, { revision: 1, key: 'A' }, deps);
    const res = await explainPhraseHandler(id, { revision: 1 }, deps);
    expect(res.status).toBe(409);
  });

  it('keeps an old explanation, which is then stale', async () => {
    const { deps, id } = await setup();
    await explainPhraseHandler(id, { revision: 1 }, deps);
    const updated = (await updateHarmony(id, { revision: 1, key: 'A' }, deps))
      .body as Phrase;
    expect(updated.revision).toBe(2);
    expect(updated.explanation?.phraseRevision).toBe(1);
  });

  it('maps AI failures to retryable errors', async () => {
    const { deps, id } = await setup();
    const res = await explainPhraseHandler(
      id,
      { revision: 1 },
      { ...deps, scenario: 'unavailable' },
    );
    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({
      error: { code: 'ai_unavailable', retryable: true },
    });
  });

  it('validates input and hides missing phrases', async () => {
    const { deps } = await setup();
    expect((await explainPhraseHandler('x', {}, deps)).status).toBe(400);
    expect(
      (await explainPhraseHandler('nope', { revision: 1 }, deps)).status,
    ).toBe(404);
  });
});
