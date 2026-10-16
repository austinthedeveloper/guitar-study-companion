import { CreatePhraseRequest } from '@gsc/contracts';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoConnection } from './mongo';
import { PhraseRepository } from './phrase-repository';

const input: CreatePhraseRequest = {
  title: 'Bend lick',
  source: { bookTitle: 'Test Book', page: '63' },
  context: { tuningMidi: [64, 59, 55, 50, 45, 40], capo: 0 },
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
  ],
};

describe('PhraseRepository', () => {
  let server: MongoMemoryServer;
  let conn: MongoConnection;
  let repo: PhraseRepository;

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    conn = new MongoConnection(server.getUri(), 'test');
    const db = await conn.db();
    if (!db) throw new Error('no db');
    repo = new PhraseRepository(db);
  }, 60_000);

  afterAll(async () => {
    await conn.close();
    await server.stop();
  });

  it('creates and reads back a phrase for its owner', async () => {
    const created = await repo.create(
      'alice',
      input,
      new Date('2026-10-13T12:00:00Z'),
    );
    expect(created).toMatchObject({
      ...input,
      revision: 1,
      createdAt: '2026-10-13T12:00:00.000Z',
    });
    expect(created).not.toHaveProperty('userId');
    expect(await repo.get('alice', created.id)).toEqual(created);
  });

  it('isolates phrases by user', async () => {
    const created = await repo.create('alice', input);
    expect(await repo.get('bob', created.id)).toBeNull();
    expect((await repo.list('bob')).map((p) => p.id)).not.toContain(created.id);
  });

  it('returns null for malformed ids', async () => {
    expect(await repo.get('alice', 'not-an-id')).toBeNull();
  });

  it('lists newest first', async () => {
    await repo.create(
      'carol',
      { ...input, title: 'old' },
      new Date('2026-01-01'),
    );
    await repo.create(
      'carol',
      { ...input, title: 'new' },
      new Date('2026-06-01'),
    );
    expect((await repo.list('carol')).map((p) => p.title)).toEqual([
      'new',
      'old',
    ]);
  });

  describe('updateHarmony', () => {
    it('replaces key, chords, and placement, and bumps the revision', async () => {
      const created = await repo.create('dave', {
        ...input,
        context: { ...input.context, key: 'E', chords: 'E7' },
      });
      const updated = await repo.updateHarmony('dave', created.id, {
        revision: 1,
        key: 'A',
        chords: 'A7 D7',
        chordChanges: [
          { fromOrder: 3, chord: 'D7' },
          { fromOrder: 0, chord: 'A7' },
        ],
      });
      expect(updated).toMatchObject({
        revision: 2,
        context: {
          key: 'A',
          chords: 'A7 D7',
          chordChanges: [
            { fromOrder: 0, chord: 'A7' },
            { fromOrder: 3, chord: 'D7' },
          ],
          tuningMidi: input.context.tuningMidi,
        },
      });
    });

    it('removes cleared fields', async () => {
      const created = await repo.create('dave', {
        ...input,
        context: { ...input.context, key: 'E', chords: 'E7' },
      });
      const updated = await repo.updateHarmony('dave', created.id, {
        revision: 1,
        chordChanges: [],
      });
      expect(updated).not.toBe('conflict');
      const ctx = (updated as Exclude<typeof updated, string>).context;
      expect(ctx.key).toBeUndefined();
      expect(ctx.chords).toBeUndefined();
      expect(ctx.chordChanges).toBeUndefined();
    });

    it('rejects a stale revision and hides other users phrases', async () => {
      const created = await repo.create('erin', input);
      const update = { revision: 1, key: 'G', chordChanges: [] };
      expect(await repo.updateHarmony('erin', created.id, update)).not.toBe(
        'conflict',
      );
      expect(await repo.updateHarmony('erin', created.id, update)).toBe(
        'conflict',
      );
      expect(await repo.updateHarmony('bob', created.id, update)).toBe(
        'not_found',
      );
      expect(await repo.updateHarmony('erin', 'bad-id', update)).toBe(
        'not_found',
      );
    });
  });

  describe('saveExplanation', () => {
    const explanation = {
      summary: 'S',
      points: [],
      phraseRevision: 1,
      provider: 'fake',
      model: 'm',
      createdAt: '2026-10-16T00:00:00.000Z',
    };

    it('stores it without bumping the revision, only at that revision', async () => {
      const created = await repo.create('fay', input);
      const saved = await repo.saveExplanation('fay', created.id, explanation);
      expect(saved).toMatchObject({ revision: 1, explanation });
      await repo.updateHarmony('fay', created.id, {
        revision: 1,
        chordChanges: [],
      });
      expect(await repo.saveExplanation('fay', created.id, explanation)).toBe(
        'conflict',
      );
      expect(await repo.saveExplanation('bob', created.id, explanation)).toBe(
        'not_found',
      );
    });
  });
});
