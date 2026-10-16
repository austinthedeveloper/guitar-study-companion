import { CreatePhraseRequest, Phrase } from '@gsc/contracts';
import { memoryStore } from './memory-store.testing';
import { createPhrase, getPhrase, listPhrases, updateHarmony } from './phrases';

const valid: CreatePhraseRequest = {
  title: 'Lick',
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
};

describe('phrase handlers', () => {
  it('creates, gets, and lists for the same user', async () => {
    const deps = { store: memoryStore(), userId: 'u1' };
    const created = await createPhrase(valid, deps);
    expect(created.status).toBe(201);
    const id = (created.body as Phrase).id;
    expect((await getPhrase(id, deps)).status).toBe(200);
    expect((await listPhrases(deps)).body).toHaveLength(1);
  });

  it('hides other users phrases (404, not 403)', async () => {
    const store = memoryStore();
    const created = await createPhrase(valid, { store, userId: 'u1' });
    const res = await getPhrase((created.body as Phrase).id, {
      store,
      userId: 'u2',
    });
    expect(res.status).toBe(404);
  });

  it('rejects schema-invalid input with field issues', async () => {
    const res = await createPhrase(
      { ...valid, title: '' },
      { store: memoryStore(), userId: 'u1' },
    );
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: {
        code: 'validation_failed',
        issues: [expect.objectContaining({ path: 'title' })],
      },
    });
  });

  it('rejects musically invalid events with per-event issues', async () => {
    const res = await createPhrase(
      {
        ...valid,
        events: [
          ...valid.events,
          {
            id: 'e2',
            order: 0,
            stringIndex: 0,
            fret: 7,
            durationTicks: null,
            techniques: [],
          },
        ],
      },
      { store: memoryStore(), userId: 'u1' },
    );
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      error: { issues: [{ path: 'events.e2' }] },
    });
  });

  it('rejects durations when rhythm is unknown', async () => {
    const res = await createPhrase(
      { ...valid, events: [{ ...valid.events[0], durationTicks: 480 }] },
      { store: memoryStore(), userId: 'u1' },
    );
    expect(res.status).toBe(422);
  });

  describe('updateHarmony', () => {
    const setup = async () => {
      const deps = { store: memoryStore(), userId: 'u1' };
      const id = ((await createPhrase(valid, deps)).body as Phrase).id;
      return { deps, id };
    };

    it('saves harmony and returns the new revision', async () => {
      const { deps, id } = await setup();
      const res = await updateHarmony(
        id,
        {
          revision: 1,
          key: 'A',
          chords: 'A7',
          chordChanges: [{ fromOrder: 0, chord: 'A7' }],
        },
        deps,
      );
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ revision: 2, context: { key: 'A' } });
    });

    it('rejects two chords starting at the same note', async () => {
      const { deps, id } = await setup();
      const res = await updateHarmony(
        id,
        {
          revision: 1,
          chordChanges: [
            { fromOrder: 0, chord: 'A7' },
            { fromOrder: 0, chord: 'D7' },
          ],
        },
        deps,
      );
      expect(res.status).toBe(400);
    });

    it('returns 409 for a stale revision and 404 for unknown phrases', async () => {
      const { deps, id } = await setup();
      expect((await updateHarmony(id, { revision: 1 }, deps)).status).toBe(200);
      const stale = await updateHarmony(id, { revision: 1 }, deps);
      expect(stale.status).toBe(409);
      expect(stale.body).toMatchObject({ error: { code: 'conflict' } });
      expect((await updateHarmony('nope', { revision: 1 }, deps)).status).toBe(
        404,
      );
    });
  });
});
