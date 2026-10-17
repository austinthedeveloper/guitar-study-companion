import { CreatePhraseRequest, Phrase } from '@gsc/contracts';
import { memoryStore } from './memory-store.testing';
import {
  createPhrase,
  getPhrase,
  listPhrases,
  updateHarmony,
  updatePhraseMeta,
} from './phrases';

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
    expect((await listPhrases({}, deps)).body).toHaveLength(1);
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

  describe('library', () => {
    const note = (
      order: number,
      stringIndex: number,
      fret: number,
      techniques: string[] = [],
    ) => ({
      id: `e${order}`,
      order,
      stringIndex,
      fret,
      durationTicks: null,
      techniques: techniques as never[],
    });
    async function seed() {
      const deps = { store: memoryStore(), userId: 'u1' };
      const add = (title: string, extra: object) =>
        createPhrase({ ...valid, title, ...extra }, deps);
      // A4 C5 D5: m3 up, M2 up; A minor; hammer-on.
      await add('Minor run', {
        context: { ...valid.context, key: 'Am' },
        tags: ['Blues', 'warmup'],
        notes: 'From the slow blues chapter',
        events: [note(0, 0, 5), note(1, 0, 8, ['hammer-on']), note(2, 0, 10)],
      });
      // E5 D5: M2 down; G major.
      await add('Major lick', {
        context: { ...valid.context, key: 'G' },
        events: [note(0, 0, 12), note(1, 0, 10, ['vibrato'])],
      });
      return deps;
    }
    const titles = async (
      deps: Awaited<ReturnType<typeof seed>>,
      q: Record<string, string>,
    ) =>
      ((await listPhrases(q, deps)).body as { title: string }[]).map(
        (p) => p.title,
      );

    it('returns summaries with computed facets, newest first', async () => {
      const deps = await seed();
      const body = (await listPhrases({}, deps)).body as {
        title: string;
        tags: string[];
        facets: object;
      }[];
      expect(body.map((p) => p.title)).toEqual(['Major lick', 'Minor run']);
      expect(body[1]).toMatchObject({
        tags: ['blues', 'warmup'],
        favorite: false,
        facets: {
          key: 'A minor',
          techniques: ['hammer-on'],
          steps: ['m3 up', 'M2 up'],
        },
      });
    });

    it('filters by words, key meaning, technique, tag, and interval pattern', async () => {
      const deps = await seed();
      expect(await titles(deps, { q: 'slow BLUES' })).toEqual(['Minor run']);
      expect(await titles(deps, { key: 'a minor' })).toEqual(['Minor run']);
      expect(await titles(deps, { technique: 'vibrato' })).toEqual([
        'Major lick',
      ]);
      expect(await titles(deps, { tag: 'Warmup' })).toEqual(['Minor run']);
      expect(await titles(deps, { interval: 'm3 up, M2' })).toEqual([
        'Minor run',
      ]);
      expect(await titles(deps, { interval: 'M2 down' })).toEqual([
        'Major lick',
      ]);
      expect(await titles(deps, { interval: 'M2', key: 'G' })).toEqual([
        'Major lick',
      ]);
    });

    it('rejects searches it cannot understand', async () => {
      const deps = await seed();
      expect((await listPhrases({ interval: 'thirds' }, deps)).status).toBe(
        400,
      );
      expect((await listPhrases({ key: 'H' }, deps)).status).toBe(400);
    });

    it('saves tags, favorite, and notes without a revision bump, and filters favorites', async () => {
      const deps = await seed();
      const [major] = (await listPhrases({}, deps)).body as { id: string }[];
      const res = await updatePhraseMeta(
        major.id,
        { favorite: true, tags: ['  Fav ', 'fav'], notes: 'Try over E7' },
        deps,
      );
      expect(res.body).toMatchObject({
        favorite: true,
        tags: ['fav'],
        notes: 'Try over E7',
        revision: 1,
      });
      expect(await titles(deps, { favorite: 'true' })).toEqual(['Major lick']);
      expect((await updatePhraseMeta(major.id, {}, deps)).status).toBe(400);
      expect(
        (await updatePhraseMeta('nope', { favorite: true }, deps)).status,
      ).toBe(404);
    });
  });
});
